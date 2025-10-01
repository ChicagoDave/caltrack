# CalTrack Work Summary - October 1, 2025

## Major Accomplishments

### 1. Cleaned Up Exposed USDA API Key
- **Issue**: USDA API key `G031aw...` was exposed in commit `f9a6e0c` in `src/api/usda-config.ts`
- **Resolution**:
  - Removed the file from git history (migrated to FatSecret API)
  - Deleted and recreated GitHub repository with clean history
  - Key was already disabled by USDA, no further action needed
- **Commit**: `94334bd` - Clean up legacy code and improve architecture

### 2. Legacy Code Cleanup
Removed deprecated client-side code and consolidated architecture:
- **Deleted**:
  - `DatabaseService.ts` (638 lines) - Unused client-side SQLite
  - `ActivityModal.ts` - Replaced with inline activity UI
  - `FoodModal.ts` - Replaced with inline food search
  - `WorkoutModal.ts` - Removed weight training feature
  - 8 context/documentation files → archived to `context/archive/`
- **Updated Types**:
  - Changed `data_source` from `'usda'/'nutritionix'` to `'fatsecret'`
  - Updated `fdc_id` comment (now FatSecret food ID)
  - Renamed `SearchFilters.includeUSDA` to `includeFatSecret`
- **Result**: Removed 2,714 lines of dead code, cleaner architecture
- **Commits**:
  - `94334bd` - Clean up legacy code
  - `c96e7c1` - Change display format to "Brand - Item"

### 3. Complete Food Tracking UX Redesign
**Problem**: UI forced users to think in "per 100g" terms, making it confusing to add simple items like eggs.

**Solution**: Redesigned to use actual serving sizes from FatSecret API.

#### Changes Made:
- **FatSecret Parser** (`fatsecret-service.ts`):
  - Now stores nutrition PER SERVING (not normalized to 100g)
  - Parses serving descriptions like "Per 1 egg", "Per 1 cup", "Per 100g"
  - Keeps values as-is for non-gram servings
  - Only normalizes gram-based foods to 100g for consistency

- **Search Results Display**:
  - Shows "70 cal/egg" or "150 cal/serving" (not "per 100g")
  - Format: "Brand - Item" (e.g., "Kroger - Large Egg")
  - Displays actual serving units from FatSecret

- **Quick-Add Interface**:
  - Simple multiplier system: "4 × egg" = 4 eggs
  - Shows "×" instead of confusing unit selectors
  - Defaults to quantity "1" for all foods
  - No unit conversion needed

#### User Experience:
**Before**:
```
Search "egg" → see "Large Egg: 350 cal/100g"
Think: "How much does an egg weigh?"
Enter: "50g" for one egg
```

**After**:
```
Search "egg" → see "Kroger - Large Egg: 70 cal/egg"
Enter: "4"
Click Add → Done! (280 calories)
```

**Commits**:
- `af1c588` - Improve serving size handling
- `c74d1c9` - Complete redesign: store and display food by actual serving sizes

### 4. Date Navigation for Daily Logs
Added ability to navigate between days to view/edit past entries:

**Features**:
- Previous/Next day buttons (← →)
- "Today" button to jump back to current date
- Date display shows current viewing date (e.g., "Wednesday, October 1, 2025")
- All data (food entries, activities, stats) loads for selected date
- Weekly chart always shows last 7 days from actual today

**Use Case**: Users can retroactively add forgotten meals or correct entries from previous days.

**Commit**: `77797ab` - Add date navigation for daily food logs

### 5. Deployment Preparation
Created comprehensive deployment guide for Ubuntu server:

**Files Created**:
- `DEPLOY-UBUNTU.md` - Complete step-by-step deployment guide

**Target Environment**:
- Ubuntu server at `ct.plover.net`
- Apache reverse proxy
- PM2 process manager
- Node.js backend (port 3001)
- SQLite database
- Installation path: `~/caltracker` (`/home/dave/caltracker/`)

**Guide Includes**:
- Node.js and PM2 installation
- File upload via WinSCP
- Backend configuration with environment variables
- Apache virtual host setup
- SQLite database initialization (4 pre-configured family users)
- FatSecret API configuration
- Troubleshooting section
- Maintenance commands

**Commits**:
- `adb9137` - Add comprehensive Ubuntu deployment guide
- `5e2901d` - Update deployment paths to ~/caltracker

### 6. Production Build
- Successfully built production frontend with Vite
- Output: `dist/` folder (285KB)
- Includes PWA service worker and manifest
- All assets optimized and ready for deployment

---

## Current Status: Deployment In Progress

### What's Working:
✅ Backend API running on server (PM2)
✅ Backend responding on `http://localhost:3001`
✅ Auth endpoint tested and working (returns JWT tokens)
✅ SQLite database initialized with 4 family users
✅ Apache config created at `/etc/apache2/sites-available/caltrack.conf`
✅ Apache site enabled and proxy modules loaded

### Current Issue: Apache Proxy Not Working
**Symptom**: Frontend shows "NetworkError when attempting to fetch resource"

**Debugging Progress**:
1. ✅ Backend is running: `pm2 status` shows caltrack-api active
2. ✅ Backend responds locally: `curl http://localhost:3001/api/auth/login` works
3. ✅ Apache site enabled: `caltrack.conf` symlinked in sites-enabled
4. ✅ Proxy modules loaded: `proxy_module` and `proxy_http_module` active
5. ❌ Apache proxy not routing correctly: `curl http://ct.plover.net/api/auth/login` returns "Route not found"
6. ❓ Apache logs empty: No entries in `/var/log/apache2/caltrack-error.log`

**Next Steps**:
- Run `sudo apache2ctl -S` to check virtual host configuration
- Check if another virtual host is intercepting requests
- Verify Apache is actually serving from the caltrack.conf
- Check main Apache logs (`/var/log/apache2/error.log` and `access.log`)
- May need to disable default site or adjust virtual host priority

---

## Architecture Notes

### Current Stack:
- **Frontend**: Vite + TypeScript PWA (builds to `dist/`)
- **Backend**: Express.js + SQLite (Node.js, no build step)
- **API**: FatSecret Platform API (free tier: 10,000 requests/day)
- **Database**: SQLite with better-sqlite3
- **Deployment**: Apache reverse proxy → Node.js backend

### Comparison to PokerTracker:
CalTrack uses a **client/server split** (SPA + backend), while PokerTracker is a **monolithic backend** with server-rendered templates.

**CalTrack Architecture**:
- Separate frontend (Vite SPA) and backend (Express API)
- Two `package.json` files (root + server/)
- Frontend builds to `dist/` with Vite
- Backend runs directly from `src/` (no compilation needed)

**Trade-off Discussion**:
- More complex than necessary for a family app
- Could have been built simpler like PokerTracker
- SPA architecture provides better UX but harder deployment
- Offline PWA features not strictly needed for home WiFi usage

---

## Database Notes

### Pre-configured Users:
```
dad@family.local / changeme123
tori@family.local / changeme123
angie@family.local / changeme123
gabby@family.local / changeme123
```

### Database File:
- **Local Dev**: `/mnt/c/repotemp/caltrack/server/caltrack.db`
- **Production**: `~/caltracker/server/caltrack.db`

**Note**: Can copy local database to server to preserve test data.

---

## API Integration

### FatSecret API:
- **Free Tier**: 10,000 requests/day
- **Authentication**: Client ID + Client Secret (OAuth 1.0)
- **Endpoints Used**:
  - `/foods.search` - Search for foods
  - Food data includes serving sizes, calories, macros
- **Data Format**: "Per 1 egg", "Per 100g", "Per 1 serving"

### Environment Variables Required:
```env
# Server Configuration
PORT=3001
NODE_ENV=production
JWT_SECRET=<generate_random_32+_chars>

# CORS
CORS_ORIGINS=http://ct.plover.net,https://ct.plover.net

# FatSecret API
FATSECRET_CLIENT_ID=<your_client_id>
FATSECRET_CLIENT_SECRET=<your_client_secret>
```

---

## File Structure

```
caltracker/
├── dist/                  # Built frontend (served by Apache)
│   ├── index.html
│   ├── assets/
│   ├── sw.js             # Service worker
│   └── manifest.json     # PWA manifest
├── server/               # Backend Node.js application
│   ├── src/
│   │   ├── index.js      # Main server file
│   │   ├── routes/       # API routes
│   │   ├── config/       # Database initialization
│   │   └── middleware/   # JWT auth
│   ├── caltrack.db       # SQLite database
│   ├── .env              # Environment variables
│   └── package.json      # Backend dependencies
├── src/                  # Frontend source (not deployed)
├── package.json          # Frontend build config
└── DEPLOY-UBUNTU.md      # Deployment guide
```

---

## Key Features Implemented

1. **Multi-user Authentication**
   - JWT-based auth
   - 4 pre-configured family users
   - Per-user data isolation

2. **Food Tracking**
   - FatSecret API integration (900k+ foods)
   - Inline search with real-time results
   - Quick-add with serving multipliers
   - Detailed add with meal type selection
   - Edit/delete existing entries
   - Deduplication (prevents adding same food twice)

3. **Macro Tracking**
   - Protein, carbs, fat tracking
   - Daily macro goals per user
   - Protein recommendations when low
   - Visual progress indicators

4. **Activity Tracking**
   - Walking (steps), Running (miles), Swimming (laps), Cycling (minutes)
   - Calorie burn calculations
   - Add/view activities per day

5. **Weight Tracking**
   - Record daily weight
   - Set weight goals
   - Track progress over time

6. **Daily Dashboard**
   - Calories consumed vs. burned vs. remaining
   - Macro breakdown
   - Weekly progress chart (Chart.js)
   - Date navigation (view past days)
   - Today's food and activity log

7. **Data Persistence**
   - All data stored in SQLite
   - Navigate between days to view/edit past entries
   - Database can be copied/backed up easily

---

## Known Issues / TODO

1. **Apache Proxy Issue** (Current blocker)
   - Apache not routing `/api` requests to backend
   - Need to debug virtual host configuration

2. **Security Hardening**
   - Change default user passwords after first login
   - Generate strong JWT_SECRET (32+ chars)
   - Consider adding rate limiting
   - Set up SSL certificate (optional)

3. **FatSecret API Keys**
   - Need to obtain production API keys
   - Update server `.env` with real credentials
   - Free tier: 10,000 requests/day

4. **Documentation**
   - Update DEPLOYMENT.md (currently outdated with PostgreSQL references)
   - DEPLOY-UBUNTU.md is current and accurate

---

## Git Status

**Repository**: https://github.com/ChicagoDave/caltrack
**Branch**: main
**Latest Commit**: `5e2901d` - Update deployment paths to ~/caltracker

**Recent Commits**:
- `77797ab` - Add date navigation for daily food logs
- `c74d1c9` - Complete redesign: store and display food by actual serving sizes
- `af1c588` - Improve serving size handling for food entries
- `c96e7c1` - Change food search display format to "Brand - Item"
- `94334bd` - Clean up legacy code and improve architecture
- `3ada678` - Initial commit (clean history, no exposed keys)

---

## Next Session Goals

1. **Resolve Apache proxy issue**
   - Get `/api` requests routing to backend
   - Verify frontend can communicate with API

2. **Test full deployment**
   - Login with family users
   - Add food items (verify FatSecret API)
   - Add activities
   - Navigate between days
   - Verify data persistence

3. **Production configuration**
   - Obtain FatSecret API keys
   - Generate secure JWT_SECRET
   - Set up regular database backups
   - Consider SSL certificate setup

4. **Optional improvements**
   - Simplify architecture (consider refactoring to PokerTracker-style monolith)
   - Add user password change functionality
   - Improve mobile responsiveness
   - Add export functionality (CSV/JSON)
