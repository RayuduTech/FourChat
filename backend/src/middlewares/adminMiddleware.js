const db = require('../config/db');

module.exports = async function (req, res, next) {
  try {
    const userId = req.user.id;
    const [users] = await db.query('SELECT is_admin FROM Users WHERE id = ?', [userId]);

    if (users.length === 0 || !users[0].is_admin) {
      return res.status(403).json({ error: 'Access denied: Administrators only.' });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error verifying admin status' });
  }
};
