# FatSecret API Integration - September 30, 2025

## Overview
Expanded CalTrack's food search to use **multi-source aggregation** across three APIs to maximize quota and food coverage. Added FatSecret Platform API as the third data source alongside USDA and Nutritionix.

## Problem Solved
Nutritionix free tier (200 req/day per user) was insufficient for family usage. Even with 4 users (800/day total), the quota was too limiting. Solution: Aggregate multiple food databases in parallel.

## Multi-Source Strategy

### API Quota Breakdown
| API | Free Tier Limit | Best For |
|-----|----------------|----------|
| **USDA FoodData Central** | 1,000 req/hour | Generic/foundation foods |
| **FatSecret Platform** | 10,000 req/day | Highest quota, broad coverage |
| **Nutritionix** | 200 req/day/user (800 total) | Branded/restaurant items |

**Total Daily Quota**: ~10,800 requests/day + 1,000/hour from USDA

## FatSecret API Credentials
- **Client ID**: `7e1e07fb85364007b8481197e6ef5b99`
- **Client Secret**: `e28730a6b0b04bedaf4e6acff1d6de41`
- **Authentication**: OAuth2 Client Credentials Flow
- **Documentation**: https://platform.fatsecret.com/api/

## Changes Made

### 1. New FatSecret Integration Files

#### `/src/api/fatsecret-config.ts`
```typescript
export const FATSECRET_CONFIG = {
  BASE_URL: 'https://platform.fatsecret.com/rest/server.api',
  CLIENT_ID: import.meta.env.VITE_FATSECRET_CLIENT_ID || '7e1e07fb85364007b8481197e6ef5b99',
  CLIENT_SECRET: import.meta.env.VITE_FATSECRET_CLIENT_SECRET || 'e28730a6b0b04bedaf4e6acff1d6de41',
  OAUTH_URL: 'https://oauth.fatsecret.com/connect/token',
  CACHE_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
};
```

**TypeScript Interfaces**:
- `FatSecretSearchResult` - Search response wrapper
- `FatSecretFood` - Individual food item from search
- `FatSecretFoodDetail` - Detailed food with servings
- `FatSecretServing` - Serving size with nutrition data

#### `/src/api/fatsecret-service.ts`
```typescript
export class FatSecretFoodService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async getAccessToken(): Promise<string> {
    // OAuth2 client credentials flow with token caching
    // Token cached for 90% of expiry time
  }

  async searchFoods(query: string, maxResults: number = 20): Promise<FatSecretSearchResult>

  convertToFoodItem(fsFood: FatSecretFood): FoodItem {
    // Parse nutrition from description string
    // Example: "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 5.00g"
  }
}
```

**Key Features**:
- OAuth2 token management with automatic refresh
- 30-day aggressive caching to minimize API calls
- Parses nutrition from FatSecret's description strings using regex
- Converts all nutrition to per-100g standard format
- Supports both per-serving and per-100g conversions

### 2. Re-enabled USDA Service

#### `/src/scripts/views/DashboardView.ts`
```typescript
// Re-imported usdaService (was commented out)
import { usdaService } from '@/api/usda-service';
import { fatSecretService } from '@/api/fatsecret-service';

private async searchUSDA(query: string): Promise<FoodItem[]> {
  const results = await usdaService.searchFoods(query, 10);
  return results.foods.map(food => usdaService.convertToFoodItem(food));
}

private async searchFatSecret(query: string): Promise<FoodItem[]> {
  const results = await fatSecretService.searchFoods(query, 10);
  if (!results.foods?.food) return [];
  const foods = Array.isArray(results.foods.food)
    ? results.foods.food
    : [results.foods.food];
  return foods.map(food => fatSecretService.convertToFoodItem(food));
}
```

### 3. Parallel Multi-Source Search

#### `/src/scripts/views/DashboardView.ts` - Updated `performFoodSearch()`
```typescript
private async performFoodSearch(query: string): Promise<void> {
  // Search all 3 APIs in parallel + local DB
  const [usdaResults, fatSecretResults, nutritionixResults] = await Promise.all([
    this.searchUSDA(query),
    this.searchFatSecret(query),
    nutritionixService.searchCombined(query, localSearchFn)
  ]);

  // Combine external results
  const allExternalResults = [
    ...usdaResults,
    ...fatSecretResults,
    ...nutritionixResults.nutritionix
  ];

  // Display with deduplication
  this.displayFoodSearchResults(nutritionixResults.local, allExternalResults);
}
```

**Benefits**:
- All API calls happen simultaneously (no sequential delays)
- User sees combined results from all sources
- Automatic deduplication by food name/ID
- Fallback if any single API fails

### 4. Updated Environment Variables

#### `/src/.env`
```bash
# USDA FoodData Central API (1000 req/hour)
VITE_USDA_API_KEY=DEMO_KEY

# Nutritionix API Credentials (200 req/day per user)
VITE_NUTRITIONIX_APP_ID=54248873
VITE_NUTRITIONIX_APP_KEY=ccc0b2267eaf2a0e11d1ce0c6f208b62

# FatSecret Platform API (10,000 req/day)
VITE_FATSECRET_CLIENT_ID=7e1e07fb85364007b8481197e6ef5b99
VITE_FATSECRET_CLIENT_SECRET=e28730a6b0b04bedaf4e6acff1d6de41

# Application Settings
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
```

#### `/src/vite-env.d.ts`
```typescript
interface ImportMetaEnv {
  readonly VITE_USDA_API_KEY: string;
  readonly VITE_NUTRITIONIX_APP_ID: string;
  readonly VITE_NUTRITIONIX_APP_KEY: string;
  readonly VITE_FATSECRET_CLIENT_ID: string;
  readonly VITE_FATSECRET_CLIENT_SECRET: string;
  readonly VITE_API_URL: string;
}
```

### 5. Updated Type Definitions

#### `/src/types/models.ts`
```typescript
data_source?: 'usda' | 'nutritionix' | 'fatsecret' | 'custom' | 'verified';
```

Added 'fatsecret' to data_source union type for proper TypeScript support.

## Technical Implementation Details

### OAuth2 Client Credentials Flow (FatSecret)

1. **Token Request**:
   ```typescript
   const credentials = btoa(`${clientId}:${clientSecret}`);
   POST https://oauth.fatsecret.com/connect/token
   Headers: Authorization: Basic ${credentials}
   Body: grant_type=client_credentials&scope=basic
   ```

2. **Token Caching**:
   - Token cached in memory (not localStorage)
   - Cached for 90% of `expires_in` time
   - Automatic refresh when expired

3. **API Requests**:
   ```typescript
   GET https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=chicken
   Headers: Authorization: Bearer ${access_token}
   ```

### Nutrition Parsing from FatSecret

FatSecret returns nutrition in description strings:
```
"Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 5.00g"
```

Parse using regex:
```typescript
const caloriesMatch = description.match(/Calories:\s*(\d+)kcal/i);
const fatMatch = description.match(/Fat:\s*([\d.]+)g/i);
const carbsMatch = description.match(/Carbs:\s*([\d.]+)g/i);
const proteinMatch = description.match(/Protein:\s*([\d.]+)g/i);
```

Convert per-serving to per-100g:
```typescript
const servingSizeMatch = description.match(/Per\s+([\d.]+)\s*(\w+)/i);
const isPerServing = !description.toLowerCase().includes('per 100');
const multiplier = isPerServing ? (100 / servingAmount) : 1;
const calories_per_100g = Math.round(parseFloat(caloriesMatch[1]) * multiplier);
```

## Search Flow with Multi-Source

1. **User types query** → 300ms debounce
2. **Parallel searches initiated**:
   - Local DB via `/api/foods/search`
   - USDA FoodData Central (10 results)
   - FatSecret Platform (10 results)
   - Nutritionix instant + branded (10 results)
3. **Results combined**:
   - Local results displayed first
   - All external results merged
   - Deduplicated by `fdc_id` or food name
4. **Sorting**:
   - Exact matches first
   - Starts-with matches second
   - Contains matches last
5. **Display**:
   - Badge shows data source (USDA/NX/FS/Custom)
   - Nutrition shown per actual serving size
   - Quick-add defaults to serving size

## API Quota Management Strategy

### Previous Issues
1. Nutritionix alone: 200 req/day too limited
2. Per-user API keys: 4 users × 200 = 800/day still limiting
3. Common foods required extra API calls (was disabled to save quota)

### Current Solution
- **Primary**: FatSecret (10,000/day) - highest quota
- **Secondary**: USDA (1,000/hour = 24,000/day) - foundation foods
- **Tertiary**: Nutritionix (800/day with 4 users) - branded/restaurant items
- **Cache**: 30 days aggressive caching across all APIs
- **Parallel**: All searches happen simultaneously

### Quota Exhaustion Handling
```typescript
catch (error) {
  console.error('FatSecret search error:', error);
  return { foods: { food: [], max_results: '0', total_results: '0' } };
}
```

If any API fails or hits quota, the others continue working. User still gets results from remaining sources.

## Previous Migration Context

### Nutritionix Migration Issues (Solved by Multi-Source)

1. **API Quota Exceeded**: 200 req/day insufficient
   - Fixed: Added USDA (1000/hr) + FatSecret (10000/day)

2. **Common Foods Too Expensive**: Each required extra API call
   - Fixed: Disabled Nutritionix common foods, use USDA/FatSecret instead

3. **Missing Branded Items**: e.g., "Chick-fil-A Spicy Chicken Sandwich"
   - Fixed: FatSecret has extensive branded/restaurant database

4. **Per-User API Keys Complex**: Required settings modal, user onboarding
   - Still available but less critical with 10k/day from FatSecret

### Per-User API Keys (Still Implemented)

Users can still configure personal Nutritionix keys:
- Settings modal: "⚙️ API Keys" button in dashboard header
- Stored in `users` table: `nutritionix_app_id`, `nutritionix_app_key`
- Loaded from localStorage on each request
- Fallback to env vars if not configured

## Testing Checklist

- [x] FatSecret OAuth2 token acquisition working
- [x] Token caching and automatic refresh
- [x] Food search returns FatSecret results
- [x] Nutrition parsing from description strings
- [x] Per-100g conversion calculations
- [ ] USDA + FatSecret + Nutritionix all return results simultaneously
- [ ] Deduplication across all 3 sources working
- [ ] Quota exhaustion gracefully handled (other sources continue)
- [ ] "FS" badge displays for FatSecret foods
- [ ] Cache working (30-day duration)
- [ ] All 3 APIs respect their quota limits

## Known Limitations

1. **FatSecret Nutrition Parsing**:
   - Relies on regex parsing of description strings
   - May miss optional fields (fiber, sugar, sodium) if not in description
   - More brittle than structured JSON responses

2. **OAuth2 Token Storage**:
   - Token stored in memory only (not persisted)
   - Requires re-authentication after page refresh
   - Could be improved with secure localStorage or backend proxy

3. **API Response Formats**:
   - Three different response structures to normalize
   - Serving size units vary across APIs
   - Requires careful mapping to `FoodItem` type

4. **Deduplication Logic**:
   - Based on food name + brand matching
   - May show near-duplicates from different sources
   - Could be improved with fuzzy matching

## Future Enhancements

- [ ] Add OpenFoodFacts API (free, open-source, no quota)
- [ ] Implement backend proxy for OAuth2 token storage
- [ ] Add fuzzy deduplication across sources
- [ ] Show API source distribution in search results (e.g., "10 USDA, 8 FatSecret, 5 Nutritionix")
- [ ] Implement smart source selection based on query type
- [ ] Add barcode scanning with multi-source UPC lookup
- [ ] Cache OAuth2 tokens in backend instead of frontend
- [ ] Add API health monitoring dashboard
- [ ] Implement automatic fallback priority (FatSecret → USDA → Nutritionix)

## Migration Benefits

1. **10x Quota Increase**: From 800/day to 10,800/day + 1000/hour
2. **Better Food Coverage**: Different databases cover different gaps
3. **Resilience**: If one API fails, others continue working
4. **No Single Point of Failure**: Not dependent on any single provider
5. **Cost Effective**: All free tiers, no paid subscriptions needed

## Files Changed Summary

### Created
- `/src/api/fatsecret-config.ts` - FatSecret configuration and types
- `/src/api/fatsecret-service.ts` - OAuth2 and food search implementation

### Modified
- `/src/scripts/views/DashboardView.ts` - Added multi-source parallel search
- `/src/.env` - Added FatSecret credentials
- `/src/vite-env.d.ts` - Added FatSecret environment variable types
- `/src/types/models.ts` - Added 'fatsecret' to data_source union

### Re-enabled
- `/src/api/usda-service.ts` - USDA integration back in use
- `/src/api/usda-config.ts` - USDA configuration

## Environment Setup

### Required Environment Variables
```bash
# /src/.env (must be in src/ directory for Vite)
VITE_USDA_API_KEY=DEMO_KEY
VITE_NUTRITIONIX_APP_ID=54248873
VITE_NUTRITIONIX_APP_KEY=ccc0b2267eaf2a0e11d1ce0c6f208b62
VITE_FATSECRET_CLIENT_ID=7e1e07fb85364007b8481197e6ef5b99
VITE_FATSECRET_CLIENT_SECRET=e28730a6b0b04bedaf4e6acff1d6de41
VITE_API_URL=http://localhost:3001/api
```

### Testing Locally
1. Ensure `/src/.env` has all credentials
2. **Restart Vite dev server**: `npm run dev` (required to pick up new env vars)
3. Test food search with various queries
4. Check browser console for API responses from all 3 sources
5. Verify results show mix of USDA/FatSecret/Nutritionix items
6. Check Network tab for parallel API calls

## Troubleshooting

### FatSecret 401 Unauthorized
- Check `VITE_FATSECRET_CLIENT_ID` and `VITE_FATSECRET_CLIENT_SECRET` in `/src/.env`
- Restart dev server after env changes
- Check browser console for OAuth2 token request

### No FatSecret Results
- Check Network tab for API calls
- Verify OAuth2 token is being acquired (check console logs)
- Try different search terms (e.g., "chicken", "apple")

### Duplicate Results
- Check deduplication logic in `displayFoodSearchResults()`
- Verify `fdc_id` or food name matching working

### Slow Search Performance
- All 3 APIs called in parallel, but slowest determines total time
- Check which API is slowest in Network tab
- Consider adding timeout for slow APIs (not yet implemented)

## Related Documentation
- `/context/nutritionix-migration.md` - Initial Nutritionix migration
- `/CLAUDE.md` - Full project documentation
- `/context/work-summary-2025-09-30-final.md` - Previous work session
