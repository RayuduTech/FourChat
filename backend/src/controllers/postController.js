const db = require('../config/db');

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '../../error.log');

exports.createPost = async (req, res) => {
  try {
    const { content, image_url } = req.body;
    const userId = req.user.id;
    
    const [result] = await db.execute(
      'INSERT INTO Posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, NOW())',
      [userId, content || '', image_url || null]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Post created successfully' 
    });
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const [posts] = await db.query(`
      SELECT p.*, u.username, u.profile_pic,
             (SELECT COUNT(*) FROM Likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
             EXISTS(SELECT 1 FROM Likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM Posts p 
      JOIN Users u ON p.user_id = u.id 
      WHERE p.user_id = ? OR p.user_id IN (
        SELECT user_id1 FROM friendships WHERE user_id2 = ? AND status = 'accepted'
        UNION
        SELECT user_id2 FROM friendships WHERE user_id1 = ? AND status = 'accepted'
      )
      ORDER BY p.created_at DESC
    `, [userId, userId, userId, userId]);
    res.json(posts);
  } catch (error) {
    console.error('getPosts error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.toggleLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;
  try {
    const [existing] = await db.query('SELECT * FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
    if (existing.length > 0) {
      await db.query('DELETE FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      res.json({ liked: false });
    } else {
      await db.query('INSERT INTO Likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      
      // Get post owner for notification
      const [post] = await db.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
      if (post.length > 0 && post[0].user_id !== userId) {
        // We'll emit this from the controller if we can access io, 
        // but it's cleaner to let the frontend handle the socket emit after success 
        // OR use a global event bus. For now, I'll return the ownerId so frontend can emit.
        return res.json({ liked: true, ownerId: post[0].user_id, likerName: req.user.username });
      }
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addComment = async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  try {
    const [result] = await db.query('INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content]);
    
    // Get post owner for notification
    const [post] = await db.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    if (post.length > 0 && post[0].user_id !== userId) {
      return res.status(201).json({ 
        id: result.insertId, 
        message: 'Comment added', 
        ownerId: post[0].user_id,
        commenterName: req.user.username
      });
    }
    
    res.status(201).json({ id: result.insertId, message: 'Comment added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getComments = async (req, res) => {
  const { postId } = req.params;
  try {
    const [comments] = await db.query(`
      SELECT c.*, u.username 
      FROM Comments c 
      JOIN Users u ON c.user_id = u.id 
      WHERE c.post_id = ? 
      ORDER BY c.created_at ASC
    `, [postId]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
