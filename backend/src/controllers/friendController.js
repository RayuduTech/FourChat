const db = require('../config/db');

exports.sendRequest = async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.user.id;

  if (senderId === receiverId) {
    return res.status(400).json({ error: 'You cannot invite yourself' });
  }

  try {
    // Check if a relationship already exists
    const [existing] = await db.query(
      'SELECT * FROM Friendships WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)',
      [senderId, receiverId, receiverId, senderId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'A request or friendship already exists' });
    }

    const user_id1 = Math.min(senderId, receiverId);
    const user_id2 = Math.max(senderId, receiverId);

    await db.query(
      'INSERT INTO Friendships (user_id1, user_id2, status, sender_id) VALUES (?, ?, ?, ?)',
      [user_id1, user_id2, 'pending', senderId]
    );

    res.status(201).json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.respondToRequest = async (req, res) => {
  const { requestId, action } = req.body; // action: 'accepted' or 'rejected'
  const userId = req.user.id;

  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const [requests] = await db.query('SELECT * FROM Friendships WHERE id = ?', [requestId]);
    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requests[0];
    // Only the receiver can accept/reject
    if (request.sender_id === userId) {
      return res.status(403).json({ error: 'You cannot respond to your own request' });
    }

    const isReceiver = (request.user_id1 === userId || request.user_id2 === userId);
    if (!isReceiver) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (action === 'rejected') {
      await db.query('DELETE FROM Friendships WHERE id = ?', [requestId]);
    } else {
      await db.query('UPDATE Friendships SET status = ? WHERE id = ?', [action, requestId]);
    }
    
    res.json({ message: `Request ${action}`, action });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFriends = async (req, res) => {
  const userId = req.user.id;
  try {
    // Return users who are either:
    // 1. Accepted friends in the Friendships table
    // 2. People the user has an active 1-on-1 chat with
    const [friends] = await db.query(`
      SELECT DISTINCT u.id, u.username, u.email, u.status, u.last_seen, u.profile_pic
      FROM Users u
      LEFT JOIN Friendships f ON (u.id = f.user_id1 OR u.id = f.user_id2)
      LEFT JOIN Chat_Participants cp1 ON u.id = cp1.user_id
      LEFT JOIN Chat_Participants cp2 ON cp1.chat_id = cp2.chat_id AND cp2.user_id = ?
      LEFT JOIN Chats c ON cp1.chat_id = c.id
      WHERE (
        (f.status = 'accepted' AND (f.user_id1 = ? OR f.user_id2 = ?))
        OR 
        (c.is_group = false AND cp2.user_id IS NOT NULL)
      )
      AND u.id != ?
    `, [userId, userId, userId, userId]);
    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPendingRequests = async (req, res) => {
  const userId = req.user.id;
  try {
    const [requests] = await db.query(`
      SELECT f.id, f.sender_id, u.username as sender_username, f.created_at
      FROM Friendships f
      JOIN Users u ON f.sender_id = u.id
      WHERE (f.user_id1 = ? OR f.user_id2 = ?) 
      AND f.status = 'pending'
      AND f.sender_id != ?
    `, [userId, userId, userId]);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
