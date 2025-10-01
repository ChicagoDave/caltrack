import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import getDatabase from '../config/database.js';

const router = express.Router();

// Get all available activities
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const activities = db.prepare('SELECT * FROM activities ORDER BY name').all();

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: { message: 'Failed to fetch activities' } });
  }
});

// Get activity entries for a specific date
router.get('/entries/:date', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;
    const userId = req.user.id;

    const entries = db.prepare(`
      SELECT ae.*, a.name as activity_name, a.unit
      FROM activity_entries ae
      JOIN activities a ON ae.activity_id = a.id
      WHERE ae.user_id = ? AND ae.date = ?
      ORDER BY ae.time DESC, ae.created_at DESC
    `).all(userId, date);

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching activity entries:', error);
    res.status(500).json({ error: { message: 'Failed to fetch activity entries' } });
  }
});

// Add activity entry
router.post('/entries',
  authenticateToken,
  [
    body('activity_id').isInt({ min: 1 }),
    body('quantity').isFloat({ min: 0 }),
    body('calories_burned').isFloat({ min: 0 }),
    body('date').isDate()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { activity_id, quantity, calories_burned, date, time, notes } = req.body;

      // Verify activity exists
      const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
      if (!activity) {
        return res.status(404).json({ error: { message: 'Activity not found' } });
      }

      const result = db.prepare(`
        INSERT INTO activity_entries (user_id, activity_id, quantity, calories_burned, date, time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, activity_id, quantity, calories_burned, date, time || null, notes || null);

      const entry = db.prepare(`
        SELECT ae.*, a.name as activity_name, a.unit
        FROM activity_entries ae
        JOIN activities a ON ae.activity_id = a.id
        WHERE ae.id = ?
      `).get(result.lastInsertRowid);

      res.status(201).json({ entry });
    } catch (error) {
      console.error('Error adding activity entry:', error);
      res.status(500).json({ error: { message: 'Failed to add activity entry' } });
    }
  }
);

// Update activity entry
router.put('/entries/:id',
  authenticateToken,
  [
    body('quantity').optional().isFloat({ min: 0 }),
    body('calories_burned').optional().isFloat({ min: 0 })
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
      const entry = db.prepare('SELECT * FROM activity_entries WHERE id = ? AND user_id = ?').get(id, userId);
      if (!entry) {
        return res.status(404).json({ error: { message: 'Activity entry not found' } });
      }

      const { quantity, calories_burned, notes } = req.body;

      db.prepare(`
        UPDATE activity_entries
        SET quantity = COALESCE(?, quantity),
            calories_burned = COALESCE(?, calories_burned),
            notes = COALESCE(?, notes)
        WHERE id = ? AND user_id = ?
      `).run(quantity, calories_burned, notes, id, userId);

      const updatedEntry = db.prepare(`
        SELECT ae.*, a.name as activity_name, a.unit
        FROM activity_entries ae
        JOIN activities a ON ae.activity_id = a.id
        WHERE ae.id = ?
      `).get(id);

      res.json({ entry: updatedEntry });
    } catch (error) {
      console.error('Error updating activity entry:', error);
      res.status(500).json({ error: { message: 'Failed to update activity entry' } });
    }
  }
);

// Delete activity entry
router.delete('/entries/:id', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM activity_entries WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: { message: 'Activity entry not found' } });
    }

    res.json({ message: 'Activity entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity entry:', error);
    res.status(500).json({ error: { message: 'Failed to delete activity entry' } });
  }
});

export default router;
