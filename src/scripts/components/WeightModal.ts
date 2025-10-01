// Weight Entry Modal Component
import { apiClient } from '@/api/api-client';
import { format } from 'date-fns';

export class WeightModal {
  private onSave: () => void;
  private modalElement: HTMLElement | null = null;

  constructor(_userId: number, onSave: () => void) {
    this.onSave = onSave;
    this.createModal();
  }

  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'weightModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Update Weight</h2>
          <button id="closeWeightModal" style="width: 32px; height: 32px; border: none; background: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">×</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Weight Type</label>
            <select id="weightType" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
              <option value="current">Current Weight</option>
              <option value="goal">Goal Weight</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Weight</label>
              <input type="number" step="0.1" id="weightValue" placeholder="75.0" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Unit</label>
              <select id="weightUnit" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
          </div>

          <div id="targetDateGroup" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Target Date</label>
            <input type="date" id="targetDate" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: var(--radius); font-size: 1rem;">
          </div>

          <button id="saveWeightEntry" style="width: 100%; padding: 0.75rem 1.5rem; border: none; border-radius: var(--radius); font-size: 1rem; font-weight: 500; cursor: pointer; background: var(--primary); color: white;">
            Update Weight
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
    if (!this.modalElement) {
      console.error('Modal element not found when setting up listeners');
      return;
    }

    const closeBtn = this.modalElement.querySelector('#closeWeightModal');
    const saveBtn = this.modalElement.querySelector('#saveWeightEntry');
    const weightTypeSelect = this.modalElement.querySelector('#weightType') as HTMLSelectElement;
    const targetDateGroup = this.modalElement.querySelector('#targetDateGroup');

    console.log('Weight modal elements found:', {
      closeBtn: !!closeBtn,
      saveBtn: !!saveBtn,
      weightTypeSelect: !!weightTypeSelect,
      targetDateGroup: !!targetDateGroup
    });

    closeBtn?.addEventListener('click', () => {
      console.log('Close button clicked');
      this.close();
    });

    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        console.log('Background clicked');
        this.close();
      }
    });

    saveBtn?.addEventListener('click', async () => {
      console.log('Save button clicked');
      await this.saveWeightEntry();
    });

    weightTypeSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (targetDateGroup) {
        (targetDateGroup as HTMLElement).style.display = target.value === 'goal' ? 'block' : 'none';
      }
    });
  }

  private async saveWeightEntry(): Promise<void> {
    console.log('saveWeightEntry called');

    const weightType = (this.modalElement?.querySelector('#weightType') as HTMLSelectElement)?.value;
    const weightValue = parseFloat((this.modalElement?.querySelector('#weightValue') as HTMLInputElement)?.value || '0');
    const weightUnit = (this.modalElement?.querySelector('#weightUnit') as HTMLSelectElement)?.value;
    const targetDate = (this.modalElement?.querySelector('#targetDate') as HTMLInputElement)?.value;

    console.log('Weight data:', { weightType, weightValue, weightUnit, targetDate });

    if (!weightValue || isNaN(weightValue)) {
      this.showToast('Please enter a valid weight', 'error');
      return;
    }

    // Convert lbs to kg if needed
    const weightInKg = weightUnit === 'lbs' ? weightValue * 0.453592 : weightValue;

    try {
      if (weightType === 'current') {
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        await apiClient.addWeightEntry(weightInKg, dateStr);
        this.showToast('Weight entry added successfully!', 'success');
      } else {
        await apiClient.setWeightGoal(weightInKg, targetDate || undefined);
        this.showToast('Weight goal set successfully!', 'success');
      }

      this.close();
      this.onSave();
    } catch (error) {
      console.error('Error saving weight entry:', error);
      this.showToast('Error saving weight', 'error');
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
      const weightValue = this.modalElement.querySelector('#weightValue') as HTMLInputElement;
      const weightType = this.modalElement.querySelector('#weightType') as HTMLSelectElement;
      const targetDateGroup = this.modalElement.querySelector('#targetDateGroup') as HTMLElement;

      if (weightValue) weightValue.value = '';
      if (weightType) weightType.value = 'current';
      if (targetDateGroup) targetDateGroup.style.display = 'none';
    }
  }
}
