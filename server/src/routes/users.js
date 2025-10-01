import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import getDatabase from '../config/database.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const user = db.prepare(`
      SELECT id, username, email, daily_calorie_goal, height_cm, birth_date, gender, activity_level,
             nutritionix_app_id, nutritionix_app_key, created_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: { message: 'Failed to fetch user profile' } });
  }
});

// Update user profile
router.put('/me',
  authenticateToken,
  [
    body('daily_calorie_goal').optional().isInt({ min: 0, max: 10000 }),
    body('height_cm').optional().isFloat({ min: 0, max: 300 }),
    body('birth_date').optional().isDate(),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('activity_level').optional().isIn(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']),
    body('nutritionix_app_id').optional().isString(),
    body('nutritionix_app_key').optional().isString()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const db = getDatabase();
      const userId = req.user.id;
      const { daily_calorie_goal, height_cm, birth_date, gender, activity_level, nutritionix_app_id, nutritionix_app_key } = req.body;

      db.prepare(`
        UPDATE users
        SET daily_calorie_goal = COALESCE(?, daily_calorie_goal),
            height_cm = COALESCE(?, height_cm),
            birth_date = COALESCE(?, birth_date),
            gender = COALESCE(?, gender),
            activity_level = COALESCE(?, activity_level),
            nutritionix_app_id = COALESCE(?, nutritionix_app_id),
            nutritionix_app_key = COALESCE(?, nutritionix_app_key)
        WHERE id = ?
      `).run(daily_calorie_goal, height_cm, birth_date, gender, activity_level, nutritionix_app_id, nutritionix_app_key, userId);

      const user = db.prepare(`
        SELECT id, username, email, daily_calorie_goal, height_cm, birth_date, gender, activity_level,
               nutritionix_app_id, nutritionix_app_key, created_at
        FROM users
        WHERE id = ?
      `).get(userId);

      res.json({ user });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: { message: 'Failed to update user profile' } });
    }
  }
);

export default router;
