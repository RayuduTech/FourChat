const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM Users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, password_hash]
    );

    const token = jwt.sign({ id: result.insertId, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ token, user: { id: result.insertId, username, email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Update status to online
    await db.query('UPDATE Users SET status = ? WHERE id = ?', ['online', user.id]);

    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  const { q } = req.query;
  try {
    if (!q) return res.json([]);
    const [users] = await db.query(
      `SELECT u.id, u.username, u.status, f.status as friendship_status, f.sender_id
       FROM Users u
       LEFT JOIN Friendships f ON (
         (u.id = f.user_id1 AND f.user_id2 = ?) OR 
         (u.id = f.user_id2 AND f.user_id1 = ?)
       )
       WHERE u.username LIKE ? AND u.id != ? 
       LIMIT 10`,
      [req.user.id, req.user.id, `%${q}%`, req.user.id]
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, bio, profile_pic, status, last_seen FROM Users WHERE id = ?',
      [req.params.userId || req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { bio, profile_pic } = req.body;
  try {
    await db.query(
      'UPDATE Users SET bio = ?, profile_pic = ? WHERE id = ?',
      [bio, profile_pic, req.user.id]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
