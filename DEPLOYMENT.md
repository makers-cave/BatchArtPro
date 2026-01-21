# Template Editor - CyberPanel VPS Deployment Guide

## Overview
This guide walks you through deploying the Template Editor application to a VPS with CyberPanel installed.

## Prerequisites
- VPS with CyberPanel installed (Ubuntu 20.04/22.04 recommended)
- Domain name pointed to your VPS IP address
- SSH root access to your VPS
- At least 2GB RAM (for TensorFlow handwriting synthesis)

---

## Quick Deployment (Automated)

### Step 1: Download Application to VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Create a directory for the application
mkdir -p /tmp/template-editor
cd /tmp/template-editor

# Option A: Clone from GitHub (if pushed)
git clone https://github.com/your-username/template-editor.git .

# Option B: Upload via SCP from your local machine
# (Run this from your local machine)
scp -r /path/to/app root@your-vps-ip:/tmp/template-editor/
```

### Step 2: Edit Configuration

```bash
# Edit the deployment script
nano /tmp/template-editor/scripts/deploy-cyberpanel.sh

# Update these variables at the top:
DOMAIN="your-domain.com"           # Your actual domain
APP_USER="template-editor"          # Can leave as default
MONGO_DB_NAME="template_editor"     # Can leave as default
```

### Step 3: Run Deployment Script

```bash
chmod +x /tmp/template-editor/scripts/deploy-cyberpanel.sh
cd /tmp/template-editor
sudo ./scripts/deploy-cyberpanel.sh
```

---

## Manual Deployment Steps

If you prefer manual control, follow these steps:

### Step 1: Create Website in CyberPanel

1. Log into CyberPanel: `https://your-vps-ip:8090`
2. Go to **Websites → Create Website**
3. Enter your domain name
4. Select PHP version (any, we won't use it)
5. Click **Create Website**

### Step 2: Install System Dependencies

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Python 3 and pip
apt-get install -y python3 python3-pip python3-venv

# Install Yarn
npm install -g yarn

# Install Supervisor
apt-get install -y supervisor

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org
systemctl start mongod
systemctl enable mongod
```

### Step 3: Setup Application

```bash
# Create app user
useradd -m -s /bin/bash template-editor

# Create app directory
APP_DIR="/home/template-editor/app"
mkdir -p $APP_DIR

# Copy application files
cp -r /tmp/template-editor/backend $APP_DIR/
cp -r /tmp/template-editor/frontend $APP_DIR/

# Set ownership
chown -R template-editor:template-editor $APP_DIR
```

### Step 4: Setup Backend

```bash
cd /home/template-editor/app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=template_editor
CORS_ORIGINS=https://your-domain.com,http://your-domain.com
EOF

deactivate
chown -R template-editor:template-editor /home/template-editor/app/backend
```

### Step 5: Build Frontend

```bash
cd /home/template-editor/app/frontend

# Create production .env
cat > .env << EOF
REACT_APP_BACKEND_URL=https://your-domain.com
EOF

# Install and build
yarn install
yarn build

chown -R template-editor:template-editor /home/template-editor/app/frontend
```

### Step 6: Configure Supervisor

```bash
# Create supervisor config
cat > /etc/supervisor/conf.d/template-editor.conf << EOF
[program:template-editor-backend]
command=/home/template-editor/app/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
directory=/home/template-editor/app/backend
user=template-editor
autostart=true
autorestart=true
stderr_logfile=/var/log/template-editor/backend.err.log
stdout_logfile=/var/log/template-editor/backend.out.log
environment=PATH="/home/template-editor/app/backend/venv/bin"
EOF

# Create log directory
mkdir -p /var/log/template-editor
chown -R template-editor:template-editor /var/log/template-editor

# Start backend
supervisorctl reread
supervisorctl update
supervisorctl start template-editor-backend
```

### Step 7: Configure OpenLiteSpeed for Reverse Proxy

Edit your vhost configuration:

```bash
nano /usr/local/lsws/conf/vhosts/your-domain.com/vhconf.conf
```

Add these sections:

```apache
# Update document root to React build
docRoot                   /home/template-editor/app/frontend/build

# Add external app for API proxy
extprocessor backend {
  type                    proxy
  address                 127.0.0.1:8001
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

# API Context - Proxy /api requests to backend
context /api {
  type                    proxy
  handler                 backend
  addDefaultCharset       off
}

# Rewrite rules for React SPA
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
```

Restart OpenLiteSpeed:

```bash
systemctl restart lsws
```

### Step 8: Issue SSL Certificate

1. Log into CyberPanel
2. Go to **SSL → Manage SSL**
3. Select your domain
4. Click **Issue SSL**

---

## Alternative: Using Nginx (if not using OpenLiteSpeed)

If you prefer Nginx, create this config:

```nginx
# /etc/nginx/sites-available/template-editor
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /home/template-editor/app/frontend/build;
    index index.html;

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Post-Deployment

### Verify Installation

```bash
# Check backend status
supervisorctl status template-editor-backend

# Check backend logs
tail -f /var/log/template-editor/backend.err.log

# Test API
curl http://localhost:8001/api/

# Test MongoDB
mongosh --eval "db.adminCommand('ping')"
```

### Common Issues

**1. Backend not starting**
```bash
# Check logs
tail -100 /var/log/template-editor/backend.err.log

# Common fixes:
# - Missing Python packages: pip install -r requirements.txt
# - Port in use: lsof -i :8001
```

**2. API returning 502 Bad Gateway**
```bash
# Ensure backend is running
supervisorctl status

# Check OpenLiteSpeed error log
tail -100 /usr/local/lsws/logs/error.log
```

**3. Handwriting not generating**
```bash
# TensorFlow needs more memory
# Check available RAM: free -h
# Ensure at least 2GB available
```

**4. MongoDB connection failed**
```bash
# Check MongoDB status
systemctl status mongod

# Start if not running
systemctl start mongod
```

---

## Updating the Application

```bash
# Pull latest code
cd /tmp/template-editor
git pull

# Copy updated files
cp -r backend/* /home/template-editor/app/backend/
cp -r frontend/* /home/template-editor/app/frontend/

# Rebuild frontend
cd /home/template-editor/app/frontend
yarn install
yarn build

# Update backend dependencies
cd /home/template-editor/app/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Restart backend
supervisorctl restart template-editor-backend

# Fix ownership
chown -R template-editor:template-editor /home/template-editor/app
```

---

## Security Recommendations

1. **Firewall**: Only allow ports 80, 443, and 8090 (CyberPanel)
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 8090/tcp
   ufw enable
   ```

2. **MongoDB**: Bind to localhost only (default)
   ```bash
   # Check /etc/mongod.conf has:
   # bindIp: 127.0.0.1
   ```

3. **Regular Updates**:
   ```bash
   apt-get update && apt-get upgrade -y
   ```

---

## Support

For issues specific to:
- **CyberPanel**: https://community.cyberpanel.net/
- **OpenLiteSpeed**: https://openlitespeed.org/support/
- **MongoDB**: https://www.mongodb.com/community/forums/
