// Database Service using SQL.js for client-side SQLite
import type { Database, SqlJsStatic } from 'sql.js';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  User,
  FoodItem,
  FoodEntry,
  ActivityEntry,
  WeightEntry,
  WeightGoal,
  UserRegistrationData,
  DailySummary,
} from '@/types/models';

// IndexedDB schema for persisting the SQLite database
interface CalTrackDB extends DBSchema {
  sqliteDb: {
    key: string;
    value: Uint8Array;
  };
}

export class DatabaseService {
  private db: Database | null = null;
  private idb: IDBPDatabase<CalTrackDB> | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load SQL.js dynamically from CDN
      const initSqlJs: any = await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
        script.onload = () => {
          // @ts-ignore - SQL is loaded globally
          resolve(window.initSqlJs || window.SQL);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });

      const SQL: SqlJsStatic = await initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
      });

      // Initialize IndexedDB for persistence
      this.idb = await openDB<CalTrackDB>('caltrack-db', 1, {
        upgrade(db) {
          db.createObjectStore('sqliteDb');
        },
      });

      // Try to load existing database from IndexedDB
      const savedDb = await this.idb.get('sqliteDb', 'main');

      if (savedDb) {
        this.db = new SQL.Database(savedDb);
        console.log('Loaded existing database from IndexedDB');
      } else {
        this.db = new SQL.Database();
        await this.createTables();
        await this.saveDatabase();
        console.log('Created new database');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        height_cm REAL,
        birth_date DATE,
        gender TEXT CHECK(gender IN ('male', 'female', 'other')),
        activity_level TEXT CHECK(activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'))
      );

      -- Weight entries table
      CREATE TABLE IF NOT EXISTS weight_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        weight_kg REAL NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Weight goals table
      CREATE TABLE IF NOT EXISTS weight_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_weight_kg REAL NOT NULL,
        target_date DATE,
        daily_calorie_target INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Food items table
      CREATE TABLE IF NOT EXISTS food_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT,
        calories_per_100g REAL NOT NULL,
        protein_g REAL,
        carbs_g REAL,
        fat_g REAL,
        fiber_g REAL,
        sugar_g REAL,
        sodium_mg REAL,
        user_id INTEGER,
        is_custom BOOLEAN DEFAULT 0,
        fdc_id TEXT,
        barcode TEXT,
        data_source TEXT CHECK(data_source IN ('usda', 'custom', 'verified')),
        last_synced TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Food entries table
      CREATE TABLE IF NOT EXISTS food_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        food_item_id INTEGER NOT NULL,
        quantity_g REAL NOT NULL,
        meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (food_item_id) REFERENCES food_items(id)
      );

      -- Activities table
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        calories_per_minute REAL NOT NULL,
        category TEXT,
        met_value REAL
      );

      -- Activity entries table
      CREATE TABLE IF NOT EXISTS activity_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        calories_burned REAL NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_activity_entries_user_date ON activity_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON weight_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_food_items_fdc_id ON food_items(fdc_id);
    `;

    this.db.run(tables);

    // Insert some default activities
    await this.insertDefaultActivities();
  }

  private async insertDefaultActivities(): Promise<void> {
    if (!this.db) return;

    const activities = [
      { name: 'Walking (5 km/h)', calories_per_minute: 3.5, category: 'cardio', met_value: 3.5 },
      { name: 'Running (8 km/h)', calories_per_minute: 8.0, category: 'cardio', met_value: 8.0 },
      { name: 'Cycling (20 km/h)', calories_per_minute: 7.0, category: 'cardio', met_value: 7.0 },
      { name: 'Swimming', calories_per_minute: 6.0, category: 'cardio', met_value: 6.0 },
      { name: 'Weight Training', calories_per_minute: 4.0, category: 'strength', met_value: 4.0 },
      { name: 'Yoga', calories_per_minute: 2.5, category: 'flexibility', met_value: 2.5 },
    ];

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO activities (name, calories_per_minute, category, met_value) VALUES (?, ?, ?, ?)'
    );

    for (const activity of activities) {
      stmt.run([activity.name, activity.calories_per_minute, activity.category, activity.met_value]);
    }

    stmt.free();
  }

  private async saveDatabase(): Promise<void> {
    if (!this.db || !this.idb) return;

    const data = this.db.export();
    await this.idb.put('sqliteDb', data, 'main');
  }

  // User operations
  async createUser(data: UserRegistrationData): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'INSERT INTO users (username, email, height_cm, birth_date, gender, activity_level) VALUES (?, ?, ?, ?, ?, ?)'
    );

    stmt.run([
      data.username,
      data.email,
      data.height_cm || null,
      data.birth_date ? data.birth_date.toISOString() : null,
      data.gender || null,
      data.activity_level || null,
    ]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async getUser(id: number): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM users WHERE id = ?', [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.rowToUser(result[0].columns, row);
  }

  // Food operations
  async createFoodItem(item: Omit<FoodItem, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO food_items (name, brand, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, user_id, is_custom, fdc_id, barcode, data_source, last_synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      item.name,
      item.brand || null,
      item.calories_per_100g,
      item.protein_g || null,
      item.carbs_g || null,
      item.fat_g || null,
      item.fiber_g || null,
      item.sugar_g || null,
      item.sodium_mg || null,
      item.user_id || null,
      item.is_custom ? 1 : 0,
      item.fdc_id || null,
      item.barcode || null,
      item.data_source || null,
      item.last_synced ? item.last_synced.toISOString() : null,
    ]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async searchFoodItems(query: string): Promise<FoodItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM food_items WHERE name LIKE ? OR brand LIKE ? LIMIT 20',
      [`%${query}%`, `%${query}%`]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => this.rowToFoodItem(result[0].columns, row));
  }

  async createFoodEntry(entry: Omit<FoodEntry, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO food_entries (user_id, food_item_id, quantity_g, meal_type, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run([entry.user_id, entry.food_item_id, entry.quantity_g, entry.meal_type, entry.date.toISOString()]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async getFoodEntriesForDate(userId: number, date: Date): Promise<FoodEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const dateStr = date.toISOString().split('T')[0];
    const result = this.db.exec(
      `
      SELECT fe.*, fi.*
      FROM food_entries fe
      JOIN food_items fi ON fe.food_item_id = fi.id
      WHERE fe.user_id = ? AND DATE(fe.date) = ?
      ORDER BY fe.created_at DESC
    `,
      [userId, dateStr]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => this.rowToFoodEntry(result[0].columns, row));
  }

  // Activity operations
  async createActivityEntry(entry: Omit<ActivityEntry, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO activity_entries (user_id, activity_id, duration_minutes, calories_burned, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      entry.user_id,
      entry.activity_id,
      entry.duration_minutes,
      entry.calories_burned,
      entry.date.toISOString(),
      entry.notes || null,
    ]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async getActivityEntriesForDate(userId: number, date: Date): Promise<ActivityEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const dateStr = date.toISOString().split('T')[0];
    const result = this.db.exec(
      `
      SELECT ae.*, a.*
      FROM activity_entries ae
      JOIN activities a ON ae.activity_id = a.id
      WHERE ae.user_id = ? AND DATE(ae.date) = ?
      ORDER BY ae.created_at DESC
    `,
      [userId, dateStr]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => this.rowToActivityEntry(result[0].columns, row));
  }

  async getAllActivities() {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM activities ORDER BY name');

    if (result.length === 0) return [];

    return result[0].values.map((row) => {
      const [id, name, calories_per_minute, category, met_value] = row;
      return {
        id: id as number,
        name: name as string,
        calories_per_minute: calories_per_minute as number,
        category: category as string,
        met_value: met_value as number,
      };
    });
  }

  // Weight operations
  async createWeightEntry(entry: Omit<WeightEntry, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('INSERT INTO weight_entries (user_id, weight_kg, date) VALUES (?, ?, ?)');

    stmt.run([entry.user_id, entry.weight_kg, entry.date.toISOString()]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async getLatestWeight(userId: number): Promise<WeightEntry | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM weight_entries WHERE user_id = ? ORDER BY date DESC LIMIT 1', [
      userId,
    ]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.rowToWeightEntry(result[0].columns, row);
  }

  async createWeightGoal(goal: Omit<WeightGoal, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    // Deactivate existing goals
    this.db.run('UPDATE weight_goals SET is_active = 0 WHERE user_id = ?', [goal.user_id]);

    const stmt = this.db.prepare(`
      INSERT INTO weight_goals (user_id, target_weight_kg, target_date, daily_calorie_target, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    stmt.run([
      goal.user_id,
      goal.target_weight_kg,
      goal.target_date ? goal.target_date.toISOString() : null,
      goal.daily_calorie_target || null,
    ]);

    stmt.free();
    await this.saveDatabase();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async getActiveWeightGoal(userId: number): Promise<WeightGoal | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM weight_goals WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.rowToWeightGoal(result[0].columns, row);
  }

  // Statistics
  async getDailySummary(userId: number, date: Date): Promise<DailySummary> {
    if (!this.db) throw new Error('Database not initialized');

    const dateStr = date.toISOString().split('T')[0];

    // Get food entries
    const foodResult = this.db.exec(
      `
      SELECT
        SUM(fi.calories_per_100g * fe.quantity_g / 100) as calories,
        SUM(fi.protein_g * fe.quantity_g / 100) as protein,
        SUM(fi.carbs_g * fe.quantity_g / 100) as carbs,
        SUM(fi.fat_g * fe.quantity_g / 100) as fat
      FROM food_entries fe
      JOIN food_items fi ON fe.food_item_id = fi.id
      WHERE fe.user_id = ? AND DATE(fe.date) = ?
    `,
      [userId, dateStr]
    );

    // Get activity entries
    const activityResult = this.db.exec(
      `
      SELECT SUM(calories_burned) as total_burned
      FROM activity_entries
      WHERE user_id = ? AND DATE(date) = ?
    `,
      [userId, dateStr]
    );

    const calories_consumed = (foodResult[0]?.values[0]?.[0] as number) || 0;
    const protein_g = (foodResult[0]?.values[0]?.[1] as number) || 0;
    const carbs_g = (foodResult[0]?.values[0]?.[2] as number) || 0;
    const fat_g = (foodResult[0]?.values[0]?.[3] as number) || 0;
    const calories_burned = (activityResult[0]?.values[0]?.[0] as number) || 0;

    return {
      date,
      calories_consumed,
      calories_burned,
      net_calories: calories_consumed - calories_burned,
      protein_g,
      carbs_g,
      fat_g,
    };
  }

  // Helper methods for row conversion
  private rowToUser(columns: string[], row: any[]): User {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      username: obj.username,
      email: obj.email,
      created_at: new Date(obj.created_at),
      height_cm: obj.height_cm,
      birth_date: obj.birth_date ? new Date(obj.birth_date) : undefined,
      gender: obj.gender,
      activity_level: obj.activity_level,
    };
  }

  private rowToFoodItem(columns: string[], row: any[]): FoodItem {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      name: obj.name,
      brand: obj.brand,
      calories_per_100g: obj.calories_per_100g,
      protein_g: obj.protein_g,
      carbs_g: obj.carbs_g,
      fat_g: obj.fat_g,
      fiber_g: obj.fiber_g,
      sugar_g: obj.sugar_g,
      sodium_mg: obj.sodium_mg,
      user_id: obj.user_id,
      is_custom: Boolean(obj.is_custom),
      fdc_id: obj.fdc_id,
      barcode: obj.barcode,
      data_source: obj.data_source,
      last_synced: obj.last_synced ? new Date(obj.last_synced) : undefined,
    };
  }

  private rowToFoodEntry(columns: string[], row: any[]): FoodEntry {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      user_id: obj.user_id,
      food_item_id: obj.food_item_id,
      quantity_g: obj.quantity_g,
      meal_type: obj.meal_type,
      date: new Date(obj.date),
      created_at: new Date(obj.created_at),
      food_item: this.rowToFoodItem(columns.slice(7), row.slice(7)),
    };
  }

  private rowToActivityEntry(columns: string[], row: any[]): ActivityEntry {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      user_id: obj.user_id,
      activity_id: obj.activity_id,
      duration_minutes: obj.duration_minutes,
      calories_burned: obj.calories_burned,
      date: new Date(obj.date),
      created_at: new Date(obj.created_at),
      notes: obj.notes,
    };
  }

  private rowToWeightEntry(columns: string[], row: any[]): WeightEntry {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      user_id: obj.user_id,
      weight_kg: obj.weight_kg,
      date: new Date(obj.date),
      created_at: new Date(obj.created_at),
    };
  }

  private rowToWeightGoal(columns: string[], row: any[]): WeightGoal {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      user_id: obj.user_id,
      target_weight_kg: obj.target_weight_kg,
      target_date: obj.target_date ? new Date(obj.target_date) : undefined,
      daily_calorie_target: obj.daily_calorie_target,
      created_at: new Date(obj.created_at),
      is_active: Boolean(obj.is_active),
    };
  }

  async deleteFoodEntry(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM food_entries WHERE id = ?', [id]);
    await this.saveDatabase();
  }

  async deleteActivityEntry(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM activity_entries WHERE id = ?', [id]);
    await this.saveDatabase();
  }
}
