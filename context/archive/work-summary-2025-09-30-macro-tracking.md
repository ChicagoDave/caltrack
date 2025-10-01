# Work Summary: Macro Tracking & API Cleanup - September 30, 2025

## Overview
Added comprehensive macro tracking (protein, carbs, fat), protein recommendations, and cleaned up the codebase by removing USDA and Nutritionix APIs in favor of FatSecret only.

## Major Features Added

### 1. Macro Tracking & Goals

#### Database Migration
Added daily macro goals to users table:
- `daily_protein_goal` (default: 150g)
- `daily_carbs_goal` (default: 200g)
- `daily_fat_goal` (default: 65g)
- `daily_burn_goal` (default: 0 calories)

**File:** `/server/migrate-add-macro-goals.js`
```javascript
db.exec(`ALTER TABLE users ADD COLUMN daily_protein_goal INTEGER DEFAULT 150;`);
db.exec(`ALTER TABLE users ADD COLUMN daily_carbs_goal INTEGER DEFAULT 200;`);
db.exec(`ALTER TABLE users ADD COLUMN daily_fat_goal INTEGER DEFAULT 65;`);
db.exec(`ALTER TABLE users ADD COLUMN daily_burn_goal INTEGER DEFAULT 0;`);
```

#### Backend API Updates
Updated daily summary endpoint to return macro goals:

**File:** `/server/src/routes/stats.js`
```javascript
const user = db.prepare(`
  SELECT daily_calorie_goal, daily_protein_goal, daily_carbs_goal,
         daily_fat_goal, daily_burn_goal
  FROM users WHERE id = ?
`).get(userId);

const summary = {
  // ... existing fields
  macro_goals: {
    protein_g: user.daily_protein_goal,
    carbs_g: user.daily_carbs_goal,
    fat_g: user.daily_fat_goal
  },
  burn_goal: user.daily_burn_goal,
  // ...
};
```

#### Dashboard UI Updates
Added macro display to dashboard:

**File:** `/src/scripts/views/DashboardView.ts`

**Top Grid (Calories):**
- Consumed
- Burned (with optional goal display)
- Net
- Remaining

**Bottom Grid (Macros):**
```html
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
  <div>Protein: ${protein}g of ${proteinGoal}g</div>
  <div>Carbs: ${carbs}g of ${carbsGoal}g</div>
  <div>Fat: ${fat}g of ${fatGoal}g</div>
</div>
```

Colors:
- Protein: Red (#e74c3c)
- Carbs: Blue (#3498db)
- Fat: Orange (#f39c12)

### 2. Protein Recommendations

Added smart protein suggestions when user is >30g below goal:

**File:** `/src/scripts/views/DashboardView.ts`
```typescript
if (proteinRemaining > 30) {
  const suggestions = [
    { name: 'Chicken Breast (100g)', protein: '31g', calories: '165 cal' },
    { name: 'Greek Yogurt (170g)', protein: '17g', calories: '100 cal' },
    { name: 'Protein Shake', protein: '25g', calories: '120 cal' },
    { name: 'Tuna (100g)', protein: '30g', calories: '132 cal' },
    { name: 'Eggs (2 large)', protein: '13g', calories: '140 cal' }
  ];
  // Display yellow alert box with suggestions
}
```

Displays after food entries list with:
- Yellow background (#fff3cd)
- "💪 You need ${proteinRemaining}g more protein today"
- List of high-protein food suggestions

### 3. FatSecret API Integration & Cleanup

#### Removed APIs
- ❌ USDA FoodData Central (429 rate limit issues)
- ❌ Nutritionix (200 req/day too restrictive)
- ✅ **FatSecret only** (10,000 req/day)

#### Files Removed
```bash
/src/api/usda-service.ts
/src/api/usda-config.ts
/src/api/nutritionix-service.ts
/src/api/nutritionix-config.ts
```

#### Backend Proxy Implementation
**File:** `/server/src/routes/fatsecret.js`

Created backend proxy to handle FatSecret OAuth2 and avoid CORS:
```javascript
// OAuth2 client credentials flow
async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  // Cache token for 90% of expiry time
}

// Search endpoint
router.post('/search', async (req, res) => {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    method: 'foods.search',  // Basic API (not v3 - premier only)
    search_expression: query,
    max_results: String(maxResults),
    format: 'json'
  });
  // Proxy request to FatSecret
});
```

**Key Points:**
- OAuth2 token cached in memory with automatic refresh
- Uses `foods.search` (basic scope) instead of `foods.search.v3` (premier)
- Backend handles all API credentials securely
- Frontend makes simple POST to `/api/fatsecret/search`

#### Nutrition Value Parsing

FatSecret returns descriptions like:
```
"Per 1 serving - Calories: 450kcal | Fat: 19.00g | Carbs: 45.00g | Protein: 28.00g"
```

**File:** `/src/api/fatsecret-service.ts`
```typescript
convertToFoodItem(fsFood: FatSecretFood): FoodItem {
  const description = fsFood.food_description || '';

  // Parse with regex
  const caloriesMatch = description.match(/Calories:\s*(\d+)kcal/i);
  const proteinMatch = description.match(/Protein:\s*([\d.]+)g/i);
  // ... etc

  // Store as-is (per serving), mark as 100g for display logic
  return {
    calories_per_100g: Math.round(calories),
    protein_g: Math.round(protein * 10) / 10,
    serving_size_g: 100,  // Default since we don't know actual weight
    serving_size_unit: servingUnit,
    // ...
  };
}
```

**Brand Display:**
```typescript
const displayName = fsFood.brand_name
  ? `${fsFood.food_name} (${fsFood.brand_name})`
  : fsFood.food_name;
```

Example: "Spicy Chicken Sandwich (Chick-fil-A)"

#### IP Whitelisting Required
FatSecret requires IP whitelisting in dashboard:
1. Go to https://platform.fatsecret.com/
2. App Settings → Add server IP: `76.150.199.4`

### 4. Bug Fixes

#### JSON Parsing Error
**Problem:** Food names with apostrophes (like "Chick-fil-A") broke JSON parsing in `data-food` HTML attributes.

**Fix:** Escape quotes when embedding, unescape when reading
```typescript
// When creating HTML
data-food='${JSON.stringify(food).replace(/'/g, "&apos;")}'

// When parsing
JSON.parse(foodData.replace(/&apos;/g, "'"))
```

**Files Changed:**
- `/src/scripts/views/DashboardView.ts` (lines 714, 743, 758)

### 5. Removed Features

#### Per-User API Keys
Removed the per-user API key management feature (no longer needed with FatSecret):
- ❌ "⚙️ API Keys" button in header
- ❌ Settings modal (`openSettingsModal()` method)
- ❌ `nutritionix_app_id` and `nutritionix_app_key` columns (kept in DB but unused)
- ❌ API key update routes

**Reasoning:** Single FatSecret account with 10,000 req/day is sufficient for family of 4.

#### Environment Variables Cleanup
**Before:**
```bash
VITE_USDA_API_KEY=DEMO_KEY
VITE_NUTRITIONIX_APP_ID=54248873
VITE_NUTRITIONIX_APP_KEY=ccc0b2267eaf2a0e11d1ce0c6f208b62
VITE_FATSECRET_CLIENT_ID=7e1e07fb85364007b8481197e6ef5b99
VITE_FATSECRET_CLIENT_SECRET=e28730a6b0b04bedaf4e6acff1d6de41
VITE_API_URL=http://localhost:3001/api
```

**After:**
```bash
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
```

**File:** `/src/vite-env.d.ts`
```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
```

All API credentials now stored in `/server/.env` only:
```bash
FATSECRET_CLIENT_ID=7e1e07fb85364007b8481197e6ef5b99
FATSECRET_CLIENT_SECRET=e28730a6b0b04bedaf4e6acff1d6de41
```

## Files Created

### Backend
- `/server/migrate-add-macro-goals.js` - Database migration for macro goals
- `/server/src/routes/fatsecret.js` - FatSecret OAuth2 proxy

### Frontend
- `/src/api/fatsecret-service.ts` - FatSecret API client (proxied)
- `/src/api/fatsecret-config.ts` - FatSecret TypeScript interfaces

### Database
- `/server/add-chickfila.js` - Script to manually add Chick-fil-A Spicy Chicken Sandwich

## Files Modified

### Backend
- `/server/src/index.js` - Added FatSecret routes
- `/server/src/routes/stats.js` - Added macro_goals and burn_goal to daily summary
- `/server/.env` - Added FatSecret credentials

### Frontend
- `/src/scripts/views/DashboardView.ts` - Major updates:
  - Added macro display grid
  - Added protein recommendations
  - Removed USDA/Nutritionix imports
  - Removed API keys settings modal
  - Fixed JSON parsing bug
  - Cleaned up debug logs
- `/src/.env` - Removed all API credentials
- `/src/vite-env.d.ts` - Removed API credential types

## Files Deleted
- `/src/api/usda-service.ts`
- `/src/api/usda-config.ts`
- `/src/api/nutritionix-service.ts`
- `/src/api/nutritionix-config.ts`

## Database Schema Changes

### Users Table (Added Columns)
```sql
ALTER TABLE users ADD COLUMN daily_protein_goal INTEGER DEFAULT 150;
ALTER TABLE users ADD COLUMN daily_carbs_goal INTEGER DEFAULT 200;
ALTER TABLE users ADD COLUMN daily_fat_goal INTEGER DEFAULT 65;
ALTER TABLE users ADD COLUMN daily_burn_goal INTEGER DEFAULT 0;
```

### Food Items Table (Already Had These)
- `protein_g REAL DEFAULT 0`
- `carbs_g REAL DEFAULT 0`
- `fat_g REAL DEFAULT 0`
- `fiber_g REAL DEFAULT 0`

### Food Entries Table (Already Had These)
- `protein_g REAL DEFAULT 0`
- `carbs_g REAL DEFAULT 0`
- `fat_g REAL DEFAULT 0`
- `fiber_g REAL DEFAULT 0`

## API Architecture

### Before (Multi-Source)
```
Frontend → USDA API (1000/hr, 429 errors)
        → Nutritionix API (200/day, too restrictive)
        → FatSecret API (CORS errors)
```

### After (Single Source)
```
Frontend → Backend Proxy → FatSecret API (10,000/day)
        ↓
    Local Database (previously saved foods)
```

## Search Flow

1. **User types query** (300ms debounce)
2. **Parallel searches:**
   - Local database (`/api/foods/search`)
   - FatSecret via proxy (`/api/fatsecret/search`)
3. **Results combined:**
   - Local results shown first
   - FatSecret results with "FS" badge
   - Exact matches prioritized
4. **Display:**
   - Nutrition shown per actual serving size
   - Quick-add defaults to serving size
   - Macros (P/C/F) displayed

## Macro Tracking Summary

### Default Goals (Based on 2000 cal diet)
- **Protein:** 150g (30% of calories, 4 cal/g = 600 cal)
- **Carbs:** 200g (40% of calories, 4 cal/g = 800 cal)
- **Fat:** 65g (30% of calories, 9 cal/g = 585 cal)
- **Total:** ~1985 calories

### Dashboard Display
**Top Row:**
- Consumed: 450 calories
- Burned: 0 of 0 calories
- Net: 450 calories
- Remaining: 1550 of 2000

**Bottom Row:**
- Protein: 28g of 150g (🔴 Red)
- Carbs: 45g of 200g (🔵 Blue)
- Fat: 19g of 65g (🟠 Orange)

### Protein Recommendations
Triggers when >30g below goal:
- Shows yellow alert box
- Lists 5 high-protein foods
- Displays protein and calories for each

## Testing Checklist

- [x] FatSecret search returns results
- [x] Food names with apostrophes parse correctly
- [x] Macro totals display correctly
- [x] Macro goals display correctly
- [x] Protein recommendations show when low
- [x] FatSecret badge shows on search results
- [x] Backend proxy handles OAuth2
- [x] IP whitelisting configured
- [ ] Test with multiple users
- [ ] Verify 10k/day quota is sufficient

## Known Issues / Limitations

1. **FatSecret Serving Sizes:**
   - Basic API doesn't provide serving size in grams
   - All items stored as "per serving" with 100g default
   - Display shows "per serving" instead of actual weight

2. **IP Whitelisting:**
   - Requires manual configuration in FatSecret dashboard
   - If server IP changes, must update whitelist

3. **Nutrition Parsing:**
   - Relies on regex parsing of description strings
   - Some nutrients (fiber, sugar, sodium) may be missing
   - More brittle than structured JSON responses

## Future Enhancements

- [ ] Add macro goals to settings UI (currently defaults only)
- [ ] Add macro breakdown chart/visualization
- [ ] Add macro % of calories display
- [ ] Show macro progress bars
- [ ] Add "macro-friendly" food suggestions (low carb, high protein, etc.)
- [ ] Add weekly macro trends
- [ ] Implement FatSecret `food.get` endpoint for detailed serving sizes
- [ ] Add fiber tracking to daily summary
- [ ] Create macro planning tools (meal prep)

## Migration Notes

### To Run Migrations
```bash
cd server
node migrate-add-macro-goals.js
```

### To Add Sample Data
```bash
node add-chickfila.js
```

### Backend Restart Required
After adding FatSecret routes:
```bash
pkill -f "node src/index.js"
npm start
```

### Frontend Restart Required
After removing USDA/Nutritionix imports:
```bash
# Vite will auto-reload
```

## Performance Impact

### Removed:
- 2 API service files (~500 lines)
- 1 settings modal (~70 lines)
- Multiple environment variables
- Debug console.logs

### Added:
- 1 backend proxy route (~130 lines)
- Macro display UI (~30 lines)
- Protein recommendations (~30 lines)
- Database migration

**Net Result:** Cleaner, simpler codebase with better UX

## Security Improvements

### Before
- API credentials in frontend `.env`
- Exposed in browser network requests
- Per-user credentials in localStorage

### After
- All credentials in backend `.env` only
- Frontend never sees API keys
- Backend proxy handles all external API calls

## Quota Management

### FatSecret Free Tier: 10,000 req/day

**Usage Estimation:**
- Average search: 1 request
- Family of 4 users
- ~20 searches per person per day
- Total: ~80 searches/day
- **Well within quota** (0.8% of daily limit)

### Caching Strategy
- 30-day cache duration
- Reduces duplicate requests
- Cache key: `search_${query}_${maxResults}`

## Success Metrics

✅ **Simplified API management:** 3 APIs → 1 API
✅ **Improved quota:** 200/day/user → 10,000/day shared
✅ **Better security:** Backend-only credentials
✅ **Enhanced UX:** Macro tracking + protein recommendations
✅ **Code quality:** Removed 500+ lines of unused code
✅ **Bug fixes:** JSON parsing errors resolved

## Summary

This work session successfully:
1. Added comprehensive macro tracking to CalTrack
2. Implemented intelligent protein recommendations
3. Consolidated to single food API (FatSecret)
4. Improved security by moving credentials to backend
5. Fixed JSON parsing bugs
6. Cleaned up codebase significantly

The app now provides much better nutrition tracking for users while being simpler to maintain and more secure.
