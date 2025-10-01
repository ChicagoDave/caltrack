// Main application controller
import { LoginView } from '../views/LoginView';
import { DashboardView } from '../views/DashboardView';
import { AppState } from '@/types/models';

export class CalTrackApp {
  private state: AppState;
  private currentView: DashboardView | LoginView | null = null;

  constructor() {
    this.state = {
      user: null,
      isAuthenticated: false,
      currentDate: new Date(),
      syncStatus: 'idle',
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing CalTrack...');

      // Check for existing session
      const savedToken = localStorage.getItem('caltrack_token');
      const savedUser = localStorage.getItem('caltrack_user');

      if (savedToken && savedUser) {
        this.state.user = JSON.parse(savedUser);
        this.state.isAuthenticated = true;
        this.renderDashboard();
      } else {
        this.renderLogin();
      }

      console.log('✅ CalTrack initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }

  private renderLogin(): void {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    this.currentView = new LoginView(appContainer, (_token, user) => {
      this.state.user = user;
      this.state.isAuthenticated = true;
      this.renderDashboard();
    });

    this.currentView.render();
  }

  private async renderDashboard(): Promise<void> {
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      throw new Error('App container not found');
    }

    this.currentView = new DashboardView(this.state);
    await this.currentView.render(appContainer);

    // Add logout button to header
    this.addLogoutButton();
  }

  private addLogoutButton(): void {
    // Find the header in the dashboard and add logout button
    const header = document.querySelector('.container .card h1');
    if (header && header.parentElement) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logout-btn';
      logoutBtn.textContent = 'Logout';
      logoutBtn.style.cssText = 'padding: 0.5rem 1rem; cursor: pointer; background: var(--danger); color: white; border: none; border-radius: var(--radius); font-size: 0.9rem;';
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('caltrack_token');
        localStorage.removeItem('caltrack_user');
        this.state.user = null;
        this.state.isAuthenticated = false;
        this.renderLogin();
      });

      // Find the date element and insert logout button before it
      const dateElement = header.parentElement.querySelector('[style*="font-size: 0.9rem"]');
      if (dateElement) {
        dateElement.parentElement?.insertBefore(logoutBtn, dateElement);
      }
    }
  }

  private showError(message: string): void {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--danger);">
          <h2>Error</h2>
          <p>${message}</p>
        </div>
      `;
    }
  }
}
