#!/bin/bash
# =============================================================================
# Template Editor - CyberPanel VPS Deployment Script
# =============================================================================
# This script deploys the Template Editor application to a CyberPanel VPS
# 
# Prerequisites:
# - CyberPanel installed on your VPS
# - Domain pointed to your VPS IP
# - SSH access to your VPS
# =============================================================================

set -e

# Configuration - EDIT THESE VALUES
DOMAIN="your-domain.com"           # Your domain name
APP_USER="template-editor"          # Linux user for the app
APP_DIR="/home/$APP_USER/app"       # Application directory
MONGO_DB_NAME="template_editor"     # MongoDB database name
BACKEND_PORT=8001                   # Backend port (internal)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Step 1: System Dependencies
# =============================================================================
install_dependencies() {
    echo_info "Installing system dependencies..."
    
    # Update system
    apt-get update
    
    # Install Node.js 18.x
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # Install Python 3.10+ and pip
    apt-get install -y python3 python3-pip python3-venv
    
    # Install MongoDB
    if ! command -v mongod &> /dev/null; then
        echo_info "Installing MongoDB..."
        wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
        echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        apt-get update
        apt-get install -y mongodb-org
        systemctl start mongod
        systemctl enable mongod
    fi
    
    # Install Yarn
    npm install -g yarn
    
    # Install supervisor for process management
    apt-get install -y supervisor
    
    echo_info "Dependencies installed successfully!"
}

# =============================================================================
# Step 2: Create Application User
# =============================================================================
create_app_user() {
    echo_info "Creating application user..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd -m -s /bin/bash $APP_USER
        echo_info "User $APP_USER created"
    else
        echo_warn "User $APP_USER already exists"
    fi
}

# =============================================================================
# Step 3: Setup Application Directory
# =============================================================================
setup_application() {
    echo_info "Setting up application directory..."
    
    # Create app directory
    mkdir -p $APP_DIR
    
    # Copy application files (assuming they're in current directory)
    cp -r ./backend $APP_DIR/
    cp -r ./frontend $APP_DIR/
    
    # Set ownership
    chown -R $APP_USER:$APP_USER $APP_DIR
    
    echo_info "Application files copied to $APP_DIR"
}

# =============================================================================
# Step 4: Setup Backend
# =============================================================================
setup_backend() {
    echo_info "Setting up backend..."
    
    cd $APP_DIR/backend
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Create .env file
    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=$MONGO_DB_NAME
CORS_ORIGINS=https://$DOMAIN,http://$DOMAIN
EOF
    
    deactivate
    
    # Set ownership
    chown -R $APP_USER:$APP_USER $APP_DIR/backend
    
    echo_info "Backend setup complete!"
}

# =============================================================================
# Step 5: Build Frontend
# =============================================================================
build_frontend() {
    echo_info "Building frontend..."
    
    cd $APP_DIR/frontend
    
    # Create production .env
    cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF
    
    # Install dependencies and build
    yarn install
    yarn build
    
    # Set ownership
    chown -R $APP_USER:$APP_USER $APP_DIR/frontend
    
    echo_info "Frontend build complete!"
}

# =============================================================================
# Step 6: Setup Supervisor for Backend
# =============================================================================
setup_supervisor() {
    echo_info "Setting up Supervisor for backend process..."
    
    cat > /etc/supervisor/conf.d/template-editor.conf << EOF
[program:template-editor-backend]
command=$APP_DIR/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT
directory=$APP_DIR/backend
user=$APP_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/template-editor/backend.err.log
stdout_logfile=/var/log/template-editor/backend.out.log
environment=PATH="$APP_DIR/backend/venv/bin"
EOF

    # Create log directory
    mkdir -p /var/log/template-editor
    chown -R $APP_USER:$APP_USER /var/log/template-editor
    
    # Reload supervisor
    supervisorctl reread
    supervisorctl update
    supervisorctl start template-editor-backend
    
    echo_info "Supervisor configured and backend started!"
}

# =============================================================================
# Step 7: Configure OpenLiteSpeed (CyberPanel)
# =============================================================================
configure_openlitespeed() {
    echo_info "Configuring OpenLiteSpeed..."
    
    # Create vhost config for reverse proxy
    # This creates the external app and context for API proxy
    
    VHOST_CONF="/usr/local/lsws/conf/vhosts/$DOMAIN/vhconf.conf"
    
    # Check if vhost exists
    if [ ! -f "$VHOST_CONF" ]; then
        echo_error "VHost config not found at $VHOST_CONF"
        echo_info "Please create the website in CyberPanel first, then run this script again"
        exit 1
    fi
    
    # Add external app for backend API
    cat >> $VHOST_CONF << EOF

# Template Editor Backend Proxy
extprocessor backend {
  type                    proxy
  address                 127.0.0.1:$BACKEND_PORT
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# API Context - Proxy to backend
context /api {
  type                    proxy
  handler                 backend
  addDefaultCharset       off
}

EOF

    # Set document root to frontend build
    sed -i "s|docRoot.*|docRoot                   $APP_DIR/frontend/build|g" $VHOST_CONF
    
    # Restart OpenLiteSpeed
    systemctl restart lsws
    
    echo_info "OpenLiteSpeed configured!"
}

# =============================================================================
# Step 8: Setup SSL with Let's Encrypt (via CyberPanel)
# =============================================================================
setup_ssl_instructions() {
    echo_info "SSL Setup Instructions:"
    echo ""
    echo "1. Log into CyberPanel admin panel"
    echo "2. Go to SSL -> Hostname SSL or Manage SSL"
    echo "3. Select your domain: $DOMAIN"
    echo "4. Click 'Issue SSL' to get Let's Encrypt certificate"
    echo ""
}

# =============================================================================
# Step 9: Create systemd service (alternative to supervisor)
# =============================================================================
create_systemd_service() {
    echo_info "Creating systemd service as alternative..."
    
    cat > /etc/systemd/system/template-editor.service << EOF
[Unit]
Description=Template Editor Backend
After=network.target mongodb.service

[Service]
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    echo_info "Systemd service created (use 'systemctl start template-editor' if not using supervisor)"
}

# =============================================================================
# Main Deployment Function
# =============================================================================
deploy() {
    echo "============================================="
    echo "  Template Editor - CyberPanel Deployment"
    echo "============================================="
    echo ""
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        echo_error "Please run as root (sudo)"
        exit 1
    fi
    
    # Confirm settings
    echo "Deployment Settings:"
    echo "  Domain: $DOMAIN"
    echo "  App Directory: $APP_DIR"
    echo "  Backend Port: $BACKEND_PORT"
    echo ""
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    install_dependencies
    create_app_user
    setup_application
    setup_backend
    build_frontend
    setup_supervisor
    create_systemd_service
    configure_openlitespeed
    setup_ssl_instructions
    
    echo ""
    echo "============================================="
    echo "  Deployment Complete!"
    echo "============================================="
    echo ""
    echo "Next steps:"
    echo "1. Issue SSL certificate via CyberPanel"
    echo "2. Visit https://$DOMAIN to test your application"
    echo ""
    echo "Useful commands:"
    echo "  - View backend logs: tail -f /var/log/template-editor/backend.err.log"
    echo "  - Restart backend: supervisorctl restart template-editor-backend"
    echo "  - Check status: supervisorctl status"
    echo ""
}

# Run deployment
deploy
