# CalTrack - Deployment Complete Summary

**Date**: October 1, 2025
**Status**: ✅ **PRODUCTION READY - DEPLOYED**
**URL**: https://ct.plover.net

---

## Deployment Status

### ✅ Successfully Deployed
- **Frontend**: Vite production build served by Apache from `/home/dave/caltracker/dist/`
- **Backend**: Node.js Express API running on port 3001 (managed by PM2)
- **Database**: SQLite at `/home/dave/caltracker/server/caltrack.db`
- **SSL**: Let's Encrypt certificate installed and auto-renewing
- **API Integration**: FatSecret API configured and working
- **Users**: 4 pre-configured family users ready to use

---

## Critical Fixes Applied

### 1. CORS/API Path Issue (RESOLVED)
**Problem**: Frontend was calling `http://localhost:3001/api` directly, causing CORS errors.

**Root Cause**: Multiple hardcoded `localhost:3001` URLs in source code:
- `src/api/api-client.ts` - Default API_BASE_URL
- `src/api/fatsecret-service.ts` - Default apiUrl
- `src/scripts/views/LoginView.ts` - Hardcoded fetch URL
- `src/.env` - VITE_API_URL environment variable

**Solution**: Changed all default API URLs to use relative path `/api`:
- Updated `api-client.ts`: `API_BASE_URL = '/api'`
- Updated `fatsecret-service.ts`: `apiUrl = '/api'`
- Updated `LoginView.ts`: `fetch('/api/auth/login')`
- Commented out `VITE_API_URL` in `src/.env` (use relative path for production)

**Result**: All API calls now go through Apache proxy, no CORS issues.

### 2. Mobile Responsiveness (RESOLVED)
**Problem**: Date navigation controls were sliding off-screen on mobile devices.

**Root Cause**: Inline styles with fixed widths and no mobile breakpoints.

**Solution**:
- Refactored header to use CSS classes instead of inline styles
- Added `.dashboard-header`, `.date-navigation`, `.date-nav-btn`, `.date-display` classes
- Added mobile-specific CSS with flexbox wrapping
- Date display moves to its own row on mobile (< 767px width)

**Result**: Date navigation is fully responsive and stays on-screen on all devices.

---

## Production Configuration

### Server Environment
- **OS**: Ubuntu Linux
- **Web Server**: Apache 2.4
- **Node.js**: v18+ (managed by PM2)
- **Database**: SQLite (file-based, no server needed)
- **SSL**: Let's Encrypt (auto-renewing)

### Apache Configuration
**File**: `/etc/apache2/sites-available/caltrack.conf`

```apache
<VirtualHost *:80>
    ServerName ct.plover.net
    ServerAdmin admin@plover.net

    # Proxy API requests to Node.js backend (MUST come before rewrite rules)
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    # Serve static frontend files
    DocumentRoot /home/dave/caltracker/dist

    <Directory /home/dave/caltracker/dist>
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

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/caltrack-error.log
    CustomLog ${APACHE_LOG_DIR}/caltrack-access.log combined
</VirtualHost>
```

**Note**: Certbot automatically created the HTTPS (port 443) virtual host.

### Backend Environment Variables
**File**: `/home/dave/caltracker/server/.env`

```env
# Server Configuration
PORT=3001
NODE_ENV=production
JWT_SECRET=<32+ character random string>

# CORS
CORS_ORIGINS=http://ct.plover.net,https://ct.plover.net

# FatSecret API
FATSECRET_CLIENT_ID=<your_client_id>
FATSECRET_CLIENT_SECRET=<your_client_secret>
```

### PM2 Process Management
```bash
# Start backend
cd /home/dave/caltracker/server
pm2 start src/index.js --name caltrack-api

# Auto-start on reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs caltrack-api
```

---

## Pre-configured Users

All users have password: `changeme123`

1. **dad@family.local** - Default calorie goal: 2000 cal/day
2. **tori@family.local** - Default calorie goal: 2000 cal/day
3. **angie@family.local** - Default calorie goal: 2000 cal/day
4. **gabby@family.local** - Default calorie goal: 2000 cal/day

**Security Note**: Users should change passwords after first login (password change feature needs to be implemented).

---

## Features Verified Working

### ✅ Authentication
- Login with pre-configured family users
- JWT token storage and validation
- Auto-logout on 401 errors
- Session persistence across page reloads

### ✅ Food Tracking
- FatSecret API integration (900k+ foods)
- Search for common and branded foods
- Quick-add with serving multipliers ("4 eggs")
- Displays nutrition per actual serving (not per 100g)
- Edit/delete food entries
- Meal type categorization (breakfast/lunch/dinner/snack)
- Duplicate prevention (same food not added twice)

### ✅ Activity Tracking
- Walking, Running, Swimming, Cycling activities
- Calorie burn calculations
- Add/edit/delete activity entries
- Per-day activity log

### ✅ Dashboard
- Daily calorie summary (consumed/burned/remaining)
- Macro tracking (protein/carbs/fat)
- Weekly progress chart (Chart.js)
- Date navigation (← → Today buttons)
- Mobile-responsive layout

### ✅ Weight Tracking
- Record daily weight entries
- Set weight goals
- Track progress over time

---

## Local Development Setup

### Frontend Development
```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# For local dev with backend, uncomment in src/.env:
# VITE_API_URL=http://localhost:3001/api
```

### Backend Development
```bash
cd server
npm install

# Initialize database (creates caltrack.db with 4 users)
npm run init-db

# Start backend (port 3001)
npm start

# Or with auto-restart
npm run dev
```

### Production Build
```bash
# Build frontend
npm run build

# Output: dist/ folder (upload to server)
```

---

## Deployment Checklist

- [x] Build production frontend (`npm run build`)
- [x] Upload `dist/` to `/home/dave/caltracker/dist/`
- [x] Upload `server/` to `/home/dave/caltracker/server/`
- [x] Install backend dependencies (`cd server && npm install`)
- [x] Initialize database (`npm run init-db`)
- [x] Configure environment variables (`server/.env`)
- [x] Start backend with PM2
- [x] Configure Apache virtual host
- [x] Enable Apache modules (proxy, rewrite)
- [x] Install SSL certificate (Certbot)
- [x] Test login
- [x] Test food search/add
- [x] Test mobile responsiveness
- [x] Verify date navigation works
- [x] Verify SSL redirect (HTTP → HTTPS)

---

## Known Limitations / Future Enhancements

### Security
- [ ] Add password change functionality
- [ ] Generate unique JWT_SECRET per deployment
- [ ] Consider rate limiting on API endpoints
- [ ] Add password complexity requirements

### Features
- [ ] Export data (CSV/JSON)
- [ ] Bulk food entry (copy from previous day)
- [ ] Recipe builder (save common meals)
- [ ] Barcode scanner (PWA camera access)
- [ ] Notification reminders (meal logging)
- [ ] Goal history/tracking over time

### UX Improvements
- [ ] Loading states for API calls
- [ ] Offline mode improvements (PWA)
- [ ] Drag-to-reorder food entries
- [ ] Food favorites/recent items
- [ ] Meal templates (save/reuse)

### Technical Debt
- [ ] Add automated tests (unit + integration)
- [ ] Add error boundary components
- [ ] Improve error messages (user-friendly)
- [ ] Consider migrating to simpler architecture (like PokerTracker monolith)
- [ ] Add TypeScript strict mode
- [ ] Add API request caching/deduplication

---

## Architecture Notes

### Current Stack
- **Frontend**: Vite 5 + TypeScript + Vanilla JS (no framework)
- **Backend**: Express.js + better-sqlite3
- **Database**: SQLite (file-based)
- **API**: FatSecret Platform API (free tier: 10,000 req/day)
- **PWA**: Vite PWA plugin (service worker + manifest)
- **Charts**: Chart.js

### Why This Architecture?
The project uses a **client/server split** with SPA frontend and REST API backend. This provides:
- Better UX (instant navigation, no page reloads)
- PWA capabilities (offline mode, app-like feel)
- API reusability (could build mobile app later)

**Trade-off**: More complex than necessary for a family app. Could have been simpler as a server-rendered monolith (like PokerTracker).

### Data Flow
```
User → Browser (SPA) → /api → Apache Proxy → Node.js (port 3001) → SQLite
                                                    ↓
                                            FatSecret API
```

---

## Maintenance

### Database Backups
```bash
# Manual backup
cp /home/dave/caltracker/server/caltrack.db \
   /home/dave/backups/caltrack-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 2 * * * cp /home/dave/caltracker/server/caltrack.db \
          /home/dave/backups/caltrack-$(date +\%Y\%m\%d).db
```

### Update Deployment
```bash
# 1. Build locally
npm run build

# 2. Upload dist/ to server via WinSCP or rsync
rsync -avz dist/ user@ct.plover.net:/home/dave/caltracker/dist/

# 3. If backend changed, restart PM2
pm2 restart caltrack-api
```

### SSL Certificate Renewal
Automatic via Certbot. Verify:
```bash
sudo certbot renew --dry-run
```

### Monitoring
```bash
# Check backend logs
pm2 logs caltrack-api

# Check Apache logs
tail -f /var/log/apache2/caltrack-error.log
tail -f /var/log/apache2/caltrack-access.log

# Check backend status
pm2 status
```

---

## Git Repository

**URL**: https://github.com/ChicagoDave/caltrack
**Branch**: main

### Recent Commits
- Fix CORS issue by using relative API paths
- Add mobile-responsive date navigation
- Complete food UX redesign (serving sizes)
- Add date navigation for daily logs
- Clean up legacy code (removed 2,714 lines)
- Remove exposed API keys from history

---

## Support & Documentation

- **CLAUDE.md**: Comprehensive project documentation for AI assistants
- **DEPLOY-UBUNTU.md**: Step-by-step deployment guide
- **context/work-summary-2025-10-01.md**: Detailed work log
- **context/deployment-summary.md**: This document

---

## Success Metrics

✅ **All deployment goals achieved:**
1. Application accessible at https://ct.plover.net
2. SSL certificate installed and working
3. All 4 family users can log in
4. Food search returns results from FatSecret API
5. Food entries save to database
6. Date navigation works on all devices
7. Mobile-responsive layout (no overflow)
8. Zero console errors
9. API calls work through Apache proxy (no CORS)
10. PWA installable on mobile devices

**Project Status**: COMPLETE ✅
