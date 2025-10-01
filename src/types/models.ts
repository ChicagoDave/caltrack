// TypeScript type definitions for the CalTrack application

// User related types
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: Date;
  height_cm?: number;
  birth_date?: Date;
  gender?: 'male' | 'female' | 'other';
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
}

// Weight tracking types
export interface WeightEntry {
  id: number;
  user_id: number;
  weight_kg: number;
  date: Date;
  created_at: Date;
}

export interface WeightGoal {
  id: number;
  user_id: number;
  target_weight_kg: number;
  target_date?: Date;
  daily_calorie_target?: number;
  created_at: Date;
  is_active: boolean;
}

// Food related types
export interface FoodItem {
  id: number;
  name: string;
  brand?: string | null;
  calories_per_100g: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  serving_size_g?: number;
  serving_size_unit?: string;
  user_id?: number | null;
  is_custom: boolean;
  fdc_id?: string | null;  // FatSecret food ID
  barcode?: string | null;
  data_source?: 'fatsecret' | 'custom' | 'verified';
  last_synced?: Date;
}

export interface FoodEntry {
  id: number;
  user_id: number;
  food_item_id: number;
  quantity_g: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: Date;
  created_at: Date;
  food_item?: FoodItem; // For joined queries
}

// Activity related types
export interface Activity {
  id: number;
  name: string;
  calories_per_minute: number;
  category?: string;
  met_value?: number;
}

export interface ActivityEntry {
  id: number;
  user_id: number;
  activity_id: number;
  duration_minutes: number;
  calories_burned: number;
  date: Date;
  created_at: Date;
  notes?: string;
  activity?: Activity; // For joined queries
}

// Nutrition summary types
export interface NutrientProfile {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat?: number;
  cholesterol?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  calcium?: number;
  iron?: number;
  vitaminD?: number;
  vitaminB12?: number;
}

export interface NutritionSummary extends NutrientProfile {
  date: Date;
  total_meals: number;
  water_ml?: number;
}

// Statistics types
export interface DailySummary {
  date: Date;
  calories_consumed: number;
  calories_burned: number;
  net_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  weight_kg?: number;
  water_ml?: number;
}

export interface WeeklyStats {
  week_start: Date;
  week_end: Date;
  average_calories: number;
  total_calories_burned: number;
  average_weight?: number;
  weight_change?: number;
  days_logged: number;
  goal_adherence_percentage: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  daily_summaries: DailySummary[];
  average_calories: number;
  total_calories_burned: number;
  weight_start?: number;
  weight_end?: number;
  weight_change?: number;
  days_logged: number;
  most_consumed_foods: { food: FoodItem; count: number }[];
  most_frequent_activities: { activity: Activity; count: number }[];
}

export interface GoalProgress {
  current_weight: number;
  target_weight: number;
  weight_to_go: number;
  percentage_complete: number;
  estimated_completion_date?: Date;
  daily_calorie_target: number;
  average_daily_calories: number;
  on_track: boolean;
}

// Form data types
export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
  height_cm?: number;
  birth_date?: Date;
  gender?: 'male' | 'female' | 'other';
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  current_weight_kg?: number;
  target_weight_kg?: number;
}

export interface SearchFilters {
  query: string;
  includeFatSecret: boolean;
  includeCustom: boolean;
  dataSource?: 'all' | 'fatsecret' | 'custom';
  category?: string;
  minCalories?: number;
  maxCalories?: number;
}

// Chart data types
export interface ChartDataPoint {
  x: Date | string | number;
  y: number;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: ChartDataPoint[];
  options?: any;
}

// Application state types
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  currentDate: Date;
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncTime?: Date;
}

export interface UIState {
  activeView: 'dashboard' | 'food' | 'activity' | 'weight' | 'stats' | 'settings';
  isLoading: boolean;
  error: string | null;
  notification: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null;
}

// Database response types
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Settings types
export interface UserSettings {
  units: 'metric' | 'imperial';
  startOfWeek: 'monday' | 'sunday';
  mealTimes: {
    breakfast: string; // HH:MM format
    lunch: string;
    dinner: string;
  };
  notifications: {
    mealReminders: boolean;
    weightReminders: boolean;
    goalReminders: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  privacy: {
    shareProgress: boolean;
    publicProfile: boolean;
  };
}