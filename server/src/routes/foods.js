import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import getDatabase from '../config/database.js';

const router = express.Router();

// Get all food entries for a specific date
router.get('/entries/:date', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;
    const userId = req.user.id;

    const entries = db.prepare(`
      SELECT * FROM food_entries
      WHERE user_id = ? AND date = ?
      ORDER BY time DESC, created_at DESC
    `).all(userId, date);

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching food entries:', error);
    res.status(500).json({ error: { message: 'Failed to fetch food entries' } });
  }
});

// Add food entry
router.post('/entries',
  authenticateToken,
  [
    body('food_name').trim().notEmpty(),
    body('quantity_g').isFloat({ min: 0 }),
    body('calories').isFloat({ min: 0 }),
    body('date').isDate(),
    body('meal_type').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack'])
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { food_item_id, food_name, quantity_g, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, date, time } = req.body;

      const result = db.prepare(`
        INSERT INTO food_entries (user_id, food_item_id, food_name, quantity_g, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, date, time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, food_item_id || null, food_name, quantity_g, calories, protein_g || 0, carbs_g || 0, fat_g || 0, fiber_g || 0, meal_type || null, date, time || null);

      const entry = db.prepare('SELECT * FROM food_entries WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ entry });
    } catch (error) {
      console.error('Error adding food entry:', error);
      res.status(500).json({ error: { message: 'Failed to add food entry' } });
    }
  }
);

// Update food entry
router.put('/entries/:id',
  authenticateToken,
  [
    body('quantity_g').optional().isFloat({ min: 0 }),
    body('calories').optional().isFloat({ min: 0 }),
    body('meal_type').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack'])
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { id } = req.params;

      // Check if entry belongs to user
      const entry = db.prepare('SELECT * FROM food_entries WHERE id = ? AND user_id = ?').get(id, userId);
      if (!entry) {
        return res.status(404).json({ error: { message: 'Food entry not found' } });
      }

      const { quantity_g, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type } = req.body;

      db.prepare(`
        UPDATE food_entries
        SET quantity_g = COALESCE(?, quantity_g),
            calories = COALESCE(?, calories),
            protein_g = COALESCE(?, protein_g),
            carbs_g = COALESCE(?, carbs_g),
            fat_g = COALESCE(?, fat_g),
            fiber_g = COALESCE(?, fiber_g),
            meal_type = COALESCE(?, meal_type)
        WHERE id = ? AND user_id = ?
      `).run(quantity_g, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, id, userId);

      const updatedEntry = db.prepare('SELECT * FROM food_entries WHERE id = ?').get(id);

      res.json({ entry: updatedEntry });
    } catch (error) {
      console.error('Error updating food entry:', error);
      res.status(500).json({ error: { message: 'Failed to update food entry' } });
    }
  }
);

// Delete food entry
router.delete('/entries/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM food_entries WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: { message: 'Food entry not found' } });
    }

    res.json({ message: 'Food entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting food entry:', error);
    res.status(500).json({ error: { message: 'Failed to delete food entry' } });
  }
});

// Search food items (local database)
router.get('/search', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ items: [] });
    }

    const items = db.prepare(`
      SELECT * FROM food_items
      WHERE name LIKE ?
      ORDER BY name
      LIMIT 50
    `).all(`%${q}%`);

    res.json({ items });
  } catch (error) {
    console.error('Error searching food items:', error);
    res.status(500).json({ error: { message: 'Failed to search food items' } });
  }
});

// Add custom food item
router.post('/items',
  authenticateToken,
  [
    body('name').trim().notEmpty(),
    body('calories_per_100g').isFloat({ min: 0 }),
    body('protein_g').optional().isFloat({ min: 0 }),
    body('carbs_g').optional().isFloat({ min: 0 }),
    body('fat_g').optional().isFloat({ min: 0 }),
    body('fiber_g').optional().isFloat({ min: 0 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { name, brand, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, serving_size_g, serving_size_unit, usda_fdc_id } = req.body;

      // Check if this USDA food already exists
      if (usda_fdc_id) {
        const existing = db.prepare('SELECT id FROM food_items WHERE usda_fdc_id = ?').get(usda_fdc_id);
        if (existing) {
          const item = db.prepare('SELECT * FROM food_items WHERE id = ?').get(existing.id);
          return res.status(200).json({ item });
        }
      }

      const result = db.prepare(`
        INSERT INTO food_items (name, brand, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, serving_size_g, serving_size_unit, usda_fdc_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, brand || null, calories_per_100g, protein_g || 0, carbs_g || 0, fat_g || 0, fiber_g || 0, serving_size_g || null, serving_size_unit || null, usda_fdc_id || null, userId);

      const item = db.prepare('SELECT * FROM food_items WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ item });
    } catch (error) {
      console.error('Error adding food item:', error);
      res.status(500).json({ error: { message: 'Failed to add food item' } });
    }
  }
);

export default router;
