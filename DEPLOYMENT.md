# CalTrack Deployment Guide (Ubuntu/Apache + Node.js)

## Prerequisites

- Ubuntu server (20.04 LTS or newer)
- Apache2 installed
- Node.js 18+ installed
- PostgreSQL 14+ installed
- Domain name (optional)

## 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Apache2
sudo apt install -y apache2

# Enable required Apache modules
sudo a2enmod proxy proxy_http rewrite ssl headers
```

## 2. Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE caltrack;
CREATE USER caltrack_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE caltrack TO caltrack_user;
\q
```

## 3. Deploy Backend

```bash
# Create app directory
sudo mkdir -p /var/www/caltrack
sudo chown $USER:$USER /var/www/caltrack

# Clone/copy your code
cd /var/www/caltrack
# (copy your files here)

# Install server dependencies
cd server
npm install --production

# Create .env file
cp .env.example .env
nano .env
# Fill in your database credentials and JWT secret

# Initialize database
npm run init-db

# Test server
npm start
```

## 4. Setup PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
cd /var/www/caltrack/server
pm2 start src/index.js --name caltrack-api

# Configure PM2 to start on boot
pm2 startup systemd
pm2 save
```

## 5. Configure Apache as Reverse Proxy

Create Apache config: `/etc/apache2/sites-available/caltrack.conf`

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAdmin admin@your-domain.com

    # Serve static frontend files
    DocumentRoot /var/www/caltrack/dist

    <Directory /var/www/caltrack/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # SPA fallback
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy API requests to Node.js backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/caltrack-error.log
    CustomLog ${APACHE_LOG_DIR}/caltrack-access.log combined
</VirtualHost>
```

Enable the site:

```bash
sudo a2ensite caltrack.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

## 6. Setup SSL with Let's Encrypt (Optional)

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com
```

## 7. Build and Deploy Frontend

```bash
cd /var/www/caltrack

# Install frontend dependencies
npm install

# Build for production
npm run build

# Frontend files are now in /var/www/caltrack/dist
```

## 8. Update Frontend API Configuration

Update `src/api/config.ts` (create if doesn't exist):

```typescript
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'  // Relative URL for production (proxied by Apache)
  : 'http://localhost:3001/api';  // Development server
```

## 9. Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT secret
- [ ] Configure firewall (ufw)
- [ ] Enable fail2ban
- [ ] Regular backups of PostgreSQL database
- [ ] Keep system packages updated
- [ ] Monitor logs regularly

## 10. Useful Commands

```bash
# View API logs
pm2 logs caltrack-api

# Restart API server
pm2 restart caltrack-api

# Restart Apache
sudo systemctl restart apache2

# View Apache logs
sudo tail -f /var/log/apache2/caltrack-error.log

# Database backup
pg_dump -U caltrack_user caltrack > backup_$(date +%Y%m%d).sql

# Database restore
psql -U caltrack_user caltrack < backup_20240101.sql
```

## Directory Structure on Server

```
/var/www/caltrack/
├── dist/              # Built frontend files (served by Apache)
├── server/            # Node.js backend
│   ├── src/
│   ├── node_modules/
│   ├── package.json
│   └── .env
├── node_modules/
└── package.json
```

## Multi-User Notes

- Each family member creates their own account via the registration page
- Data is completely isolated per user (enforced at database level)
- JWT tokens authenticate and authorize all API requests
- No GDPR compliance needed for family use, but good practices:
  - Store passwords as bcrypt hashes ✓
  - Use HTTPS for authentication ✓
  - Keep user data private ✓
