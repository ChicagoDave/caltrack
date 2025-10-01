// FatSecret Platform API Configuration
// API Documentation: https://platform.fatsecret.com/api/

export const FATSECRET_CONFIG = {
  CACHE_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// FatSecret API Response Types
export interface FatSecretSearchResult {
  foods: {
    food: FatSecretFood[];
    max_results: string;
    page_number: string;
    total_results: string;
  };
}

export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_type: string;
  brand_name?: string;
  food_description: string;
  food_url: string;
}

export interface FatSecretFoodDetail {
  food: {
    food_id: string;
    food_name: string;
    brand_name?: string;
    food_type: string;
    food_url: string;
    servings: {
      serving: FatSecretServing | FatSecretServing[];
    };
  };
}

export interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  serving_url: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description: string;
  calories: string;
  carbohydrate: string;
  protein: string;
  fat: string;
  saturated_fat?: string;
  polyunsaturated_fat?: string;
  monounsaturated_fat?: string;
  cholesterol?: string;
  sodium?: string;
  potassium?: string;
  fiber?: string;
  sugar?: string;
  vitamin_a?: string;
  vitamin_c?: string;
  calcium?: string;
  iron?: string;
}
