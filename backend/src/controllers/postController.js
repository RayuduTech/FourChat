const db = require('../config/db');
const { createNotification } = require('./notificationController');

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '../../error.log');

exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    
    // Check if an image was uploaded
    let finalImageUrl = req.body.image_url || null;
    if (req.file) {
      finalImageUrl = `/uploads/${req.file.filename}`;
    }
    
    const [result] = await db.execute(
      'INSERT INTO Posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, NOW())',
      [userId, content || '', finalImageUrl]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Post created successfully',
      image_url: finalImageUrl
    });

    // Create notifications for friends/chat partners in DB
    const [friends] = await db.query(`
      SELECT DISTINCT u.id
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
    `, [userId, userId, userId, userId, userId]);

    for (const friend of friends) {
      await createNotification(friend.id, 'new_post', `${req.user.username} shared a new post`, result.insertId);
    }
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
        -- People who are accepted friends
        SELECT user_id1 FROM Friendships WHERE user_id2 = ? AND status = 'accepted'
        UNION
        SELECT user_id2 FROM Friendships WHERE user_id1 = ? AND status = 'accepted'
        UNION
        -- People you have a 1-on-1 chat with
        SELECT cp2.user_id 
        FROM Chat_Participants cp1
        JOIN Chat_Participants cp2 ON cp1.chat_id = cp2.chat_id
        JOIN Chats c ON cp1.chat_id = c.id
        WHERE cp1.user_id = ? AND cp2.user_id != ? AND c.is_group = false
      )
      ORDER BY p.created_at DESC
    `, [userId, userId, userId, userId, userId, userId]);
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
        await createNotification(post[0].user_id, 'post_like', `${req.user.username} liked your post`, postId);
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
  const { content, parent_comment_id } = req.body;
  const userId = req.user.id;
  try {
    const [result] = await db.query(
      'INSERT INTO Comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)', 
      [postId, userId, content, parent_comment_id || null]
    );
    
    // Get post owner for notification
    const [post] = await db.query('SELECT user_id FROM Posts WHERE id = ?', [postId]);
    
    let notificationData = { 
      id: result.insertId, 
      message: 'Comment added' 
    };

    if (post.length > 0 && post[0].user_id !== userId) {
      notificationData.ownerId = post[0].user_id;
      notificationData.commenterName = req.user.username;
      await createNotification(post[0].user_id, 'post_comment', `${req.user.username} commented on your post`, postId);
    }

    // If it's a reply, also notify the parent comment owner
    if (parent_comment_id) {
      const [parentComment] = await db.query('SELECT user_id FROM Comments WHERE id = ?', [parent_comment_id]);
      if (parentComment.length > 0 && parentComment[0].user_id !== userId && parentComment[0].user_id !== post[0].user_id) {
        notificationData.replyToId = parentComment[0].user_id;
        await createNotification(parentComment[0].user_id, 'comment_reply', `${req.user.username} replied to your comment`, postId);
      }
    }
    
    res.status(201).json(notificationData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getComments = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user ? req.user.id : 0;
  try {
    const [comments] = await db.query(`
      SELECT c.*, u.username, u.profile_pic,
             (SELECT COUNT(*) FROM Comment_Likes WHERE comment_id = c.id) as like_count,
             EXISTS(SELECT 1 FROM Comment_Likes WHERE comment_id = c.id AND user_id = ?) as is_liked
      FROM Comments c 
      JOIN Users u ON c.user_id = u.id 
      WHERE c.post_id = ? 
      ORDER BY c.created_at ASC
    `, [userId, postId]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleCommentLike = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  try {
    const [existing] = await db.query('SELECT * FROM Comment_Likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
    if (existing.length > 0) {
      await db.query('DELETE FROM Comment_Likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
      await db.query('UPDATE Comments SET like_count = like_count - 1 WHERE id = ?', [commentId]);
      res.json({ liked: false });
    } else {
      await db.query('INSERT INTO Comment_Likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId]);
      await db.query('UPDATE Comments SET like_count = like_count + 1 WHERE id = ?', [commentId]);
      
      const [comment] = await db.query('SELECT user_id, post_id FROM Comments WHERE id = ?', [commentId]);
      if (comment.length > 0 && comment[0].user_id !== userId) {
        await createNotification(comment[0].user_id, 'comment_like', `${req.user.username} liked your comment`, comment[0].post_id);
        return res.json({ liked: true, ownerId: comment[0].user_id, likerName: req.user.username });
      }
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
