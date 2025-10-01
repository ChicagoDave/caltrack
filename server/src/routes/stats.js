import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import getDatabase from '../config/database.js';

const router = express.Router();

// Get daily summary for a specific date
router.get('/daily/:date', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.params;
    const userId = req.user.id;

    // Get total calories consumed
    const foodStats = db.prepare(`
      SELECT
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(protein_g), 0) as total_protein,
        COALESCE(SUM(carbs_g), 0) as total_carbs,
        COALESCE(SUM(fat_g), 0) as total_fat,
        COALESCE(SUM(fiber_g), 0) as total_fiber,
        COUNT(*) as food_count
      FROM food_entries
      WHERE user_id = ? AND date = ?
    `).get(userId, date);

    // Get total calories burned
    const activityStats = db.prepare(`
      SELECT
        COALESCE(SUM(calories_burned), 0) as total_calories_burned,
        COUNT(*) as activity_count
      FROM activity_entries
      WHERE user_id = ? AND date = ?
    `).get(userId, date);

    // Get user's daily goals
    const user = db.prepare(`
      SELECT daily_calorie_goal, daily_protein_goal, daily_carbs_goal,
             daily_fat_goal, daily_burn_goal
      FROM users WHERE id = ?
    `).get(userId);

    const summary = {
      date,
      calories_consumed: foodStats.total_calories,
      calories_burned: activityStats.total_calories_burned,
      net_calories: foodStats.total_calories - activityStats.total_calories_burned,
      calories_remaining: user.daily_calorie_goal - (foodStats.total_calories - activityStats.total_calories_burned),
      daily_goal: user.daily_calorie_goal,
      macros: {
        protein_g: foodStats.total_protein,
        carbs_g: foodStats.total_carbs,
        fat_g: foodStats.total_fat,
        fiber_g: foodStats.total_fiber
      },
      macro_goals: {
        protein_g: user.daily_protein_goal,
        carbs_g: user.daily_carbs_goal,
        fat_g: user.daily_fat_goal
      },
      burn_goal: user.daily_burn_goal,
      food_count: foodStats.food_count,
      activity_count: activityStats.activity_count
    };

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch daily stats' } });
  }
});

// Get weekly summary
router.get('/weekly', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: { message: 'start_date and end_date are required' } });
    }

    // Get daily summaries for the week
    const dailyStats = db.prepare(`
      SELECT
        date,
        COALESCE(SUM(calories), 0) as calories_consumed,
        COALESCE(SUM(protein_g), 0) as protein_g,
        COALESCE(SUM(carbs_g), 0) as carbs_g,
        COALESCE(SUM(fat_g), 0) as fat_g
      FROM food_entries
      WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date
    `).all(userId, start_date, end_date);

    const activityStats = db.prepare(`
      SELECT
        date,
        COALESCE(SUM(calories_burned), 0) as calories_burned
      FROM activity_entries
      WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date
    `).all(userId, start_date, end_date);

    // Get weight entries for the week
    const weightStats = db.prepare(`
      SELECT date, weight_kg
      FROM weight_entries
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date
    `).all(userId, start_date, end_date);

    // Merge stats by date
    const activityMap = Object.fromEntries(activityStats.map(s => [s.date, s.calories_burned]));
    const weightMap = Object.fromEntries(weightStats.map(s => [s.date, s.weight_kg]));

    const daily = dailyStats.map(day => ({
      date: day.date,
      calories_consumed: day.calories_consumed,
      calories_burned: activityMap[day.date] || 0,
      net_calories: day.calories_consumed - (activityMap[day.date] || 0),
      weight_kg: weightMap[day.date] || null,
      macros: {
        protein_g: day.protein_g,
        carbs_g: day.carbs_g,
        fat_g: day.fat_g
      }
    }));

    // Calculate totals
    const totals = {
      calories_consumed: dailyStats.reduce((sum, day) => sum + day.calories_consumed, 0),
      calories_burned: activityStats.reduce((sum, day) => sum + day.calories_burned, 0),
      protein_g: dailyStats.reduce((sum, day) => sum + day.protein_g, 0),
      carbs_g: dailyStats.reduce((sum, day) => sum + day.carbs_g, 0),
      fat_g: dailyStats.reduce((sum, day) => sum + day.fat_g, 0)
    };

    const averages = {
      calories_consumed: dailyStats.length ? totals.calories_consumed / dailyStats.length : 0,
      calories_burned: activityStats.length ? totals.calories_burned / activityStats.length : 0,
      protein_g: dailyStats.length ? totals.protein_g / dailyStats.length : 0,
      carbs_g: dailyStats.length ? totals.carbs_g / dailyStats.length : 0,
      fat_g: dailyStats.length ? totals.fat_g / dailyStats.length : 0
    };

    res.json({
      start_date,
      end_date,
      daily,
      totals,
      averages
    });
  } catch (error) {
    console.error('Error fetching weekly stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch weekly stats' } });
  }
});

// Get user progress (weight over time)
router.get('/progress', authenticateToken, (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { days } = req.query;

    const limit = days ? parseInt(days) : 30;

    const weightEntries = db.prepare(`
      SELECT date, weight_kg
      FROM weight_entries
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT ?
    `).all(userId, limit);

    const goal = db.prepare(`
      SELECT target_weight_kg, target_date
      FROM weight_goals
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);

    let progress = null;
    if (weightEntries.length > 0 && goal) {
      const currentWeight = weightEntries[0].weight_kg;
      const startWeight = weightEntries[weightEntries.length - 1].weight_kg;
      const weightChange = currentWeight - startWeight;
      const goalRemaining = currentWeight - goal.target_weight_kg;

      progress = {
        current_weight: currentWeight,
        start_weight: startWeight,
        target_weight: goal.target_weight_kg,
        weight_change: weightChange,
        goal_remaining: goalRemaining,
        target_date: goal.target_date
      };
    }

    res.json({
      weight_entries: weightEntries.reverse(),
      progress
    });
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    res.status(500).json({ error: { message: 'Failed to fetch progress stats' } });
  }
});

export default router;
