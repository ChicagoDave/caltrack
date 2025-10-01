// Main Dashboard View
import { apiClient } from '@/api/api-client';
import { fatSecretService } from '@/api/fatsecret-service';
import { AppState, FoodItem } from '@/types/models';
import { format } from 'date-fns';
import { WeightModal } from '../components/WeightModal';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export class DashboardView {
  private state: AppState;
  private dailySummary: any = null;
  private foodEntries: any[] = [];
  private activityEntries: any[] = [];
  private weightModal: WeightModal | null = null;
  private searchTimeout: number | null = null;
  private selectedFood: FoodItem | null = null;

  constructor(state: AppState) {
    this.state = state;
  }

  async render(container: HTMLElement): Promise<void> {
    // Load today's data
    await this.loadTodayData();

    container.innerHTML = this.getHTML();

    // Setup event listeners
    this.setupEventListeners();

    // Setup entry action buttons (edit/delete)
    this.setupEntryActionListeners();

    // Initialize modals
    this.initializeModals();

    // Render chart
    await this.renderChart();

    // Update progress ring
    this.updateProgressRing();
  }

  private async loadTodayData(): Promise<void> {
    const dateStr = format(this.state.currentDate, 'yyyy-MM-dd');

    try {
      // Load all data in parallel
      const [summaryRes, foodRes, activityRes] = await Promise.all([
        apiClient.getDailySummary(dateStr),
        apiClient.getFoodEntries(dateStr),
        apiClient.getActivityEntries(dateStr)
      ]);

      this.dailySummary = summaryRes.summary;
      this.foodEntries = foodRes.entries;
      this.activityEntries = activityRes.entries;
    } catch (error) {
      console.error('Failed to load today data:', error);
    }
  }

  private getHTML(): string {
    const dateStr = format(this.state.currentDate, 'EEEE, MMMM d, yyyy');
    const consumed = Math.round(this.dailySummary?.calories_consumed || 0);
    const burned = Math.round(this.dailySummary?.calories_burned || 0);
    const net = Math.round(this.dailySummary?.net_calories || 0);
    const goal = this.dailySummary?.daily_goal || 2000;
    const remaining = Math.round(this.dailySummary?.calories_remaining || 0);

    // Macro tracking
    const protein = Math.round(this.dailySummary?.macros?.protein_g || 0);
    const carbs = Math.round(this.dailySummary?.macros?.carbs_g || 0);
    const fat = Math.round(this.dailySummary?.macros?.fat_g || 0);
    const proteinGoal = this.dailySummary?.macro_goals?.protein_g || 150;
    const carbsGoal = this.dailySummary?.macro_goals?.carbs_g || 200;
    const fatGoal = this.dailySummary?.macro_goals?.fat_g || 65;
    const burnGoal = this.dailySummary?.burn_goal || 0;

    return `
      <div class="container">
        <!-- Header -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h1 style="font-size: 1.8rem; color: var(--primary); margin: 0;">🥗 CalTrack</h1>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <!-- Date Navigation -->
              <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--light); padding: 0.5rem; border-radius: var(--radius);">
                <button id="prevDayBtn" style="padding: 0.25rem 0.5rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 0.9rem; cursor: pointer; font-weight: bold;">←</button>
                <div style="font-size: 0.9rem; color: var(--dark); font-weight: 500; min-width: 200px; text-align: center;">${dateStr}</div>
                <button id="nextDayBtn" style="padding: 0.25rem 0.5rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 0.9rem; cursor: pointer; font-weight: bold;">→</button>
                <button id="todayBtn" style="padding: 0.25rem 0.5rem; background: var(--secondary); color: white; border: none; border-radius: var(--radius); font-size: 0.75rem; cursor: pointer;">Today</button>
              </div>
              <button id="logoutBtn" style="padding: 0.25rem 0.75rem; background: var(--danger); color: white; border: none; border-radius: var(--radius); font-size: 0.8rem; cursor: pointer;">Logout</button>
            </div>
          </div>

          <!-- Daily Summary Grid -->
          <div class="summary-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
            <div style="text-align: center; padding: 1.5rem 1rem; background: var(--light); border-radius: var(--radius); border-left: 4px solid var(--primary);">
              <div style="font-size: 0.75rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.5rem;">Consumed</div>
              <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${consumed}</div>
              <div style="font-size: 0.75rem; color: var(--gray);">calories</div>
            </div>
            <div style="text-align: center; padding: 1.5rem 1rem; background: var(--light); border-radius: var(--radius); border-left: 4px solid var(--warning);">
              <div style="font-size: 0.75rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.5rem;">Burned</div>
              <div style="font-size: 2rem; font-weight: bold; color: var(--warning);">${burned}</div>
              <div style="font-size: 0.75rem; color: var(--gray);">${burnGoal > 0 ? `of ${burnGoal}` : 'calories'}</div>
            </div>
            <div style="text-align: center; padding: 1.5rem 1rem; background: var(--light); border-radius: var(--radius); border-left: 4px solid var(--secondary);">
              <div style="font-size: 0.75rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.5rem;">Net</div>
              <div style="font-size: 2rem; font-weight: bold; color: var(--secondary);">${net}</div>
              <div style="font-size: 0.75rem; color: var(--gray);">calories</div>
            </div>
            <div style="text-align: center; padding: 1.5rem 1rem; background: var(--light); border-radius: var(--radius); border-left: 4px solid var(--success);">
              <div style="font-size: 0.75rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.5rem;">Remaining</div>
              <div style="font-size: 2rem; font-weight: bold; color: var(--success);">${remaining}</div>
              <div style="font-size: 0.75rem; color: var(--gray);">of ${goal}</div>
            </div>
          </div>

          <!-- Macros Grid -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
            <div style="text-align: center; padding: 1rem; background: var(--light); border-radius: var(--radius); border-left: 3px solid #e74c3c;">
              <div style="font-size: 0.7rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.25rem;">Protein</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #e74c3c;">${protein}</div>
              <div style="font-size: 0.65rem; color: var(--gray);">of ${proteinGoal}g</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: var(--light); border-radius: var(--radius); border-left: 3px solid #3498db;">
              <div style="font-size: 0.7rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.25rem;">Carbs</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #3498db;">${carbs}</div>
              <div style="font-size: 0.65rem; color: var(--gray);">of ${carbsGoal}g</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: var(--light); border-radius: var(--radius); border-left: 3px solid #f39c12;">
              <div style="font-size: 0.7rem; color: var(--gray); text-transform: uppercase; margin-bottom: 0.25rem;">Fat</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #f39c12;">${fat}</div>
              <div style="font-size: 0.65rem; color: var(--gray);">of ${fatGoal}g</div>
            </div>
          </div>
        </div>

        <!-- Food Search Inline Card -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--dark);">🍽️ Add Food</h2>

          <!-- Search Input -->
          <div style="margin-bottom: 0.75rem;">
            <input type="text" id="foodSearchInput" placeholder="Search for foods..." style="width: 100%; padding: 0.5rem 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.9rem;">
          </div>

          <!-- Search Results -->
          <div id="foodSearchResults" style="max-height: 250px; overflow-y: auto; margin-bottom: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); background: white;">
            <div style="text-align: center; color: var(--gray); padding: 1.5rem; font-size: 0.875rem;">
              Start typing to search for foods...
            </div>
          </div>

          <!-- Selected Food Info -->
          <div id="selectedFoodInfo" style="display: none; padding: 0.75rem; background: var(--light); border-radius: var(--radius); margin-bottom: 0.75rem; font-size: 0.875rem;">
            <div style="font-weight: 600; margin-bottom: 0.25rem;" id="selectedFoodName"></div>
            <div style="color: var(--gray); font-size: 0.8rem;" id="selectedFoodNutrition"></div>
          </div>

          <!-- Food Entry Form -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 0.5rem; align-items: end;">
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.8rem;">Meal</label>
              <select id="mealType" style="width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.85rem;">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.8rem;">Qty</label>
              <input type="number" id="foodQuantity" value="100" style="width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.85rem;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.8rem;">Unit</label>
              <select id="foodUnit" style="width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.85rem;">
                <option value="g">g</option>
                <option value="oz">oz</option>
              </select>
            </div>
            <button id="addFoodBtn" disabled style="padding: 0.5rem 1rem; border: none; border-radius: var(--radius); font-size: 0.85rem; font-weight: 500; cursor: pointer; background: var(--primary); color: white; opacity: 0.5; white-space: nowrap;">
              Add Food
            </button>
          </div>
        </div>

        <!-- Activity Tracking Card -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--dark);">🏃 Add Activity</h2>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
            <button class="activity-btn btn btn-secondary" data-activity="walking" style="padding: 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; font-size: 0.85rem; border: 2px solid var(--border); background: white; color: var(--dark); border-radius: var(--radius); cursor: pointer;">
              <span style="font-size: 1.5rem;">🚶</span>
              <span>Walk</span>
            </button>
            <button class="activity-btn btn btn-secondary" data-activity="running" style="padding: 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; font-size: 0.85rem; border: 2px solid var(--border); background: white; color: var(--dark); border-radius: var(--radius); cursor: pointer;">
              <span style="font-size: 1.5rem;">🏃</span>
              <span>Run</span>
            </button>
            <button class="activity-btn btn btn-secondary" data-activity="swimming" style="padding: 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; font-size: 0.85rem; border: 2px solid var(--border); background: white; color: var(--dark); border-radius: var(--radius); cursor: pointer;">
              <span style="font-size: 1.5rem;">🏊</span>
              <span>Swim</span>
            </button>
            <button class="activity-btn btn btn-secondary" data-activity="cycling" style="padding: 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; font-size: 0.85rem; border: 2px solid var(--border); background: white; color: var(--dark); border-radius: var(--radius); cursor: pointer;">
              <span style="font-size: 1.5rem;">🚴</span>
              <span>Bike</span>
            </button>
          </div>
        </div>

        <!-- Progress Chart -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--dark);">📊 Weekly Progress</h2>
          <div style="position: relative; height: 300px;">
            <canvas id="weeklyChart"></canvas>
          </div>
        </div>

        <!-- Today's Entries -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--dark);">📝 Today's Log</h2>
          <div id="entriesList">
            ${this.renderEntries()}
          </div>
        </div>

        <!-- Weight and Goals Section -->
        <div class="card">
          <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--dark);">⚖️ Weight & Goals</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
            <button id="setWeight" class="btn btn-primary" style="padding: 0.5rem; font-size: 0.85rem; border: 2px solid var(--primary); background: white; color: var(--primary); border-radius: var(--radius); cursor: pointer; font-weight: 500;">
              ⚖️ Weight
            </button>
            <button id="setGoals" class="btn btn-primary" style="padding: 0.5rem; font-size: 0.85rem; border: 2px solid var(--primary); background: white; color: var(--primary); border-radius: var(--radius); cursor: pointer; font-weight: 500;">
              🎯 Goal
            </button>
            <button id="setCalorieGoal" class="btn btn-primary" style="padding: 0.5rem; font-size: 0.85rem; border: 2px solid var(--primary); background: white; color: var(--primary); border-radius: var(--radius); cursor: pointer; font-weight: 500;">
              🔥 Cal Goal
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Date navigation buttons
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');

    prevDayBtn?.addEventListener('click', () => {
      this.state.currentDate.setDate(this.state.currentDate.getDate() - 1);
      this.refresh();
    });

    nextDayBtn?.addEventListener('click', () => {
      this.state.currentDate.setDate(this.state.currentDate.getDate() + 1);
      this.refresh();
    });

    todayBtn?.addEventListener('click', () => {
      this.state.currentDate = new Date();
      this.refresh();
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('caltrack_token');
        localStorage.removeItem('caltrack_user');
        window.location.reload();
      }
    });

    // Food search input
    const searchInput = document.getElementById('foodSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = window.setTimeout(() => this.performFoodSearch(query), 300);
    });

    // Add food button
    const addFoodBtn = document.getElementById('addFoodBtn');
    addFoodBtn?.addEventListener('click', () => this.saveFoodEntry());

    // Activity buttons
    const activityBtns = document.querySelectorAll('.activity-btn');
    activityBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const activityType = (e.currentTarget as HTMLElement).dataset.activity;
        this.openActivityInput(activityType || 'walking');
      });
    });

    // Weight and goals buttons
    const setWeightBtn = document.getElementById('setWeight');
    const setGoalsBtn = document.getElementById('setGoals');
    const setCalorieGoalBtn = document.getElementById('setCalorieGoal');

    setWeightBtn?.addEventListener('click', () => {
      this.weightModal?.open();
    });

    setGoalsBtn?.addEventListener('click', () => {
      // Open weight modal in goal mode
      this.weightModal?.open();
    });

    setCalorieGoalBtn?.addEventListener('click', () => {
      this.openCalorieGoalModal();
    });
  }

  private openCalorieGoalModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '1000';
    modal.style.padding = '1rem';

    const currentGoal = this.dailySummary?.daily_goal || 2000;

    modal.innerHTML = `
      <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px;">
        <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Set Daily Calorie Goal</h2>
          <button id="closeCalorieGoal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Daily Calorie Goal</label>
            <input type="number" id="calorieGoalInput" value="${currentGoal}" min="1000" max="5000" step="50" placeholder="2000" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
            <div style="font-size: 0.875rem; color: var(--gray); margin-top: 0.5rem;">
              Recommended range: 1200-3000 calories per day
            </div>
          </div>
          <button id="saveCalorieGoal" class="btn btn-primary btn-block" style="padding: 0.75rem;">
            Save Goal
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('#closeCalorieGoal')?.addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Save button
    modal.querySelector('#saveCalorieGoal')?.addEventListener('click', async () => {
      const input = document.getElementById('calorieGoalInput') as HTMLInputElement;
      const goal = parseInt(input.value);

      if (!goal || goal < 1000 || goal > 5000) {
        this.showToast('Please enter a valid calorie goal (1000-5000)', 'error');
        return;
      }

      try {
        await apiClient.updateProfile({ daily_calorie_goal: goal });

        // Update local user data
        const savedUser = localStorage.getItem('caltrack_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          user.daily_calorie_goal = goal;
          localStorage.setItem('caltrack_user', JSON.stringify(user));
        }

        this.showToast('Calorie goal updated successfully!', 'success');
        modal.remove();
        await this.refresh();
      } catch (error) {
        console.error('Error saving calorie goal:', error);
        this.showToast('Error updating calorie goal', 'error');
      }
    });
  }

  private openActivityInput(activityType: string): void {
    // Create a simple activity input modal based on type
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '1000';
    modal.style.padding = '1rem';

    let inputHTML = '';
    let activityName = '';

    switch (activityType) {
      case 'walking':
        activityName = 'Walking';
        inputHTML = `
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Steps</label>
            <input type="number" id="activityInput" placeholder="10000" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
        `;
        break;
      case 'running':
        activityName = 'Running';
        inputHTML = `
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Distance (miles)</label>
            <input type="number" step="0.1" id="activityDistance" placeholder="3.5" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Time (minutes)</label>
            <input type="number" id="activityTime" placeholder="30" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
        `;
        break;
      case 'swimming':
        activityName = 'Swimming';
        inputHTML = `
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Laps</label>
            <input type="number" id="activityInput" placeholder="20" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
        `;
        break;
      case 'cycling':
        activityName = 'Cycling';
        inputHTML = `
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Duration (minutes)</label>
            <input type="number" id="activityInput" placeholder="45" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
        `;
        break;
    }

    modal.innerHTML = `
      <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px;">
        <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Add ${activityName}</h2>
          <button id="closeActivityInput" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div style="padding: 1.5rem;">
          ${inputHTML}
          <button id="saveActivity" class="btn btn-primary btn-block" style="padding: 0.75rem;">
            Add ${activityName}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('#closeActivityInput')?.addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Save button - actually save the activity
    modal.querySelector('#saveActivity')?.addEventListener('click', async () => {
      try {
        await this.saveActivityData(activityType, modal);
        modal.remove();
      } catch (error) {
        console.error('Error in save button handler:', error);
        this.showToast('Failed to save activity', 'error');
      }
    });
  }

  private async saveActivityData(activityType: string, modal: HTMLElement): Promise<void> {
    if (!this.state.user) return;

    let quantity = 0;
    let caloriesBurned = 0;
    let notes = '';
    let activityId = 1; // Default activity ID

    try {
      switch (activityType) {
        case 'walking':
          const steps = parseInt((modal.querySelector('#activityInput') as HTMLInputElement)?.value || '0');
          quantity = steps;
          caloriesBurned = Math.round(steps * 0.04); // 0.04 calories per step
          notes = `${steps} steps`;
          activityId = 1; // Walking
          break;

        case 'running':
          const distance = parseFloat((modal.querySelector('#activityDistance') as HTMLInputElement)?.value || '0');
          const time = parseInt((modal.querySelector('#activityTime') as HTMLInputElement)?.value || '0');
          quantity = distance;
          caloriesBurned = Math.round(distance * 100); // 100 calories per mile
          notes = `${distance} miles in ${time} minutes`;
          activityId = 2; // Running
          break;

        case 'swimming':
          const laps = parseInt((modal.querySelector('#activityInput') as HTMLInputElement)?.value || '0');
          quantity = laps;
          caloriesBurned = Math.round(laps * 50); // 50 calories per lap
          notes = `${laps} laps`;
          activityId = 3; // Swimming
          break;

        case 'cycling':
          const cyclingDuration = parseInt((modal.querySelector('#activityInput') as HTMLInputElement)?.value || '0');
          quantity = cyclingDuration;
          caloriesBurned = Math.round(cyclingDuration * 8); // 8 calories per minute
          notes = `${cyclingDuration} minutes`;
          activityId = 4; // Cycling
          break;
      }

      if (quantity === 0 || caloriesBurned === 0) {
        this.showToast('Please enter valid activity data', 'error');
        return;
      }

      console.log(`Saving ${activityType}: quantity=${quantity}, calories=${caloriesBurned}, notes=${notes}`);

      // Save activity entry via API
      const dateStr = format(this.state.currentDate, 'yyyy-MM-dd');
      await apiClient.addActivityEntry({
        activity_id: activityId,
        quantity,
        calories_burned: caloriesBurned,
        date: dateStr,
        notes,
      });

      this.showToast(`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} activity added!`, 'success');
      await this.refresh();
    } catch (error) {
      console.error('Error saving activity:', error);
      this.showToast('Error saving activity', 'error');
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
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

  private async searchFatSecret(query: string): Promise<FoodItem[]> {
    try {
      const results = await fatSecretService.searchFoods(query, 20);

      if (!results.foods?.food) {
        return [];
      }

      // Handle both single food and array of foods
      const foods = Array.isArray(results.foods.food)
        ? results.foods.food
        : [results.foods.food];

      return foods.map(food => fatSecretService.convertToFoodItem(food));
    } catch (error) {
      console.error('FatSecret search error:', error);
      return [];
    }
  }

  private async performFoodSearch(query: string): Promise<void> {
    if (query.length < 2) {
      const resultsDiv = document.getElementById('foodSearchResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 1.5rem; font-size: 0.875rem;">Start typing to search for foods...</div>';
      }
      return;
    }

    const resultsDiv = document.getElementById('foodSearchResults');
    if (resultsDiv) {
      resultsDiv.innerHTML = '<div style="text-align: center; padding: 1rem;"><div class="spinner" style="border: 3px solid var(--border); border-top: 3px solid var(--primary); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div></div>';
    }

    try {
      // Search: FatSecret (10,000/day) + Local database
      const [localResults, fatSecretResults] = await Promise.all([
        apiClient.searchFoods(query),
        this.searchFatSecret(query)
      ]);

      // Combine all sources: local, FatSecret
      const allExternalResults = [...fatSecretResults];

      this.displayFoodSearchResults(localResults.items || [], allExternalResults);

      // Show info about which sources returned results
      if (resultsDiv && fatSecretResults.length > 0) {
        const info = document.createElement('div');
        info.style.cssText = 'padding: 0.5rem; background: #e8f5e9; border: 1px solid #4caf50; border-radius: var(--radius); margin-bottom: 0.5rem; font-size: 0.75rem; color: #2e7d32;';
        info.textContent = `📊 FatSecret: ${fatSecretResults.length} results`;
        resultsDiv.insertBefore(info, resultsDiv.firstChild);
      }
    } catch (error) {
      console.error('Search error:', error);
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 1rem; font-size: 0.875rem;">Error searching foods.</div>';
      }
    }
  }

  private displayFoodSearchResults(local: FoodItem[], external: FoodItem[]): void {
    const resultsDiv = document.getElementById('foodSearchResults');
    if (!resultsDiv) return;

    // Deduplicate: remove local items that have the same fdc_id as external items
    const externalFdcIds = new Set(external.map(f => f.fdc_id).filter(id => id));
    const uniqueLocal = local.filter(f => !f.fdc_id || !externalFdcIds.has(f.fdc_id));

    // Combine and sort: exact matches first, then partial matches
    const allResults = [...uniqueLocal, ...external];
    const searchInput = (document.getElementById('foodSearchInput') as HTMLInputElement)?.value.toLowerCase() || '';

    allResults.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aExact = aName === searchInput;
      const bExact = bName === searchInput;
      const aStarts = aName.startsWith(searchInput);
      const bStarts = bName.startsWith(searchInput);

      // Exact matches first
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then starts-with matches
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Keep original order
      return 0;
    });

    if (allResults.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 1rem; font-size: 0.875rem;">No results found.</div>';
      return;
    }

    resultsDiv.innerHTML = allResults
      .slice(0, 50)
      .map(
        (food, idx) => {
          // FoodItem stores nutrition PER SERVING (not per 100g despite field name)
          const servingSize = food.serving_size_g || 1;
          const servingUnit = food.serving_size_unit || 'serving';

          // Display nutrition for ONE serving
          const servingCals = Math.round(food.calories_per_100g);
          const servingProtein = (food.protein_g || 0).toFixed(1);
          const servingCarbs = (food.carbs_g || 0).toFixed(1);
          const servingFat = (food.fat_g || 0).toFixed(1);

          // Format serving display (e.g., "1 egg", "100 g", "1 serving")
          const servingDisplay = servingSize === 1 ? servingUnit : `${servingSize} ${servingUnit}`;

          return `
        <div class="food-result" data-food='${JSON.stringify(food).replace(/'/g, "&apos;")}' data-index="${idx}" style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <div style="flex: 1; cursor: pointer;" class="food-info">
            <div style="font-weight: 500; margin-bottom: 0.125rem; font-size: 0.875rem;">
              ${food.name}
              ${food.data_source === 'fatsecret' ? '<span style="display: inline-block; padding: 0.125rem 0.375rem; background: var(--secondary); color: white; border-radius: 8px; font-size: 0.6rem; text-transform: uppercase; margin-left: 0.375rem;">FS</span>' : ''}
            </div>
            <div style="font-size: 0.7rem; color: var(--gray); display: flex; gap: 0.75rem;">
              <span>${servingCals} cal/${servingDisplay}</span>
              ${food.protein_g ? `<span>P:${servingProtein}g</span>` : ''}
              ${food.carbs_g ? `<span>C:${servingCarbs}g</span>` : ''}
              ${food.fat_g ? `<span>F:${servingFat}g</span>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem; align-items: center;">
            <input type="number" class="quick-qty" data-index="${idx}" value="1" min="0.5" step="0.5" style="width: 50px; padding: 0.25rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.75rem; text-align: center;">
            <span style="font-size: 0.7rem; color: var(--gray); min-width: 30px;">×</span>
            <button class="quick-add-btn" data-index="${idx}" style="padding: 0.25rem 0.5rem; background: var(--primary); color: white; border: none; border-radius: 4px; font-size: 0.7rem; cursor: pointer; white-space: nowrap;">Add</button>
          </div>
        </div>
      `;
        }
      )
      .join('');

    // Click on food info to select (shows in the form below)
    resultsDiv.querySelectorAll('.food-info').forEach((el) => {
      el.addEventListener('click', () => {
        const foodData = el.parentElement?.getAttribute('data-food');
        if (foodData) {
          this.selectFood(JSON.parse(foodData.replace(/&apos;/g, "'")));
        }
      });
    });

    // Quick add buttons
    resultsDiv.querySelectorAll('.quick-add-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = (btn as HTMLElement).dataset.index;
        const qtyInput = resultsDiv.querySelector(`.quick-qty[data-index="${idx}"]`) as HTMLInputElement;
        const foodEl = resultsDiv.querySelector(`.food-result[data-index="${idx}"]`);
        const foodData = foodEl?.getAttribute('data-food');

        if (foodData && qtyInput) {
          const food = JSON.parse(foodData.replace(/&apos;/g, "'"));
          const quantity = parseFloat(qtyInput.value) || 100;
          await this.quickAddFood(food, quantity);
        }
      });
    });
  }

  private async selectFood(food: FoodItem): Promise<void> {
    if (food.data_source === 'fatsecret' && (!food.id || food.id === 0)) {
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
        usda_fdc_id: food.fdc_id ? parseInt(food.fdc_id) : null,
      });
      food.id = result.item.id;
    }

    this.selectedFood = food;

    const infoDiv = document.getElementById('selectedFoodInfo');
    const nameDiv = document.getElementById('selectedFoodName');
    const nutritionDiv = document.getElementById('selectedFoodNutrition');
    const addBtn = document.getElementById('addFoodBtn') as HTMLButtonElement;

    if (infoDiv && nameDiv && nutritionDiv && addBtn) {
      infoDiv.style.display = 'block';
      nameDiv.textContent = `Selected: ${food.name}`;
      nutritionDiv.textContent = `${Math.round(food.calories_per_100g)} cal/100g | P: ${food.protein_g?.toFixed(1) || 0}g | C: ${food.carbs_g?.toFixed(1) || 0}g | F: ${food.fat_g?.toFixed(1) || 0}g`;
      addBtn.disabled = false;
      addBtn.style.opacity = '1';
    }
  }

  private async quickAddFood(food: FoodItem, servingMultiplier: number): Promise<void> {
    // Save FatSecret food to local DB if needed
    if (food.data_source === 'fatsecret' && (!food.id || food.id === 0)) {
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
        usda_fdc_id: food.fdc_id ? parseInt(food.fdc_id) : null,
      });
      food.id = result.item.id;
    }

    try {
      // Food items store nutrition PER SERVING
      // Multiply by servingMultiplier (e.g., 4 servings = 4×)
      const calories = (food.calories_per_100g || 0) * servingMultiplier;
      const protein = (food.protein_g || 0) * servingMultiplier;
      const carbs = (food.carbs_g || 0) * servingMultiplier;
      const fat = (food.fat_g || 0) * servingMultiplier;
      const fiber = (food.fiber_g || 0) * servingMultiplier;

      // For quantity_g, we'll store a nominal value (servings × serving_size_g)
      // This maintains compatibility with the database schema
      const quantityInGrams = servingMultiplier * (food.serving_size_g || 100);

      const dateStr = format(this.state.currentDate, 'yyyy-MM-dd');

      await apiClient.addFoodEntry({
        food_item_id: food.id,
        food_name: food.name,
        quantity_g: quantityInGrams,
        calories: Math.round(calories),
        protein_g: Math.round(protein * 10) / 10,
        carbs_g: Math.round(carbs * 10) / 10,
        fat_g: Math.round(fat * 10) / 10,
        fiber_g: Math.round(fiber * 10) / 10,
        meal_type: 'snack',
        date: dateStr,
      });

      this.showToast('Food added!', 'success');
      await this.refresh();
    } catch (error) {
      console.error('Error adding food:', error);
      this.showToast('Error adding food', 'error');
    }
  }

  private async saveFoodEntry(): Promise<void> {
    if (!this.selectedFood) return;

    const mealType = (document.getElementById('mealType') as HTMLSelectElement).value as
      | 'breakfast'
      | 'lunch'
      | 'dinner'
      | 'snack';
    const quantity = parseFloat((document.getElementById('foodQuantity') as HTMLInputElement).value);
    const unit = (document.getElementById('foodUnit') as HTMLSelectElement).value;

    const quantityInGrams = unit === 'oz' ? quantity * 28.3495 : quantity;

    try {
      const multiplier = quantityInGrams / 100;
      const calories = (this.selectedFood.calories_per_100g || 0) * multiplier;
      const protein = (this.selectedFood.protein_g || 0) * multiplier;
      const carbs = (this.selectedFood.carbs_g || 0) * multiplier;
      const fat = (this.selectedFood.fat_g || 0) * multiplier;
      const fiber = (this.selectedFood.fiber_g || 0) * multiplier;

      const dateStr = format(this.state.currentDate, 'yyyy-MM-dd');

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

      this.showToast('Food entry added!', 'success');

      // Reset form
      this.selectedFood = null;
      (document.getElementById('foodSearchInput') as HTMLInputElement).value = '';
      (document.getElementById('foodQuantity') as HTMLInputElement).value = '100';
      const infoDiv = document.getElementById('selectedFoodInfo');
      if (infoDiv) infoDiv.style.display = 'none';
      const addBtn = document.getElementById('addFoodBtn') as HTMLButtonElement;
      if (addBtn) {
        addBtn.disabled = true;
        addBtn.style.opacity = '0.5';
      }
      const resultsDiv = document.getElementById('foodSearchResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 1.5rem; font-size: 0.875rem;">Start typing to search for foods...</div>';
      }

      await this.refresh();
    } catch (error) {
      console.error('Error saving food entry:', error);
      this.showToast('Error adding food entry', 'error');
    }
  }

  private setupEntryActionListeners(): void {
    // Edit food entry buttons
    document.querySelectorAll('.edit-food-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entryId = (btn as HTMLElement).dataset.entryId;
        if (entryId) {
          this.openEditFoodModal(parseInt(entryId));
        }
      });
    });

    // Delete food entry buttons
    document.querySelectorAll('.delete-food-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const entryId = (btn as HTMLElement).dataset.entryId;
        if (entryId && confirm('Delete this food entry?')) {
          await this.deleteFoodEntry(parseInt(entryId));
        }
      });
    });
  }

  private openEditFoodModal(entryId: number): void {
    const entry = this.foodEntries.find(e => e.id === entryId);
    if (!entry) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '1000';
    modal.style.padding = '1rem';

    modal.innerHTML = `
      <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px;">
        <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Edit Food Entry</h2>
          <button id="closeEditModal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Food</label>
            <input type="text" value="${entry.food_name}" disabled style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem; background: var(--light);">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Quantity (g)</label>
            <input type="number" id="editQuantity" value="${entry.quantity_g}" min="1" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Meal Type</label>
            <select id="editMealType" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
              <option value="breakfast" ${entry.meal_type === 'breakfast' ? 'selected' : ''}>Breakfast</option>
              <option value="lunch" ${entry.meal_type === 'lunch' ? 'selected' : ''}>Lunch</option>
              <option value="dinner" ${entry.meal_type === 'dinner' ? 'selected' : ''}>Dinner</option>
              <option value="snack" ${entry.meal_type === 'snack' ? 'selected' : ''}>Snack</option>
            </select>
          </div>
          <button id="saveEditFood" class="btn btn-primary btn-block" style="padding: 0.75rem; width: 100%; border: none; background: var(--primary); color: white; border-radius: var(--radius); font-size: 1rem; cursor: pointer;">
            Save Changes
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeEditModal')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('#saveEditFood')?.addEventListener('click', async () => {
      const newQuantity = parseFloat((document.getElementById('editQuantity') as HTMLInputElement).value);
      const newMealType = (document.getElementById('editMealType') as HTMLSelectElement).value;

      await this.updateFoodEntry(entryId, newQuantity, newMealType);
      modal.remove();
    });
  }

  private async updateFoodEntry(entryId: number, newQuantityG: number, mealType: string): Promise<void> {
    const entry = this.foodEntries.find(e => e.id === entryId);
    if (!entry) return;

    try {
      // Recalculate nutrition based on new quantity
      const multiplier = newQuantityG / entry.quantity_g;
      const newCalories = Math.round(entry.calories * multiplier);
      const newProtein = Math.round((entry.protein_g || 0) * multiplier * 10) / 10;
      const newCarbs = Math.round((entry.carbs_g || 0) * multiplier * 10) / 10;
      const newFat = Math.round((entry.fat_g || 0) * multiplier * 10) / 10;
      const newFiber = Math.round((entry.fiber_g || 0) * multiplier * 10) / 10;

      await apiClient.updateFoodEntry(entryId, {
        quantity_g: newQuantityG,
        calories: newCalories,
        protein_g: newProtein,
        carbs_g: newCarbs,
        fat_g: newFat,
        fiber_g: newFiber,
        meal_type: mealType,
      });

      this.showToast('Food entry updated!', 'success');
      await this.refresh();
    } catch (error) {
      console.error('Error updating food entry:', error);
      this.showToast('Error updating entry', 'error');
    }
  }

  private async deleteFoodEntry(entryId: number): Promise<void> {
    try {
      await apiClient.deleteFoodEntry(entryId);
      this.showToast('Food entry deleted', 'success');
      await this.refresh();
    } catch (error) {
      console.error('Error deleting food entry:', error);
      this.showToast('Error deleting entry', 'error');
    }
  }

  private initializeModals(): void {
    if (!this.state.user) return;

    this.weightModal = new WeightModal(this.state.user.id, () => this.refresh());
  }

  private updateProgressRing(): void {
    // Progress ring removed in new design - keeping method for potential future use
  }

  private async renderChart(): Promise<void> {
    const ctx = document.getElementById('weeklyChart') as HTMLCanvasElement;
    if (!ctx) return;

    try {
      // Get last 7 days of data
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const startDate = format(sevenDaysAgo, 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');

      const weeklyData = await apiClient.getWeeklySummary(startDate, endDate);

      // Extract labels and data
      const labels: string[] = [];
      const caloriesIn: number[] = [];
      const caloriesBurned: number[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(sevenDaysAgo.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayData = weeklyData.daily.find((d: any) => d.date === dateStr);

        labels.push(format(date, 'EEE'));
        caloriesIn.push(dayData?.calories_consumed || 0);
        caloriesBurned.push(dayData?.calories_burned || 0);
      }

      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Calories In',
              data: caloriesIn,
              borderColor: '#4CAF50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              tension: 0.3,
              fill: true,
            },
            {
              label: 'Calories Burned',
              data: caloriesBurned,
              borderColor: '#ff9800',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 11,
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
          },
        },
      },
      });
    } catch (error) {
      console.error('Failed to render chart:', error);
    }
  }

  private renderEntries(): string {
    const hasEntries = this.foodEntries.length > 0 || this.activityEntries.length > 0;

    if (!hasEntries) {
      return `
        <div style="text-align: center; padding: 2rem; color: var(--gray);">
          No entries yet. Add food or activities above!
        </div>
      `;
    }

    let html = '';

    // Render food entries
    if (this.foodEntries.length > 0) {
      html += '<div style="margin-bottom: 1.5rem;"><h3 style="font-size: 1rem; font-weight: 600; color: var(--primary); margin-bottom: 0.75rem;">🍎 Food</h3>';
      this.foodEntries.forEach(entry => {
        const time = entry.time ? format(new Date(`2000-01-01 ${entry.time}`), 'h:mm a') : '';
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light); border-radius: var(--radius); margin-bottom: 0.5rem; gap: 0.5rem;">
            <div style="flex: 1;">
              <div style="font-weight: 500;">${entry.food_name}</div>
              <div style="font-size: 0.875rem; color: var(--gray);">
                ${Math.round(entry.quantity_g)}g
                ${entry.meal_type ? `• ${entry.meal_type}` : ''}
                ${time ? `• ${time}` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 600; color: var(--primary);">${Math.round(entry.calories)} cal</div>
              <div style="font-size: 0.75rem; color: var(--gray);">
                P: ${Math.round(entry.protein_g || 0)}g • C: ${Math.round(entry.carbs_g || 0)}g • F: ${Math.round(entry.fat_g || 0)}g
              </div>
            </div>
            <div style="display: flex; gap: 0.25rem;">
              <button class="edit-food-btn" data-entry-id="${entry.id}" style="padding: 0.25rem 0.5rem; background: var(--secondary); color: white; border: none; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Edit</button>
              <button class="delete-food-btn" data-entry-id="${entry.id}" style="padding: 0.25rem 0.5rem; background: var(--danger); color: white; border: none; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Del</button>
            </div>
          </div>
        `;
      });
      html += '</div>';

      // Protein recommendation if low
      const protein = Math.round(this.dailySummary?.macros?.protein_g || 0);
      const proteinGoal = this.dailySummary?.macro_goals?.protein_g || 150;
      const proteinRemaining = proteinGoal - protein;

      if (proteinRemaining > 30) {
        const suggestions = [
          { name: 'Chicken Breast (100g)', protein: '31g', calories: '165 cal' },
          { name: 'Greek Yogurt (170g)', protein: '17g', calories: '100 cal' },
          { name: 'Protein Shake', protein: '25g', calories: '120 cal' },
          { name: 'Tuna (100g)', protein: '30g', calories: '132 cal' },
          { name: 'Eggs (2 large)', protein: '13g', calories: '140 cal' }
        ];

        html += `
          <div style="padding: 1rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: var(--radius); margin-bottom: 1.5rem;">
            <div style="font-weight: 600; color: #856404; margin-bottom: 0.5rem;">💪 You need ${proteinRemaining}g more protein today</div>
            <div style="font-size: 0.85rem; color: #856404; margin-bottom: 0.75rem;">High-protein food suggestions:</div>
            <div style="display: grid; gap: 0.5rem;">
              ${suggestions.map(s => `
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #856404;">
                  <span>${s.name}</span>
                  <span><strong>${s.protein}</strong> • ${s.calories}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    // Render activity entries
    if (this.activityEntries.length > 0) {
      html += '<div><h3 style="font-size: 1rem; font-weight: 600; color: var(--warning); margin-bottom: 0.75rem;">🏃 Activities</h3>';
      this.activityEntries.forEach(entry => {
        const time = entry.time ? format(new Date(`2000-01-01 ${entry.time}`), 'h:mm a') : '';
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light); border-radius: var(--radius); margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 500;">${entry.activity_name || 'Activity'}</div>
              <div style="font-size: 0.875rem; color: var(--gray);">
                ${entry.quantity} ${entry.unit || ''}
                ${time ? `• ${time}` : ''}
                ${entry.notes ? `• ${entry.notes}` : ''}
              </div>
            </div>
            <div style="font-weight: 600; color: var(--warning);">-${Math.round(entry.calories_burned)} cal</div>
          </div>
        `;
      });
      html += '</div>';
    }

    return html;
  }

  private async refresh(): Promise<void> {
    await this.loadTodayData();
    const container = document.getElementById('app');
    if (container) {
      await this.render(container);
    }
  }

}
