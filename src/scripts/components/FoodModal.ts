// Food Entry Modal Component
import { apiClient } from '@/api/api-client';
import { fatSecretService } from '@/api/fatsecret-service';
import type { FoodItem } from '@/types/models';
import { format } from 'date-fns';

export class FoodModal {
  private currentDate: Date;
  private onSave: () => void;
  private modalElement: HTMLElement | null = null;
  private searchTimeout: number | null = null;
  private selectedFood: FoodItem | null = null;

  private async searchFatSecret(query: string): Promise<FoodItem[]> {
    try {
      const results = await fatSecretService.searchFoods(query, 20);
      if (!results.foods?.food) {
        return [];
      }
      const foods = Array.isArray(results.foods.food)
        ? results.foods.food
        : [results.foods.food];
      return foods.map(food => fatSecretService.convertToFoodItem(food));
    } catch (error) {
      console.error('FatSecret search error:', error);
      return [];
    }
  }

  constructor(_userId: number, currentDate: Date, onSave: () => void) {
    this.currentDate = currentDate;
    this.onSave = onSave;
    this.createModal();
  }

  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'foodModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Add Food</h2>
          <button id="closeFoodModal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Search Food Database</label>
            <input type="text" id="foodSearch" placeholder="Search USDA database or custom foods..." style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>

          <div id="foodSearchResults" style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;">
            <div style="text-align: center; color: var(--gray); padding: 1rem;">
              Start typing to search for foods...
            </div>
          </div>

          <div id="selectedFoodInfo" style="display: none; padding: 1rem; background: var(--light); border-radius: var(--radius); margin-bottom: 1rem;">
            <div style="font-weight: 600; margin-bottom: 0.5rem;" id="selectedFoodName"></div>
            <div style="font-size: 0.875rem; color: var(--gray);" id="selectedFoodNutrition"></div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Meal Type</label>
            <select id="mealType" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Quantity</label>
              <input type="number" id="quantity" value="100" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Unit</label>
              <select id="unit" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
                <option value="g">grams</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>

          <button id="saveFoodEntry" disabled style="width: 100%; padding: 0.75rem 1.5rem; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 500; cursor: pointer; background: var(--primary); color: white; opacity: 0.5;">
            Add Food Entry
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalElement = modal;

    // Setup event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const closeBtn = document.getElementById('closeFoodModal');
    const searchInput = document.getElementById('foodSearch') as HTMLInputElement;
    const saveBtn = document.getElementById('saveFoodEntry') as HTMLButtonElement;

    closeBtn?.addEventListener('click', () => this.close());

    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = window.setTimeout(() => this.performSearch(query), 300);
    });

    saveBtn?.addEventListener('click', () => this.saveFoodEntry());
  }

  private async performSearch(query: string): Promise<void> {
    if (query.length < 2) {
      const resultsDiv = document.getElementById('foodSearchResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 1rem;">Start typing to search for foods...</div>';
      }
      return;
    }

    const resultsDiv = document.getElementById('foodSearchResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem;"><div class="spinner" style="border: 3px solid var(--border); border-top: 3px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div></div>';
    }

    try {
      // Create local search function
      const localSearchFn = async (q: string) => {
        const localResults = await apiClient.searchFoods(q);
        return localResults.items || [];
      };

      // Search local and FatSecret
      const [localResults, fatSecretResults] = await Promise.all([
        localSearchFn(query),
        this.searchFatSecret(query)
      ]);

      this.displaySearchResults(localResults, fatSecretResults);
    } catch (error) {
      console.error('Search error:', error);
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 1rem;">Error searching foods. Please try again.</div>';
      }
    }
  }

  private displaySearchResults(local: FoodItem[], usda: FoodItem[]): void {
    const resultsDiv = document.getElementById('foodSearchResults');
    if (!resultsDiv) return;

    const allResults = [...local, ...usda];

    if (allResults.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 1rem;">No results found.</div>';
      return;
    }

    resultsDiv.innerHTML = allResults
      .slice(0, 10)
      .map(
        (food) => `
        <div class="food-result" data-food-id="${food.id}" data-food='${JSON.stringify(food)}' style="padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 0.5rem; cursor: pointer; transition: all 0.3s;">
          <div style="font-weight: 500; margin-bottom: 0.25rem;">
            ${food.name}
            ${food.data_source === 'usda' ? '<span style="display: inline-block; padding: 0.25rem 0.5rem; background: var(--secondary); color: white; border-radius: 12px; font-size: 0.625rem; text-transform: uppercase; margin-left: 0.5rem;">USDA</span>' : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--gray); display: flex; gap: 1rem;">
            <span>${Math.round(food.calories_per_100g)} cal/100g</span>
            ${food.protein_g ? `<span>${food.protein_g.toFixed(1)}g protein</span>` : ''}
            ${food.carbs_g ? `<span>${food.carbs_g.toFixed(1)}g carbs</span>` : ''}
            ${food.fat_g ? `<span>${food.fat_g.toFixed(1)}g fat</span>` : ''}
          </div>
        </div>
      `
      )
      .join('');

    // Add click listeners to results
    resultsDiv.querySelectorAll('.food-result').forEach((el) => {
      el.addEventListener('click', () => {
        const foodData = el.getAttribute('data-food');
        if (foodData) {
          this.selectFood(JSON.parse(foodData));
        }
      });
    });
  }

  private async selectFood(food: FoodItem): Promise<void> {
    // If USDA food not in local DB, save it first
    if (food.data_source === 'usda' && (!food.id || food.id === 0)) {
      const result = await apiClient.addFoodItem({
        name: food.name,
        brand: food.brand,
        calories_per_100g: food.calories_per_100g,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        serving_size_g: food.serving_size_g,
        serving_size_unit: food.serving_size_unit,
      });
      food.id = result.item.id;
    }

    this.selectedFood = food;

    const infoDiv = document.getElementById('selectedFoodInfo');
    const nameDiv = document.getElementById('selectedFoodName');
    const nutritionDiv = document.getElementById('selectedFoodNutrition');
    const saveBtn = document.getElementById('saveFoodEntry') as HTMLButtonElement;

    if (infoDiv && nameDiv && nutritionDiv && saveBtn) {
      infoDiv.style.display = 'block';
      nameDiv.textContent = `Selected: ${food.name}`;
      nutritionDiv.textContent = `${Math.round(food.calories_per_100g)} cal/100g | Protein: ${food.protein_g?.toFixed(1) || 0}g | Carbs: ${food.carbs_g?.toFixed(1) || 0}g | Fat: ${food.fat_g?.toFixed(1) || 0}g`;
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    }
  }

  private async saveFoodEntry(): Promise<void> {
    if (!this.selectedFood) return;

    const mealType = (document.getElementById('mealType') as HTMLSelectElement).value as
      | 'breakfast'
      | 'lunch'
      | 'dinner'
      | 'snack';
    const quantity = parseFloat((document.getElementById('quantity') as HTMLInputElement).value);
    const unit = (document.getElementById('unit') as HTMLSelectElement).value;

    // Convert oz to grams if needed
    const quantityInGrams = unit === 'oz' ? quantity * 28.3495 : quantity;

    try {
      // Calculate nutrition based on quantity
      const multiplier = quantityInGrams / 100;
      const calories = (this.selectedFood.calories_per_100g || 0) * multiplier;
      const protein = (this.selectedFood.protein_g || 0) * multiplier;
      const carbs = (this.selectedFood.carbs_g || 0) * multiplier;
      const fat = (this.selectedFood.fat_g || 0) * multiplier;
      const fiber = (this.selectedFood.fiber_g || 0) * multiplier;

      const dateStr = format(this.currentDate, 'yyyy-MM-dd');

      await apiClient.addFoodEntry({
        food_item_id: this.selectedFood.id,
        food_name: this.selectedFood.name,
        quantity_g: quantityInGrams,
        calories: Math.round(calories),
        protein_g: Math.round(protein * 10) / 10,
        carbs_g: Math.round(carbs * 10) / 10,
        fat_g: Math.round(fat * 10) / 10,
        fiber_g: Math.round(fiber * 10) / 10,
        meal_type: mealType,
        date: dateStr,
      });

      this.showToast('Food entry added successfully!', 'success');
      this.close();
      this.onSave();
    } catch (error) {
      console.error('Error saving food entry:', error);
      this.showToast('Error adding food entry', 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? 'var(--success)' : 'var(--danger)'};
      color: white;
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      z-index: 2000;
      animation: fadeIn 0.3s;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  open(): void {
    if (this.modalElement) {
      this.modalElement.style.display = 'flex';
      this.modalElement.style.alignItems = 'center';
      this.modalElement.style.justifyContent = 'center';
      this.modalElement.style.position = 'fixed';
      this.modalElement.style.top = '0';
      this.modalElement.style.left = '0';
      this.modalElement.style.right = '0';
      this.modalElement.style.bottom = '0';
      this.modalElement.style.background = 'rgba(0,0,0,0.5)';
      this.modalElement.style.zIndex = '1000';
      this.modalElement.style.padding = '1rem';
      this.modalElement.style.overflowY = 'auto';
    }
  }

  close(): void {
    if (this.modalElement) {
      this.modalElement.style.display = 'none';
      // Reset form
      (document.getElementById('foodSearch') as HTMLInputElement).value = '';
      (document.getElementById('quantity') as HTMLInputElement).value = '100';
      const infoDiv = document.getElementById('selectedFoodInfo');
      if (infoDiv) infoDiv.style.display = 'none';
      const saveBtn = document.getElementById('saveFoodEntry') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
      }
      this.selectedFood = null;
    }
  }
}
