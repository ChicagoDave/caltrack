// FatSecret Platform API Service
import { FATSECRET_CONFIG, FatSecretSearchResult, FatSecretFood } from './fatsecret-config';
import { FoodItem } from '@/types/models';

export class FatSecretFoodService {
  private apiUrl: string;
  private cache: Map<string, { data: any; timestamp: number }>;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.cache = new Map();
  }

  /**
   * Search for foods (via backend proxy)
   */
  async searchFoods(query: string, maxResults: number = 20): Promise<FatSecretSearchResult> {
    const cacheKey = `search_${query}_${maxResults}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.apiUrl}/fatsecret/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxResults }),
      });

      if (!response.ok) {
        throw new Error(`FatSecret API error: ${response.status}`);
      }

      const data: FatSecretSearchResult = await response.json();
      console.log('FatSecret API response for query:', query, data);
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('FatSecret search error:', error);
      return { foods: { food: [], max_results: '0', page_number: '0', total_results: '0' } };
    }
  }

  /**
   * Get specific food by ID (via backend proxy)
   */
  async getFoodById(foodId: string): Promise<FatSecretFood | null> {
    const cacheKey = `food_${foodId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.apiUrl}/fatsecret/food/${foodId}`);

      if (!response.ok) {
        throw new Error(`FatSecret API error: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data.food);
      return data.food;
    } catch (error) {
      console.error('FatSecret get food error:', error);
      return null;
    }
  }

  /**
   * Convert FatSecret food to our FoodItem format
   * Parse description like "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 5.00g"
   */
  convertToFoodItem(fsFood: FatSecretFood): FoodItem {
    const description = fsFood.food_description || '';

    // Parse nutrition from description
    const caloriesMatch = description.match(/Calories:\s*(\d+)kcal/i);
    const fatMatch = description.match(/Fat:\s*([\d.]+)g/i);
    const carbsMatch = description.match(/Carbs:\s*([\d.]+)g/i);
    const proteinMatch = description.match(/Protein:\s*([\d.]+)g/i);
    const fiberMatch = description.match(/Fiber:\s*([\d.]+)g/i);
    const sugarMatch = description.match(/Sugar:\s*([\d.]+)g/i);
    const sodiumMatch = description.match(/Sodium:\s*([\d.]+)mg/i);

    // Parse serving size from description (e.g., "Per 100g" or "Per 1 serving")
    const servingSizeMatch = description.match(/Per\s+([\d.]+)\s*(\w+)/i);
    const servingUnit = servingSizeMatch ? servingSizeMatch[2] : 'serving';

    // FatSecret basic API doesn't provide serving size in grams
    // Since we don't know the actual weight, store values per serving and mark as 100g
    // The display logic will show "per serving" instead of "per 100g"
    const calories = parseFloat(caloriesMatch?.[1] || '0');
    const protein = parseFloat(proteinMatch?.[1] || '0');
    const carbs = parseFloat(carbsMatch?.[1] || '0');
    const fat = parseFloat(fatMatch?.[1] || '0');
    const fiber = parseFloat(fiberMatch?.[1] || '0');
    const sugar = parseFloat(sugarMatch?.[1] || '0');
    const sodium = parseFloat(sodiumMatch?.[1] || '0');

    // Format as "Brand - Item" for clarity
    const displayName = fsFood.brand_name
      ? `${fsFood.brand_name} - ${fsFood.food_name}`
      : fsFood.food_name;

    return {
      id: 0,
      name: displayName,
      brand: fsFood.brand_name || null,
      calories_per_100g: Math.round(calories),
      protein_g: Math.round(protein * 10) / 10,
      carbs_g: Math.round(carbs * 10) / 10,
      fat_g: Math.round(fat * 10) / 10,
      fiber_g: Math.round(fiber * 10) / 10,
      sugar_g: Math.round(sugar * 10) / 10,
      sodium_mg: Math.round(sodium),
      serving_size_g: 100, // Default to 100 since we don't know actual serving size
      serving_size_unit: servingUnit,
      user_id: null,
      is_custom: false,
      fdc_id: fsFood.food_id,
      barcode: null,
      data_source: 'fatsecret',
      last_synced: new Date(),
    };
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > FATSECRET_CONFIG.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const fatSecretService = new FatSecretFoodService();
