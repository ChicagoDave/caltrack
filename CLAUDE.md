# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CalTrack is a mobile-friendly calorie and activity tracking web application with:
- **Frontend**: Vite + TypeScript PWA with Chart.js visualization
- **Backend**: Express.js + SQLite (migrated from PostgreSQL)
- **Nutritionix Integration**: 900k+ foods via Nutritionix API (common + branded foods)
- **Multi-user**: JWT-based authentication with 4 pre-configured family users

## Development Commands

### Frontend (from root)
```bash
npm run dev          # Start Vite dev server on port 3000 (configured in vite.config.ts)
npm run build        # TypeScript compile + Vite build → dist/
npm run preview      # Preview production build
npm run typecheck    # Run TypeScript type checking only
npm run lint         # ESLint check
```

### Backend (from server/)
```bash
npm start            # Start Express server on port 3001
npm run dev          # Start with nodemon (auto-restart)
npm run init-db      # Initialize SQLite database with schema
npm run build        # Echo message (no build step needed for Node.js)
```

### Both Services
Start both frontend and backend in separate terminals for full local development.

## Architecture Overview

### Authentication Flow
1. **LoginView** (`src/scripts/views/LoginView.ts`): User selection screen with 4 hardcoded family users
2. On user click → POST `/api/auth/login` → receives JWT token
3. Token stored in `localStorage` as `caltrack_token`
4. **ApiClient** (`src/api/api-client.ts`) injects token in `Authorization: Bearer <token>` header
5. On 401 response → clears localStorage and reloads (back to login)

### State Management
- **CalTrackApp** (`src/scripts/core/CalTrackApp.ts`): Main controller managing app state
- **AppState** interface: `{ user, isAuthenticated, currentDate, syncStatus }`
- Session persistence via localStorage (`caltrack_token`, `caltrack_user`)
- No global state library—simple instance-based state passing

### Data Flow
```
DashboardView → ApiClient → Express Routes → SQLite Database
                    ↓
              USDA API Service (external)
```

**Critical**: All data operations go through `apiClient` (src/api/api-client.ts), NOT the legacy `DatabaseService` (client-side SQLite is deprecated but code remains).

### Database Layer

**Server-Side (Active)**:
- SQLite database at `server/caltrack.db`
- Managed via `better-sqlite3`
- Schema in `server/src/config/init-db.js`
- Tables: `users`, `food_items`, `food_entries`, `activities`, `activity_entries`, `weight_entries`, `weight_goals`

**Client-Side (Deprecated)**:
- `src/scripts/db/DatabaseService.ts` still exists but is NOT USED
- Originally used sql.js with IndexedDB—kept for reference only
- Do not extend or use this service

### API Structure

**Backend Routes** (all prefixed with `/api`):
- `/auth/login`, `/auth/register` - JWT authentication
- `/users/me` - User profile (GET/PUT)
- `/foods/entries/:date`, `/foods/search`, `/foods/items` - Food CRUD
- `/activities/entries/:date` - Activity CRUD
- `/weight/entries`, `/weight/goal` - Weight tracking
- `/stats/daily/:date`, `/stats/weekly`, `/stats/progress` - Statistics

**API Client Methods**: See `src/api/api-client.ts` for full type-safe API interface.

### Nutritionix Food Integration

**Service**: `src/api/nutritionix-service.ts`

**Current Implementation**: DashboardView uses Nutritionix API via service
- API Credentials: `VITE_NUTRITIONIX_APP_ID` and `VITE_NUTRITIONIX_APP_KEY` in `.env` (must be in `/src/.env` for Vite)
- Two food types: **Common foods** (generic database) and **Branded foods** (UPC/barcode database)
- Deduplication: Filters local foods with matching `fdc_id` from Nutritionix results
- Backend: Saves Nutritionix foods with `usda_fdc_id` field to prevent duplicates

**Nutritionix API Endpoints**:
- `/search/instant` - Quick search for common and branded foods
- `/natural/nutrients` - Get detailed nutrition for common foods using natural language

**Important**: When adding Nutritionix foods:
1. Frontend searches Nutritionix API + local database via `nutritionixService.searchCombined()`
2. Branded foods have full nutrition data immediately
3. Common foods require additional `/natural/nutrients` call for details
4. User quick-adds or selects food
5. If Nutritionix food: POST `/api/foods/items` with `usda_fdc_id` (contains Nutritionix item ID)
6. Backend checks for existing `usda_fdc_id` before INSERT
7. Returns existing item if duplicate found

**API Limits**: Free tier = 200 requests/day per API key

## Key Design Patterns

### Modal Components
Each modal extends a base pattern:
- Constructor: Takes parent element and callback
- `render()`: Creates modal HTML structure
- Event delegation on modal container (not individual elements)
- Use `querySelector` scoped to modal element for event listeners

Example:
```typescript
this.modalElement.querySelector('#submitBtn')?.addEventListener('click', async () => {
  // Handle submission
});
```

### View Rendering
- **DashboardView.render(container)**: Fully replaces container.innerHTML
- **LoginView.render()**: Replaces parent container
- Always call `render()` before attaching additional event listeners
- Modals append to body, views replace containers

### Food Entry Workflow
1. **Quick Add** (inline search results):
   - Search query → results appear
   - Adjust quantity in result row → click "Add"
   - Defaults to "snack" meal type

2. **Detailed Add** (form below search):
   - Click food name → populates form
   - Set meal type, quantity → "Add Food"

3. **Edit**: Click "Edit" on entry → modal with quantity/meal type
4. **Delete**: Click "Del" → confirm → DELETE request

## Environment Configuration

### Frontend (`.env` or `src/.env`)
```bash
# IMPORTANT: Must be in /src/.env for Vite to load it
VITE_NUTRITIONIX_APP_ID=54248873  # Your Nutritionix App ID
VITE_NUTRITIONIX_APP_KEY=your_key_here  # Your Nutritionix API Key
VITE_API_URL=http://localhost:3001/api  # Optional, defaults to this
```

**Vite Requirements**:
- All env vars MUST start with `VITE_` to be exposed to client
- Access via `import.meta.env.VITE_VARIABLE_NAME`
- Must restart dev server after `.env` changes

### Backend (`server/.env`)
```bash
PORT=3001
JWT_SECRET=random_secret_here
# SQLite - no DB connection vars needed
```

## Common Gotchas

1. **Nutritionix API Rate Limits**: Free tier = 200 req/day per API key. Per-user API keys supported - each family member can add their own keys for 200 req/day each (800 total across 4 users). Show warning on error but continue with local results.

2. **Duplicate Foods**: Always check `usda_fdc_id` before inserting Nutritionix foods. Frontend deduplicates by filtering local items where `fdc_id` matches Nutritionix results.

3. **Meal Type Options**: `breakfast | lunch | dinner | snack` (hardcoded, not configurable)

4. **Activity Calories Calculation**:
   - Walking: 0.04 cal/step
   - Running: 100 cal/mile
   - Swimming: 50 cal/lap
   - Cycling: 8 cal/minute
   - Stored in `ActivityModal.ts` component

5. **Date Handling**:
   - Frontend: JavaScript Date objects
   - API: ISO date strings (YYYY-MM-DD)
   - SQLite: Stored as TEXT in ISO format

6. **Path Aliases** (vite.config.ts):
   - `@/` → `src/`
   - `@api/` → `src/api/`
   - `@types/` → `src/types/`
   - Use these in imports

## Database Schema Notes

**Food Items**:
- `usda_fdc_id`: Links to Nutritionix item ID or USDA FoodData Central (NULL for custom)
- `fdc_id`: Deprecated field, now stores Nutritionix item ID
- `is_custom`: Boolean (0 = Nutritionix/USDA/verified, 1 = user-created)
- `data_source`: 'nutritionix' | 'usda' | 'custom' | 'verified'

**Food Entries**:
- Denormalized nutrition data (calories, macros stored in entry)
- `quantity_g`: Grams consumed
- Always joined with `food_items` for display

**Users**:
- 4 pre-configured: `dad@family.local`, `tori@family.local`, `angie@family.local`, `gabby@family.local`
- All passwords: `changeme123`
- Each has `daily_calorie_goal` (defaults 2000)

## Testing

Currently no automated tests. Manual testing checklist:
1. Login with each user
2. Search Nutritionix foods (verify no duplicates, both common and branded appear)
3. Quick-add food from search
4. Detailed add with meal type
5. Edit food entry (quantity/meal type)
6. Delete food entry (with confirmation)
7. Add activity (each type)
8. Set weight + goal
9. Verify dashboard summary updates
10. Check weekly chart renders

## Migration Notes (for reference)

**PostgreSQL → SQLite** (completed):
- Changed from `pg` to `better-sqlite3`
- No connection pooling needed (file-based)
- Synchronous queries (removed async/await from DB calls)
- Database file: `server/caltrack.db`

**Client-Side SQLite → API** (completed):
- Removed sql.js dependency (still in package.json for legacy reference)
- All data operations via REST API
- DatabaseService.ts kept but unused

**USDA → Nutritionix API** (completed):
- Replaced USDA FoodData Central with Nutritionix API
- New service: `nutritionix-service.ts` replaces `usda-service.ts` (kept for reference)
- Supports both common foods (generic) and branded foods (UPC database)
- Common foods require additional API call for full nutrition data
- Free tier: 500 requests/day (vs USDA's 1000/hour)

## Deployment

See `DEPLOYMENT.md` for Ubuntu/Apache setup. Key points:
- Apache serves static files from `/dist`
- Apache proxies `/api` to Node.js (port 3001)
- PM2 manages Node.js process
- SQLite database file must be writable by Node.js process
- No PostgreSQL needed (docs outdated, ignore PostgreSQL references)

## File Organization

```
src/
├── api/                    # API clients
│   ├── api-client.ts      # Main REST client (USE THIS)
│   ├── nutritionix-service.ts  # Nutritionix API (ACTIVE)
│   └── usda-service.ts    # USDA API (legacy, kept for reference)
├── scripts/
│   ├── core/              # App controller
│   ├── views/             # LoginView, DashboardView
│   ├── components/        # Modals (Food, Activity, Weight)
│   └── db/                # DatabaseService (DEPRECATED)
├── types/models.ts        # TypeScript interfaces
└── styles/main.css        # All styles (no CSS modules)

server/
├── src/
│   ├── config/            # Database init
│   ├── routes/            # Express routes
│   └── middleware/        # JWT auth
└── caltrack.db            # SQLite database file
```

## Future Development Notes

When adding features:
- New API endpoints: Add route in `server/src/routes/`, register in `server/src/index.js`
- New API methods: Add to `ApiClient` class in `src/api/api-client.ts`
- New views: Extend pattern in `src/scripts/views/`, update `CalTrackApp` routing
- New modals: Follow `ActivityModal.ts` pattern with event delegation
- Types: Update `src/types/models.ts` for any schema changes
