// Login View - User selection and authentication
export class LoginView {
  private container: HTMLElement;
  private onLoginSuccess: (token: string, user: any) => void;

  constructor(container: HTMLElement, onLoginSuccess: (token: string, user: any) => void) {
    this.container = container;
    this.onLoginSuccess = onLoginSuccess;
  }

  render(): void {
    this.container.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <h1>🍎 CalTrack</h1>
          <p class="login-subtitle">Select your profile to continue</p>

          <div class="user-selection">
            <button class="user-btn" data-user="dad@family.local">
              <span class="user-icon">👨</span>
              <span class="user-name">Dad</span>
            </button>

            <button class="user-btn" data-user="tori@family.local">
              <span class="user-icon">👩</span>
              <span class="user-name">Tori</span>
            </button>

            <button class="user-btn" data-user="angie@family.local">
              <span class="user-icon">👧</span>
              <span class="user-name">Angie</span>
            </button>

            <button class="user-btn" data-user="gabby@family.local">
              <span class="user-icon">👧</span>
              <span class="user-name">Gabby</span>
            </button>
          </div>

          <div class="login-error" id="login-error" style="display: none;"></div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const userButtons = this.container.querySelectorAll('.user-btn');
    userButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget as HTMLElement;
        const email = button.dataset.user;
        if (email) {
          await this.handleLogin(email);
        }
      });
    });
  }

  private async handleLogin(email: string): Promise<void> {
    const errorDiv = document.getElementById('login-error');
    const password = 'changeme123'; // Default password for all users

    try {
      if (errorDiv) {
        errorDiv.style.display = 'none';
      }

      // Disable all buttons during login
      const buttons = this.container.querySelectorAll('.user-btn');
      buttons.forEach(btn => {
        (btn as HTMLButtonElement).disabled = true;
      });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      // Store token and user info
      localStorage.setItem('caltrack_token', data.token);
      localStorage.setItem('caltrack_user', JSON.stringify(data.user));

      // Call success callback
      this.onLoginSuccess(data.token, data.user);

    } catch (error) {
      console.error('Login error:', error);
      if (errorDiv) {
        errorDiv.textContent = error instanceof Error ? error.message : 'Login failed. Please try again.';
        errorDiv.style.display = 'block';
      }

      // Re-enable buttons
      const buttons = this.container.querySelectorAll('.user-btn');
      buttons.forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
      });
    }
  }
}
