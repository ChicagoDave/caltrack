# CalTrack Deployment Guide - Ubuntu + Node.js + Apache

**Target**: Ubuntu server at ct.plover.net
**Tech Stack**: Node.js backend (SQLite) + Apache reverse proxy

---

## Part 1: Prepare Local Files for Upload

### 1. Build the frontend (DONE ✓)
```bash
# Already completed - verify dist/ folder exists
ls dist/
```

### 2. Prepare files for upload
You'll upload these folders via WinSCP:
- `dist/` - Built frontend files
- `server/` - Backend Node.js code
- `package.json` (root) - For reference

---

## Part 2: Server Setup (SSH Commands)

### 3. Connect to server via SSH
```bash
ssh your-username@ct.plover.net
```

### 4. Install Node.js (if not already installed)
```bash
# Check if Node.js is installed
node --version  # Should be 18+

# If not installed:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 5. Install PM2 (process manager)
```bash
sudo npm install -g pm2
```

### 6. Create application directory
```bash
sudo mkdir -p /var/www/caltrack
sudo chown $USER:$USER /var/www/caltrack
```

---

## Part 3: Upload Files via WinSCP

### 7. Upload files to server
Using WinSCP:
1. Connect to ct.plover.net
2. Navigate to `/var/www/caltrack/`
3. Upload these folders:
   - `dist/` → `/var/www/caltrack/dist/`
   - `server/` → `/var/www/caltrack/server/`

---

## Part 4: Configure Backend (SSH Commands)

### 8. Install backend dependencies
```bash
cd /var/www/caltrack/server
npm install --production
```

### 9. Create production environment file
```bash
cd /var/www/caltrack/server
nano .env
```

Paste this configuration:
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# JWT Secret (generate a strong random string)
JWT_SECRET=change_this_to_random_string_min_32_chars_long

# CORS Origins
CORS_ORIGINS=http://ct.plover.net,https://ct.plover.net

# FatSecret API Credentials (get from https://platform.fatsecret.com/)
FATSECRET_CLIENT_ID=your_client_id_here
FATSECRET_CLIENT_SECRET=your_client_secret_here
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 10. Initialize SQLite database
```bash
cd /var/www/caltrack/server
npm run init-db
```

This creates the database file and pre-populates 4 family users:
- dad@family.local / changeme123
- tori@family.local / changeme123
- angie@family.local / changeme123
- gabby@family.local / changeme123

### 11. Test the backend server
```bash
cd /var/www/caltrack/server
npm start
```

You should see: `🚀 Server running on http://localhost:3001`

Press `Ctrl+C` to stop the test.

---

## Part 5: Set Up PM2 (Production Process Manager)

### 12. Start backend with PM2
```bash
cd /var/www/caltrack/server
pm2 start src/index.js --name caltrack-api
pm2 save
pm2 startup systemd
# Run the command PM2 outputs (starts with 'sudo env PATH=...')
```

### 13. Verify PM2 is running
```bash
pm2 status
pm2 logs caltrack-api
```

You should see the server running without errors.

---

## Part 6: Configure Apache Reverse Proxy

### 14. Create Apache virtual host configuration
```bash
sudo nano /etc/apache2/sites-available/caltrack.conf
```

Paste this configuration:
```apache
<VirtualHost *:80>
    ServerName ct.plover.net
    ServerAdmin admin@plover.net

    # Serve static frontend files
    DocumentRoot /var/www/caltrack/dist

    <Directory /var/www/caltrack/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # SPA fallback - route all requests to index.html
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

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 15. Enable required Apache modules
```bash
sudo a2enmod proxy proxy_http rewrite ssl headers
```

### 16. Enable the site and reload Apache
```bash
sudo a2ensite caltrack.conf
sudo apache2ctl configtest  # Should say "Syntax OK"
sudo systemctl reload apache2
```

---

## Part 7: Test the Deployment

### 17. Visit your site
Open browser: http://ct.plover.net

You should see the CalTrack login page with 4 family users.

### 18. Test login
- Click on "Dad"
- Should redirect to dashboard
- Try adding a food item

---

## Part 8: Set Up FatSecret API (Required for Food Search)

### 19. Get FatSecret API credentials
1. Visit https://platform.fatsecret.com/
2. Sign up for a free developer account
3. Create a new application
4. Copy your Client ID and Client Secret

### 20. Update .env with FatSecret credentials
```bash
cd /var/www/caltrack/server
nano .env
```

Update these lines:
```env
FATSECRET_CLIENT_ID=your_actual_client_id
FATSECRET_CLIENT_SECRET=your_actual_client_secret
```

### 21. Restart the backend
```bash
pm2 restart caltrack-api
```

---

## Useful Commands for Maintenance

### View backend logs
```bash
pm2 logs caltrack-api
```

### Restart backend
```bash
pm2 restart caltrack-api
```

### Restart Apache
```bash
sudo systemctl restart apache2
```

### View Apache error logs
```bash
sudo tail -f /var/log/apache2/caltrack-error.log
```

### Backup SQLite database
```bash
cp /var/www/caltrack/server/caltrack.db /var/www/caltrack/server/caltrack.db.backup-$(date +%Y%m%d)
```

### Update the application
```bash
# Stop backend
pm2 stop caltrack-api

# Upload new files via WinSCP (dist/ and server/)

# Rebuild backend dependencies (if package.json changed)
cd /var/www/caltrack/server
npm install --production

# Restart backend
pm2 restart caltrack-api
```

---

## File Permissions Check

Ensure proper permissions:
```bash
sudo chown -R $USER:$USER /var/www/caltrack
sudo chmod -R 755 /var/www/caltrack/dist
sudo chmod 600 /var/www/caltrack/server/.env
sudo chmod 644 /var/www/caltrack/server/caltrack.db
```

---

## Troubleshooting

### Frontend loads but shows blank page
- Check browser console for errors
- Verify `/var/www/caltrack/dist/` contains files
- Check Apache error log: `sudo tail -f /var/log/apache2/caltrack-error.log`

### API requests fail (login doesn't work)
- Check backend is running: `pm2 status`
- Check backend logs: `pm2 logs caltrack-api`
- Verify Apache proxy is working: `curl http://localhost:3001/api/health`

### Database errors
- Verify database exists: `ls -lh /var/www/caltrack/server/caltrack.db`
- Reinitialize if needed: `cd /var/www/caltrack/server && npm run init-db`

### Food search doesn't work
- Verify FatSecret credentials in `/var/www/caltrack/server/.env`
- Check backend logs for API errors: `pm2 logs caltrack-api`
- FatSecret free tier: 10,000 requests/day

---

## Security Notes

- Change default user passwords after first login
- Generate a strong JWT_SECRET (32+ random characters)
- Keep server packages updated: `sudo apt update && sudo apt upgrade`
- Set up SSL certificate with Let's Encrypt (optional but recommended)
- Regular database backups

---

## Quick Reference

**Frontend**: `/var/www/caltrack/dist/`
**Backend**: `/var/www/caltrack/server/`
**Database**: `/var/www/caltrack/server/caltrack.db`
**Config**: `/var/www/caltrack/server/.env`
**Apache Config**: `/etc/apache2/sites-available/caltrack.conf`
**Apache Logs**: `/var/log/apache2/caltrack-*.log`

**Backend Port**: 3001 (internal only)
**Public URL**: http://ct.plover.net

---

## Next Steps After Deployment

1. Test all 4 family user logins
2. Add food items (verify FatSecret API works)
3. Add activities
4. Track weight and set goals
5. Navigate between days
6. Set up SSL certificate (optional)
7. Create regular backup script for database
