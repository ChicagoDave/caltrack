import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'caltrack.db');

let db = null;

export function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    console.log(`✅ Connected to SQLite database at ${DB_PATH}`);
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('❌ Database connection closed');
  }
}

export default getDatabase;
