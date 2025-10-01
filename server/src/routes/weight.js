import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import getDatabase from '../config/database.js';

const router = express.Router();

// Get weight entries
router.get('/entries', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { start_date, end_date, limit } = req.query;

    let query = 'SELECT * FROM weight_entries WHERE user_id = ?';
    const params = [userId];

    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY date DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const entries = db.prepare(query).all(...params);

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching weight entries:', error);
    res.status(500).json({ error: { message: 'Failed to fetch weight entries' } });
  }
});

// Get latest weight entry
router.get('/entries/latest', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const entry = db.prepare(`
      SELECT * FROM weight_entries
      WHERE user_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 1
    `).get(userId);

    res.json({ entry: entry || null });
  } catch (error) {
    console.error('Error fetching latest weight entry:', error);
    res.status(500).json({ error: { message: 'Failed to fetch latest weight entry' } });
  }
});

// Add weight entry
router.post('/entries',
  authenticateToken,
  [
    body('weight_kg').isFloat({ min: 0, max: 500 }),
    body('date').isDate(),
    body('notes').optional().trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { weight_kg, date, notes } = req.body;

      // Check if entry already exists for this date
      const existing = db.prepare('SELECT id FROM weight_entries WHERE user_id = ? AND date = ?').get(userId, date);

      if (existing) {
        // Update existing entry
        db.prepare(`
          UPDATE weight_entries
          SET weight_kg = ?, notes = ?
          WHERE id = ?
        `).run(weight_kg, notes || null, existing.id);

        const entry = db.prepare('SELECT * FROM weight_entries WHERE id = ?').get(existing.id);
        return res.json({ entry });
      }

      // Insert new entry
      const result = db.prepare(`
        INSERT INTO weight_entries (user_id, weight_kg, date, notes)
        VALUES (?, ?, ?, ?)
      `).run(userId, weight_kg, date, notes || null);

      const entry = db.prepare('SELECT * FROM weight_entries WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ entry });
    } catch (error) {
      console.error('Error adding weight entry:', error);
      res.status(500).json({ error: { message: 'Failed to add weight entry' } });
    }
  }
);

// Delete weight entry
router.delete('/entries/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM weight_entries WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: { message: 'Weight entry not found' } });
    }

    res.json({ message: 'Weight entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting weight entry:', error);
    res.status(500).json({ error: { message: 'Failed to delete weight entry' } });
  }
});

// Get weight goal
router.get('/goal', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const goal = db.prepare(`
      SELECT * FROM weight_goals
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    res.json({ goal: goal || null });
  } catch (error) {
    console.error('Error fetching weight goal:', error);
    res.status(500).json({ error: { message: 'Failed to fetch weight goal' } });
  }
});

// Set weight goal
router.post('/goal',
  authenticateToken,
  [
    body('target_weight_kg').isFloat({ min: 0, max: 500 }),
    body('target_date').optional().isDate()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { target_weight_kg, target_date } = req.body;

      const result = db.prepare(`
        INSERT INTO weight_goals (user_id, target_weight_kg, target_date)
        VALUES (?, ?, ?)
      `).run(userId, target_weight_kg, target_date || null);

      const goal = db.prepare('SELECT * FROM weight_goals WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ goal });
    } catch (error) {
      console.error('Error setting weight goal:', error);
      res.status(500).json({ error: { message: 'Failed to set weight goal' } });
    }
  }
);

export default router;
