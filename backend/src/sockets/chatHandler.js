const db = require('../config/db');
const { producer } = require('../config/kafka');
const { client: redis } = require('../config/redis');
const jwt = require('jsonwebtoken');

module.exports = function(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.user.username, socket.id);
    socket.join(`user_${socket.user.id}`);

    // Update user status to online
    db.query('UPDATE Users SET status = ? WHERE id = ?', ['online', socket.user.id]);
    io.emit('user_status_change', { userId: socket.user.id, status: 'online' });

    socket.on('send_friend_request', (data) => {
      const { receiverId, sender } = data;
      socket.to(`user_${receiverId}`).emit('new_friend_request', { sender });
    });

    socket.on('accept_friend_request', (data) => {
      const { senderId, receiver } = data;
      socket.to(`user_${senderId}`).emit('friend_request_accepted', { receiver });
    });

    socket.on('reject_friend_request', (data) => {
      const { senderId, receiver } = data;
      socket.to(`user_${senderId}`).emit('friend_request_rejected', { receiver });
    });

    socket.on('new_post', (data) => {
      // Broadcast to everyone for a global feed notification
      const { postId, sender } = data;
      socket.broadcast.emit('new_post_notification', { sender: sender || socket.user.username, postId });
    });

    socket.on('post_like', (data) => {
      const { postId, ownerId, likerName } = data;
      socket.to(`user_${ownerId}`).emit('post_like', { likerName, postId });
      io.emit('feed_update', { type: 'like', postId });
    });

    socket.on('post_comment', (data) => {
      const { postId, ownerId, commenterName } = data;
      socket.to(`user_${ownerId}`).emit('post_comment', { commenterName, postId });
      io.emit('feed_update', { type: 'comment', postId });
    });

    socket.on('comment_reply', (data) => {
      const { postId, ownerId, commenterName } = data;
      socket.to(`user_${ownerId}`).emit('comment_reply', { commenterName, postId });
      io.emit('feed_update', { type: 'comment', postId });
    });

    socket.on('comment_like', (data) => {
      const { ownerId, likerName } = data;
      socket.to(`user_${ownerId}`).emit('comment_like', { likerName });
      io.emit('feed_update', { type: 'comment_like' });
    });

    socket.on('new_group', (data) => {
      const { chatId, memberIds } = data;
      if (Array.isArray(memberIds)) {
        memberIds.forEach(memberId => {
          if (memberId !== socket.user.id) {
            io.to(`user_${memberId}`).emit('added_to_group', { chatId });
          }
        });
      }
    });

    socket.on('group_update', (data) => {
      const { chatId, groupName, groupPic, anyoneCanPost } = data;
      socket.to(chatId.toString()).emit('group_updated_realtime', { chatId, groupName, groupPic, anyoneCanPost });
    });

    socket.on('group_delete', (data) => {
      const { chatId } = data;
      socket.to(chatId.toString()).emit('group_deleted_realtime', { chatId });
    });

    socket.on('join_room', (chatId) => {
      socket.join(chatId.toString());
      console.log(`User ${socket.user.username} joined room: ${chatId}`);
    });

    socket.on('send_message', async (data) => {
      const { chatId, content, media_url, replyToMessageId } = data;
      const senderId = socket.user.id;
      
      // If replying, fetch the original message details
      let replyData = null;
      if (replyToMessageId) {
        try {
          const [rows] = await db.query(
            `SELECT m.id, m.content, m.media_url, u.username as sender_username 
             FROM Messages m JOIN Users u ON m.sender_id = u.id WHERE m.id = ?`,
            [replyToMessageId]
          );
          if (rows.length > 0) {
            replyData = {
              reply_original_id: rows[0].id,
              reply_original_content: rows[0].content,
              reply_original_media_url: rows[0].media_url,
              reply_original_sender: rows[0].sender_username
            };
          }
        } catch (err) {
          console.error('Error fetching reply target:', err);
        }
      }

      const newMessage = {
        chat_id: chatId,
        sender_id: senderId,
        content,
        media_url,
        reply_to_message_id: replyToMessageId || null,
        ...replyData,
        sender_username: socket.user.username,
        created_at: new Date(),
        eventType: 'SEND_MESSAGE'
      };

      // 1. Emit to clients immediately for real-time feel
      io.to(chatId.toString()).emit('receive_message', newMessage);

      // 2. Push to Kafka for background persistence
      try {
        await producer.send({
          topic: 'chat-messages',
          messages: [{ value: JSON.stringify(newMessage) }]
        });
      } catch (err) {
        console.error('Kafka Send Error (Falling back to direct DB):', err);
        await db.query(
          'INSERT INTO Messages (chat_id, sender_id, content, media_url, reply_to_message_id) VALUES (?, ?, ?, ?, ?)',
          [chatId, senderId, content, media_url, replyToMessageId || null]
        );
      }
    });

    socket.on('toggle_reaction', async (data) => {
      const { messageId, chatId, emoji } = data;
      const userId = socket.user.id;
      const username = socket.user.username;

      try {
        // Toggle in DB
        const [existing] = await db.query(
          'SELECT * FROM Message_Reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
          [messageId, userId, emoji]
        );

        let action;
        if (existing.length > 0) {
          await db.query(
            'DELETE FROM Message_Reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
            [messageId, userId, emoji]
          );
          action = 'remove';
        } else {
          await db.query(
            'INSERT INTO Message_Reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
            [messageId, userId, emoji]
          );
          action = 'add';
        }

        // Broadcast reaction update to the chat room
        io.to(chatId.toString()).emit('message_reaction_updated', {
          messageId,
          userId,
          username,
          emoji,
          action
        });
      } catch (err) {
        console.error('Error toggling message reaction:', err);
      }
    });

    socket.on('typing', (chatId) => {
      socket.to(chatId.toString()).emit('user_typing', { userId: socket.user.id, chatId: parseInt(chatId) });
    });

    socket.on('stop_typing', (chatId) => {
      socket.to(chatId.toString()).emit('user_stopped_typing', { userId: socket.user.id, chatId: parseInt(chatId) });
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.user.username);
      await db.query('UPDATE Users SET status = ?, last_seen = NOW() WHERE id = ?', ['offline', socket.user.id]);
      io.emit('user_status_change', { userId: socket.user.id, status: 'offline' });
    });
  });
};
