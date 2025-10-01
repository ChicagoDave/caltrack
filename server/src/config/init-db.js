import getDatabase from './database.js';

function initializeDatabase() {
  const db = getDatabase();

  console.log('📝 Initializing database tables...\n');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      daily_calorie_goal INTEGER DEFAULT 2000,
      height_cm REAL,
      birth_date DATE,
      gender TEXT CHECK(gender IN ('male', 'female', 'other')),
      activity_level TEXT CHECK(activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Created users table');

  // Weight entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_entries(user_id, date);
  `);
  console.log('✅ Created weight_entries table');

  // Weight goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weight_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_weight_kg REAL NOT NULL,
      target_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('✅ Created weight_goals table');

  // Food items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT,
      calories_per_100g REAL NOT NULL,
      protein_g REAL DEFAULT 0,
      carbs_g REAL DEFAULT 0,
      fat_g REAL DEFAULT 0,
      fiber_g REAL DEFAULT 0,
      serving_size_g REAL,
      serving_size_unit TEXT,
      usda_fdc_id INTEGER,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_food_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_food_usda ON food_items(usda_fdc_id);
  `);
  console.log('✅ Created food_items table');

  // Food entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_item_id INTEGER,
      food_name TEXT NOT NULL,
      quantity_g REAL NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL DEFAULT 0,
      carbs_g REAL DEFAULT 0,
      fat_g REAL DEFAULT 0,
      fiber_g REAL DEFAULT 0,
      meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      date DATE NOT NULL,
      time TIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_food_entry_user_date ON food_entries(user_id, date);
  `);
  console.log('✅ Created food_entries table');

  // Activities table (predefined activity types)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      calories_per_unit REAL NOT NULL,
      unit TEXT NOT NULL,
      description TEXT
    );
  `);
  console.log('✅ Created activities table');

  // Insert default activities
  const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO activities (name, calories_per_unit, unit, description)
    VALUES (?, ?, ?, ?)
  `);

  const activities = [
    ['Walking', 0.04, 'steps', 'Calories burned per step'],
    ['Running', 100, 'mile', 'Calories burned per mile'],
    ['Swimming', 50, 'lap', 'Calories burned per lap (25m pool)'],
    ['Cycling', 8, 'minute', 'Calories burned per minute']
  ];

  activities.forEach(activity => insertActivity.run(...activity));
  console.log('✅ Inserted default activities');

  // Activity entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      calories_burned REAL NOT NULL,
      date DATE NOT NULL,
      time TIME,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_activity_entry_user_date ON activity_entries(user_id, date);
  `);
  console.log('✅ Created activity_entries table');

  console.log('\n✨ Database initialization complete!\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    initializeDatabase();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

export default initializeDatabase;
