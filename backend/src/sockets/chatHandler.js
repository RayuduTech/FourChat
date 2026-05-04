const db = require('../config/db');
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
      socket.broadcast.emit('new_post_notification', { sender: socket.user.username });
    });

    socket.on('post_like', (data) => {
      const { ownerId, likerName } = data;
      socket.to(`user_${ownerId}`).emit('post_like', { likerName });
    });

    socket.on('post_comment', (data) => {
      const { ownerId, commenterName } = data;
      socket.to(`user_${ownerId}`).emit('post_comment', { commenterName });
    });

    socket.on('join_room', (chatId) => {
      socket.join(chatId.toString());
      console.log(`User ${socket.user.username} joined room: ${chatId}`);
    });

    socket.on('send_message', async (data) => {
      const { chatId, content, media_url } = data;
      const senderId = socket.user.id;
      
      try {
        // Save to DB
        const [result] = await db.query(
          'INSERT INTO Messages (chat_id, sender_id, content, media_url) VALUES (?, ?, ?, ?)',
          [chatId, senderId, content, media_url]
        );

        const newMessage = {
          id: result.insertId,
          chat_id: chatId,
          sender_id: senderId,
          content,
          media_url,
          sender_username: socket.user.username,
          created_at: new Date()
        };

        // Broadcast to everyone in room including sender
        io.to(chatId.toString()).emit('receive_message', newMessage);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    socket.on('typing', (chatId) => {
      socket.to(chatId.toString()).emit('user_typing', { userId: socket.user.id, chatId });
    });

    socket.on('stop_typing', (chatId) => {
      socket.to(chatId.toString()).emit('user_stopped_typing', { userId: socket.user.id, chatId });
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.user.username);
      await db.query('UPDATE Users SET status = ?, last_seen = NOW() WHERE id = ?', ['offline', socket.user.id]);
      io.emit('user_status_change', { userId: socket.user.id, status: 'offline' });
    });
  });
};
