#!/bin/bash
# =============================================================================
# Quick Setup Script for CyberPanel VPS
# Run this on your VPS after uploading the application files
# =============================================================================

set -e

echo "=========================================="
echo "  Template Editor - Quick Setup"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo ./quick-setup.sh)"
    exit 1
fi

# Get domain from user
read -p "Enter your domain name (e.g., editor.example.com): " DOMAIN
read -p "Enter your email for SSL notifications: " EMAIL

if [ -z "$DOMAIN" ]; then
    echo "Domain is required!"
    exit 1
fi

echo ""
echo "Setting up for domain: $DOMAIN"
echo ""

# Variables
APP_DIR="/home/template-editor/app"
BACKEND_PORT=8001

# Step 1: Install dependencies
echo "[1/8] Installing system dependencies..."
apt-get update -qq
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs python3 python3-pip python3-venv supervisor > /dev/null

# Install Yarn
npm install -g yarn > /dev/null 2>&1

# Install MongoDB if not present
if ! command -v mongod &> /dev/null; then
    echo "[1/8] Installing MongoDB..."
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - > /dev/null 2>&1
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq mongodb-org > /dev/null
    systemctl start mongod
    systemctl enable mongod > /dev/null 2>&1
fi

echo "[1/8] ✓ Dependencies installed"

# Step 2: Create user
echo "[2/8] Creating application user..."
if ! id "template-editor" &>/dev/null; then
    useradd -m -s /bin/bash template-editor
fi
echo "[2/8] ✓ User created"

# Step 3: Setup directories
echo "[3/8] Setting up application..."
mkdir -p $APP_DIR
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cp -r "$SCRIPT_DIR/backend" $APP_DIR/
cp -r "$SCRIPT_DIR/frontend" $APP_DIR/
chown -R template-editor:template-editor /home/template-editor
echo "[3/8] ✓ Application files copied"

# Step 4: Setup backend
echo "[4/8] Setting up backend..."
cd $APP_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=template_editor
CORS_ORIGINS=https://$DOMAIN,http://$DOMAIN
EOF
deactivate
chown -R template-editor:template-editor $APP_DIR/backend
echo "[4/8] ✓ Backend configured"

# Step 5: Build frontend
echo "[5/8] Building frontend (this may take a few minutes)..."
cd $APP_DIR/frontend
cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF
yarn install --silent > /dev/null 2>&1
yarn build > /dev/null 2>&1
chown -R template-editor:template-editor $APP_DIR/frontend
echo "[5/8] ✓ Frontend built"

# Step 6: Setup supervisor
echo "[6/8] Configuring process manager..."
mkdir -p /var/log/template-editor
chown -R template-editor:template-editor /var/log/template-editor

cat > /etc/supervisor/conf.d/template-editor.conf << EOF
[program:template-editor-backend]
command=$APP_DIR/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT
directory=$APP_DIR/backend
user=template-editor
autostart=true
autorestart=true
stderr_logfile=/var/log/template-editor/backend.err.log
stdout_logfile=/var/log/template-editor/backend.out.log
environment=PATH="$APP_DIR/backend/venv/bin"
EOF

supervisorctl reread > /dev/null 2>&1
supervisorctl update > /dev/null 2>&1
supervisorctl start template-editor-backend > /dev/null 2>&1
echo "[6/8] ✓ Backend service started"

# Step 7: Configure OpenLiteSpeed
echo "[7/8] Configuring web server..."
VHOST_CONF="/usr/local/lsws/conf/vhosts/$DOMAIN/vhconf.conf"

if [ -f "$VHOST_CONF" ]; then
    # Backup original
    cp $VHOST_CONF ${VHOST_CONF}.bak
    
    # Update document root
    sed -i "s|docRoot.*|docRoot                   $APP_DIR/frontend/build|g" $VHOST_CONF
    
    # Add proxy configuration if not exists
    if ! grep -q "extprocessor backend" "$VHOST_CONF"; then
        cat >> $VHOST_CONF << EOF

extprocessor backend {
  type                    proxy
  address                 127.0.0.1:$BACKEND_PORT
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context /api {
  type                    proxy
  handler                 backend
  addDefaultCharset       off
}

rewrite  {
  enable                  1
  autoLoadHtaccess        1
  rules                   <<<END_rules
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api
RewriteRule ^(.*)$ /index.html [L]
END_rules
}
EOF
    fi
    
    systemctl restart lsws
    echo "[7/8] ✓ Web server configured"
else
    echo "[7/8] ⚠ Website not found in CyberPanel!"
    echo "     Please create the website '$DOMAIN' in CyberPanel first"
    echo "     Then re-run this script"
fi

# Step 8: Final instructions
echo "[8/8] Setup complete!"
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. If not done, create website '$DOMAIN' in CyberPanel"
echo "2. Issue SSL certificate in CyberPanel:"
echo "   - Go to SSL → Manage SSL → Select $DOMAIN → Issue SSL"
echo ""
echo "3. Test your application:"
echo "   - Frontend: https://$DOMAIN"
echo "   - API: https://$DOMAIN/api/"
echo ""
echo "Useful commands:"
echo "  supervisorctl status                    # Check backend status"
echo "  supervisorctl restart template-editor-backend  # Restart backend"
echo "  tail -f /var/log/template-editor/backend.err.log  # View logs"
echo ""
