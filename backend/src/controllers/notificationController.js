const db = require('../config/db');

exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.query(
      'SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await db.query(
      'UPDATE Notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllRead = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(
      'UPDATE Notifications SET is_read = TRUE WHERE user_id = ?',
      [userId]
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearAll = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query('DELETE FROM Notifications WHERE user_id = ?', [userId]);
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createNotification = async (userId, type, text, postId = null) => {
  try {
    await db.execute(
      'INSERT INTO Notifications (user_id, type, text, post_id) VALUES (?, ?, ?, ?)',
      [userId, type, text, postId]
    );
  } catch (error) {
    console.error('Failed to create notification in DB:', error);
  }
};
