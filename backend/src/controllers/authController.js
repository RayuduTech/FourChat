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

    res.status(201).json({ token, user: { id: result.insertId, username, email, profile_pic: null, bio: null, status: 'offline' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    const user = users[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(403).json({ error: `Account locked. Try again in ${remainingMinutes} minutes.` });
    }

    // If lock expired, we should logically treat failed_attempts as 0
    let currentFailedAttempts = user.failed_attempts || 0;
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      currentFailedAttempts = 0;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      currentFailedAttempts += 1;

      if (currentFailedAttempts >= 5) {
        // Lock account for 10 mins
        await db.query('UPDATE Users SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?', [currentFailedAttempts, user.id]);
        return res.status(403).json({ error: 'Account locked due to too many failed attempts. Try again in 10 minutes.' });
      } else {
        await db.query('UPDATE Users SET failed_attempts = ?, locked_until = NULL WHERE id = ?', [currentFailedAttempts, user.id]);
        return res.status(401).json({ error: `Invalid credentials. ${5 - currentFailedAttempts} attempts left.` });
      }
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Reset attempts and update status
    await db.query('UPDATE Users SET failed_attempts = 0, locked_until = NULL, status = ? WHERE id = ?', ['online', user.id]);

    res.json({ token, user: { id: user.id, username: user.username, email: user.email, profile_pic: user.profile_pic, bio: user.bio, status: 'online' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  const { q } = req.query;
  try {
    if (!q) return res.json([]);
    const [users] = await db.query(
      `SELECT u.id, u.username, u.status, u.profile_pic, f.status as friendship_status, f.sender_id
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
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId || currentUserId;

    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.bio, u.profile_pic, u.status, u.last_seen, u.created_at,
              f.status as friendship_status, f.sender_id
       FROM Users u
       LEFT JOIN Friendships f ON (
         (f.user_id1 = ? AND f.user_id2 = u.id) OR
         (f.user_id2 = ? AND f.user_id1 = u.id)
       )
       WHERE u.id = ?`,
      [currentUserId, currentUserId, targetUserId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { username, bio } = req.body;
  console.log("Update Profile Request Body:", req.body);
  const userId = req.user.id;
  try {
    let finalProfilePic = req.body.profile_pic;
    if (req.file) {
      finalProfilePic = `/uploads/${req.file.filename}`;
    }

    // If username is changing, check for uniqueness
    if (username && username !== req.user.username) {
      const [existing] = await db.query('SELECT id FROM Users WHERE username = ? AND id != ?', [username, userId]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    await db.query(
      'UPDATE Users SET username = COALESCE(?, username), bio = COALESCE(?, bio), profile_pic = COALESCE(?, profile_pic) WHERE id = ?',
      [username, bio, finalProfilePic, userId]
    );

    // Fetch the full updated user to return to the client
    const [updatedUsers] = await db.query(
      'SELECT id, username, email, bio, profile_pic, status, created_at FROM Users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
