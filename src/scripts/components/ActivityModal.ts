// Activity Entry Modal Component
import { DatabaseService } from '../db/DatabaseService';
import type { Activity } from '@/types/models';

export class ActivityModal {
  private db: DatabaseService;
  private userId: number;
  private currentDate: Date;
  private onSave: () => void;
  private modalElement: HTMLElement | null = null;
  private activities: Activity[] = [];

  constructor(db: DatabaseService, userId: number, currentDate: Date, onSave: () => void) {
    this.db = db;
    this.userId = userId;
    this.currentDate = currentDate;
    this.onSave = onSave;
    this.loadActivities();
    this.createModal();
  }

  private async loadActivities(): Promise<void> {
    this.activities = await this.db.getAllActivities();
  }

  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'activityModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Add Activity</h2>
          <button id="closeActivityModal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Activity Type</label>
            <select id="activityType" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
              <option value="">Loading...</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Duration</label>
              <input type="number" id="duration" value="30" min="1" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Unit</label>
              <select id="durationUnit" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Notes (optional)</label>
            <input type="text" id="activityNotes" placeholder="Morning run in the park" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>

          <div style="padding: 1rem; background: var(--light); border-radius: var(--radius); margin-bottom: 1rem;">
            <div style="text-align: center; color: var(--gray); font-size: 0.875rem;">Estimated Calories Burned</div>
            <div id="estimatedCalories" style="text-align: center; font-size: 2rem; font-weight: bold; color: var(--warning);">0</div>
          </div>

          <button id="saveActivityEntry" style="width: 100%; padding: 0.75rem 1.5rem; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 500; cursor: pointer; background: var(--primary); color: white;">
            Add Activity
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalElement = modal;

    // Setup event listeners
    this.setupEventListeners();
    this.populateActivities();
  }

  private async populateActivities(): Promise<void> {
    await this.loadActivities();
    const select = document.getElementById('activityType') as HTMLSelectElement;
    if (select) {
      select.innerHTML = this.activities
        .map((activity) => `<option value="${activity.id}">${activity.name}</option>`)
        .join('');

      // Trigger initial calculation
      this.updateCalorieEstimate();
    }
  }

  private setupEventListeners(): void {
    const closeBtn = document.getElementById('closeActivityModal');
    const saveBtn = document.getElementById('saveActivityEntry');
    const activitySelect = document.getElementById('activityType') as HTMLSelectElement;
    const durationInput = document.getElementById('duration') as HTMLInputElement;
    const unitSelect = document.getElementById('durationUnit') as HTMLSelectElement;

    closeBtn?.addEventListener('click', () => this.close());

    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    saveBtn?.addEventListener('click', () => this.saveActivityEntry());

    // Update calorie estimate when inputs change
    activitySelect?.addEventListener('change', () => this.updateCalorieEstimate());
    durationInput?.addEventListener('input', () => this.updateCalorieEstimate());
    unitSelect?.addEventListener('change', () => this.updateCalorieEstimate());
  }

  private updateCalorieEstimate(): void {
    const activitySelect = document.getElementById('activityType') as HTMLSelectElement;
    const durationInput = document.getElementById('duration') as HTMLInputElement;
    const unitSelect = document.getElementById('durationUnit') as HTMLSelectElement;
    const estimateDiv = document.getElementById('estimatedCalories');

    if (!activitySelect || !durationInput || !unitSelect || !estimateDiv) return;

    const activityId = parseInt(activitySelect.value);
    const activity = this.activities.find((a) => a.id === activityId);

    if (!activity) {
      estimateDiv.textContent = '0';
      return;
    }

    let duration = parseFloat(durationInput.value) || 0;
    if (unitSelect.value === 'hours') {
      duration *= 60;
    }

    const estimatedCalories = Math.round(activity.calories_per_minute * duration);
    estimateDiv.textContent = String(estimatedCalories);
  }

  private async saveActivityEntry(): Promise<void> {
    const activitySelect = document.getElementById('activityType') as HTMLSelectElement;
    const durationInput = document.getElementById('duration') as HTMLInputElement;
    const unitSelect = document.getElementById('durationUnit') as HTMLSelectElement;
    const notesInput = document.getElementById('activityNotes') as HTMLInputElement;

    const activityId = parseInt(activitySelect.value);
    let duration = parseFloat(durationInput.value) || 0;
    if (unitSelect.value === 'hours') {
      duration *= 60;
    }
    const notes = notesInput.value;

    const activity = this.activities.find((a) => a.id === activityId);
    if (!activity) return;

    const caloriesBurned = activity.calories_per_minute * duration;

    try {
      await this.db.createActivityEntry({
        user_id: this.userId,
        activity_id: activityId,
        duration_minutes: Math.round(duration),
        calories_burned: caloriesBurned,
        date: this.currentDate,
        notes: notes || undefined,
      });

      this.showToast('Activity added successfully!', 'success');
      this.close();
      this.onSave();
    } catch (error) {
      console.error('Error saving activity entry:', error);
      this.showToast('Error adding activity', 'error');
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
      (document.getElementById('duration') as HTMLInputElement).value = '30';
      (document.getElementById('activityNotes') as HTMLInputElement).value = '';
    }
  }
}
