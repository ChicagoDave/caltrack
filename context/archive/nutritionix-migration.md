# Nutritionix API Migration - September 30, 2025

## Overview
Migrated CalTrack from USDA FoodData Central API to Nutritionix API for food search and nutrition data.

## Nutritionix API Credentials
- **App ID**: `54248873`
- **API Key**: `ccc0b2267eaf2a0e11d1ce0c6f208b62`
- **API Limits**: Free tier = 500 requests/day
- **Documentation**: https://docs.nutritionix.com/

## Changes Made

### 1. New API Integration Files

#### `/src/api/nutritionix-config.ts`
- Configuration for Nutritionix API endpoints
- TypeScript interfaces for API responses:
  - `NutritionixInstantResult` - Search results
  - `NutritionixBrandedFood` - Branded foods with UPC codes
  - `NutritionixCommonFood` - Generic food database entries
  - `NutritionixNaturalResult` - Detailed nutrition from natural language
- Base URL: `https://trackapi.nutritionix.com/v2`
- Endpoints:
  - `/search/instant` - Quick search
  - `/natural/nutrients` - Natural language nutrition lookup

#### `/src/api/nutritionix-service.ts`
- `NutritionixFoodService` class with methods:
  - `searchFoods()` - Search instant endpoint
  - `getNaturalNutrients()` - Get detailed nutrition for common foods
  - `convertBrandedToFoodItem()` - Convert branded food to FoodItem
  - `convertCommonToFoodItem()` - Convert common food (requires extra API call)
  - `searchCombined()` - Search both Nutritionix and local DB
- 7-day caching for performance
- Converts all nutrition to per-100g values

### 2. Updated Files

#### `/src/scripts/views/DashboardView.ts`
- Changed import from `usdaService` to `nutritionixService`
- Updated `performFoodSearch()` to use Nutritionix API
- Updated `displayFoodSearchResults()` parameter names (usda → nutritionix)
- Updated food badge from "USDA" to "NX" (Nutritionix)
- Updated error messages to reference Nutritionix
- Updated `selectFood()` and `quickAddFood()` to handle both 'nutritionix' and 'usda' data sources

#### `/src/types/models.ts`
- Added 'nutritionix' to `data_source` union type
- Now: `'usda' | 'nutritionix' | 'custom' | 'verified'`

#### Environment Variables
- **Root `.env.example`**: Updated to show Nutritionix credentials
- **`/src/.env.example`**: Created with Nutritionix vars (Vite requirement)
- **`/src/.env`**: Created with actual credentials

#### `/CLAUDE.md`
- Updated project overview to mention Nutritionix
- Replaced USDA integration section with Nutritionix details
- Updated environment configuration examples
- Updated common gotchas (rate limits: 500/day)
- Updated database schema notes
- Updated testing checklist
- Added migration note for USDA → Nutritionix

### 3. Legacy Files (Kept for Reference)

These files are no longer used but kept in codebase:
- `/src/api/usda-service.ts` - Original USDA service
- `/src/api/usda-config.ts` - USDA configuration

## How Nutritionix Works

### Food Search Flow
1. User types query in search input (300ms debounce)
2. `nutritionixService.searchCombined(query, localSearchFn)` called
3. Parallel searches:
   - Local database via API (`/api/foods/search`)
   - Nutritionix instant search (`/search/instant`)
4. Nutritionix returns TWO types:
   - **Branded foods**: Have full nutrition data immediately
   - **Common foods**: Need additional `/natural/nutrients` call (limited to 10 to avoid excessive API calls)
5. Results combined and deduplicated by `fdc_id`
6. Display in search results with "NX" badge

### Adding Foods
1. **Quick Add** (from search results):
   - Check if Nutritionix food already saved locally
   - If not: POST `/api/foods/items` with nutrition data
   - Backend checks `usda_fdc_id` to prevent duplicates
   - Save food entry with quantity

2. **Detailed Add** (from form):
   - Select food from results (saves to local DB if needed)
   - Choose meal type and quantity
   - Save food entry

### Nutrition Data Conversion
- All Nutritionix data normalized to per-100g values
- Multiplier calculation: `100 / serving_weight_grams`
- Branded foods: Immediate conversion
- Common foods: Requires natural language API call first

## API Comparison

| Feature | USDA | Nutritionix |
|---------|------|-------------|
| Free Tier | 1000 req/hour | 200 req/day |
| Database Size | 900k+ foods | 900k+ foods |
| Food Types | Foundation, SR Legacy, Branded | Common, Branded |
| Barcode Support | Yes | Yes |
| Natural Language | No | Yes |
| Nutrition Data | Per 100g | Varies (converted to 100g) |
| Authentication | API key only | App ID + API Key |

## Environment Setup

### Frontend (Vite)
```bash
# Must be in /src/.env
VITE_NUTRITIONIX_APP_ID=54248873
VITE_NUTRITIONIX_APP_KEY=ccc0b2267eaf2a0e11d1ce0c6f208b62
```

### Testing Locally
1. Ensure `/src/.env` exists with credentials
2. Restart Vite dev server: `npm run dev`
3. Test food search - should see mix of common and branded foods
4. Check browser console for API responses
5. Verify "NX" badge appears on Nutritionix foods

## Known Limitations

1. **Common Foods**: Require extra API call for full nutrition
   - Limited to 10 common foods per search to conserve API quota
   - Branded foods prioritized (have immediate nutrition data)

2. **API Quota**: 500 requests/day on free tier
   - Each search = 1 request
   - Each common food detail = 1 request
   - Cached for 7 days to reduce usage

3. **Field Mapping**:
   - `usda_fdc_id` field now stores Nutritionix item IDs (not renamed to avoid DB migration)
   - `fdc_id` (deprecated) stores Nutritionix `nix_item_id` or `tag_id`

## Testing Checklist

- [x] Nutritionix API credentials working
- [ ] Search returns both common and branded foods
- [ ] Branded foods have full nutrition data
- [ ] Common foods fetch additional details
- [ ] Deduplication works (no duplicates in results)
- [ ] Foods save to local database with `usda_fdc_id`
- [ ] Quick-add works from search results
- [ ] Detailed add works with meal type selection
- [ ] "NX" badge displays correctly
- [ ] Error handling when API limit reached
- [ ] Cache working (same search doesn't hit API twice within 7 days)

## Migration Benefits

1. **Natural Language Support**: Can search "1 apple" or "chicken breast" naturally
2. **Better Branded Database**: More up-to-date UPC database
3. **Simpler Auth**: Single app ID + key (vs complex USDA setup)
4. **Better API Structure**: Cleaner JSON responses
5. **Photo Support**: Food photos included in results (not yet used in UI)

## Future Enhancements

- [ ] Display food photos from Nutritionix
- [ ] Use natural language for quick add ("I ate 2 eggs")
- [ ] Implement barcode scanning with Nutritionix UPC lookup
- [ ] Add serving size suggestions from `alt_measures`
- [ ] Show food categories/tags in search results
- [ ] Implement smarter caching per user search patterns
