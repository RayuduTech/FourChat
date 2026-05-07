const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, email, status, last_seen, created_at, is_admin, failed_attempts, locked_until FROM Users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE Users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.unlockUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE Users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
    res.json({ message: 'User account unlocked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
