// API Client for CalTrack Backend

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('caltrack_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('caltrack_token');
          localStorage.removeItem('caltrack_user');
          window.location.reload();
        }

        const error = await response.json();
        throw new Error(error.error?.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(username: string, email: string, password: string) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  // User
  async getProfile() {
    return this.request<{ user: any }>('/users/me');
  }

  async updateProfile(data: any) {
    return this.request<{ user: any }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Food Entries
  async getFoodEntries(date: string) {
    return this.request<{ entries: any[] }>(`/foods/entries/${date}`);
  }

  async addFoodEntry(entry: any) {
    return this.request<{ entry: any }>('/foods/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateFoodEntry(id: number, entry: any) {
    return this.request<{ entry: any }>(`/foods/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
  }

  async deleteFoodEntry(id: number) {
    return this.request<{ message: string }>(`/foods/entries/${id}`, {
      method: 'DELETE',
    });
  }

  async searchFoods(query: string) {
    return this.request<{ items: any[] }>(`/foods/search?q=${encodeURIComponent(query)}`);
  }

  async addFoodItem(item: any) {
    return this.request<{ item: any }>('/foods/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  // Activities
  async getActivities() {
    return this.request<{ activities: any[] }>('/activities');
  }

  async getActivityEntries(date: string) {
    return this.request<{ entries: any[] }>(`/activities/entries/${date}`);
  }

  async addActivityEntry(entry: any) {
    return this.request<{ entry: any }>('/activities/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateActivityEntry(id: number, entry: any) {
    return this.request<{ entry: any }>(`/activities/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
  }

  async deleteActivityEntry(id: number) {
    return this.request<{ message: string }>(`/activities/entries/${id}`, {
      method: 'DELETE',
    });
  }

  // Weight
  async getWeightEntries(params?: { start_date?: string; end_date?: string; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.set('start_date', params.start_date);
    if (params?.end_date) queryParams.set('end_date', params.end_date);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<{ entries: any[] }>(`/weight/entries${query}`);
  }

  async getLatestWeight() {
    return this.request<{ entry: any | null }>('/weight/entries/latest');
  }

  async addWeightEntry(weight_kg: number, date: string, notes?: string) {
    return this.request<{ entry: any }>('/weight/entries', {
      method: 'POST',
      body: JSON.stringify({ weight_kg, date, notes }),
    });
  }

  async deleteWeightEntry(id: number) {
    return this.request<{ message: string }>(`/weight/entries/${id}`, {
      method: 'DELETE',
    });
  }

  async getWeightGoal() {
    return this.request<{ goal: any | null }>('/weight/goal');
  }

  async setWeightGoal(target_weight_kg: number, target_date?: string) {
    return this.request<{ goal: any }>('/weight/goal', {
      method: 'POST',
      body: JSON.stringify({ target_weight_kg, target_date }),
    });
  }

  // Stats
  async getDailySummary(date: string) {
    return this.request<{ summary: any }>(`/stats/daily/${date}`);
  }

  async getWeeklySummary(start_date: string, end_date: string) {
    return this.request<any>(`/stats/weekly?start_date=${start_date}&end_date=${end_date}`);
  }

  async getProgress(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<any>(`/stats/progress${query}`);
  }
}

export const apiClient = new ApiClient();
