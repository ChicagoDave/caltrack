// Workout Logging Modal Component
import { apiClient } from '@/api/api-client';
import { format } from 'date-fns';

export class WorkoutModal {
  private onSave: () => void;
  private modalElement: HTMLElement | null = null;
  private currentSession: any = null;
  private templates: any[] = [];
  private workoutDay: string = '';

  constructor(onSave: () => void) {
    this.onSave = onSave;
  }

  async open(workoutDay: 'monday' | 'wednesday' | 'friday'): Promise<void> {
    this.workoutDay = workoutDay;

    // Load templates for this day
    const response = await apiClient.getWorkoutTemplates(workoutDay);
    this.templates = response.templates;

    // Create session for today
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const sessionResponse = await apiClient.createWorkoutSession(workoutDay, dateStr);
    this.currentSession = sessionResponse.session;

    this.createModal();
    this.showModal();
  }

  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'workoutModal';
    modal.className = 'modal';

    const dayName = this.workoutDay.charAt(0).toUpperCase() + this.workoutDay.slice(1);
    const workoutTitle = this.getWorkoutTitle(this.workoutDay);

    modal.innerHTML = `
      <div class="modal-content" style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem;">${dayName} - ${workoutTitle}</h2>
            <div style="font-size: 0.875rem; color: var(--gray);">Log your sets for each exercise</div>
          </div>
          <button id="closeWorkoutModal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <div id="exercisesList">
            ${this.renderExercises()}
          </div>
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
            <button id="completeWorkout" class="btn btn-primary" style="width: 100%; padding: 0.75rem; background: var(--success); color: white; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 500; cursor: pointer;">
              ✅ Complete Workout
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalElement = modal;

    this.setupEventListeners();
  }

  private getWorkoutTitle(day: string): string {
    const titles: { [key: string]: string } = {
      monday: 'Upper Body Push',
      wednesday: 'Lower Body',
      friday: 'Upper Body Pull',
    };
    return titles[day] || 'Workout';
  }

  private renderExercises(): string {
    return this.templates.map((template, idx) => `
      <div class="exercise-card" data-exercise="${template.exercise_name}" style="margin-bottom: 1.5rem; padding: 1rem; border: 2px solid var(--border); border-radius: var(--radius); background: var(--light);">
        <div style="margin-bottom: 0.75rem;">
          <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem;">${idx + 1}. ${template.exercise_name}</div>
          <div style="font-size: 0.875rem; color: var(--gray); margin-bottom: 0.25rem;">
            ${template.sets} sets × ${template.reps} reps | Rest: ${template.rest_seconds}s
          </div>
          ${template.notes ? `<div style="font-size: 0.75rem; color: var(--warning); background: #fff3cd; padding: 0.25rem 0.5rem; border-radius: 4px; margin-top: 0.25rem;">⚠️ ${template.notes}</div>` : ''}
        </div>

        <div class="sets-container" id="sets-${this.sanitizeId(template.exercise_name)}">
          ${this.renderSetInputs(template)}
        </div>
      </div>
    `).join('');
  }

  private renderSetInputs(template: any): string {
    const setCount = template.sets;
    let html = '';

    for (let i = 1; i <= setCount; i++) {
      html += `
        <div class="set-row" style="display: grid; grid-template-columns: 50px 1fr 1fr 60px; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <div style="font-size: 0.875rem; font-weight: 500; color: var(--gray);">Set ${i}</div>
          <input
            type="number"
            step="0.5"
            placeholder="Weight (lbs)"
            class="set-weight"
            data-exercise="${template.exercise_name}"
            data-set="${i}"
            style="padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.875rem;"
          >
          <input
            type="number"
            placeholder="Reps"
            class="set-reps"
            data-exercise="${template.exercise_name}"
            data-set="${i}"
            style="padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 0.875rem;"
          >
          <button
            class="log-set-btn"
            data-exercise="${template.exercise_name}"
            data-set="${i}"
            style="padding: 0.5rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 0.875rem; cursor: pointer; font-weight: 500;"
          >
            ✓
          </button>
        </div>
      `;
    }

    return html;
  }

  private sanitizeId(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }

  private setupEventListeners(): void {
    if (!this.modalElement) return;

    // Close button
    this.modalElement.querySelector('#closeWorkoutModal')?.addEventListener('click', () => {
      this.close();
    });

    // Background click
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    // Log set buttons
    this.modalElement.querySelectorAll('.log-set-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.target as HTMLElement;
        const exercise = button.dataset.exercise!;
        const setNumber = parseInt(button.dataset.set!);

        const weightInput = this.modalElement?.querySelector(`.set-weight[data-exercise="${exercise}"][data-set="${setNumber}"]`) as HTMLInputElement;
        const repsInput = this.modalElement?.querySelector(`.set-reps[data-exercise="${exercise}"][data-set="${setNumber}"]`) as HTMLInputElement;

        const weight = parseFloat(weightInput.value);
        const reps = parseInt(repsInput.value);

        if (!weight || !reps || isNaN(weight) || isNaN(reps)) {
          this.showToast('Please enter weight and reps', 'error');
          return;
        }

        await this.logSet(exercise, setNumber, weight, reps);
      });
    });

    // Complete workout button
    this.modalElement.querySelector('#completeWorkout')?.addEventListener('click', async () => {
      await this.completeWorkout();
    });
  }

  private async logSet(exercise: string, setNumber: number, weight: number, reps: number): Promise<void> {
    try {
      await apiClient.logWorkoutSet(this.currentSession.id, exercise, setNumber, weight, reps);

      // Visual feedback
      const button = this.modalElement?.querySelector(`.log-set-btn[data-exercise="${exercise}"][data-set="${setNumber}"]`) as HTMLButtonElement;
      if (button) {
        button.style.background = 'var(--success)';
        button.textContent = '✓ Logged';
        button.disabled = true;
      }

      this.showToast(`Set ${setNumber} logged!`, 'success');
    } catch (error) {
      console.error('Error logging set:', error);
      this.showToast('Error logging set', 'error');
    }
  }

  private async completeWorkout(): Promise<void> {
    try {
      // Calculate duration (for now, use a default or ask user)
      const duration = 45; // Default 45 minutes

      await apiClient.completeWorkoutSession(this.currentSession.id, duration);

      this.showToast('Workout completed! 💪', 'success');

      setTimeout(() => {
        this.close();
        this.onSave();
      }, 1000);
    } catch (error) {
      console.error('Error completing workout:', error);
      this.showToast('Error completing workout', 'error');
    }
  }

  private showModal(): void {
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

  private close(): void {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
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
}
