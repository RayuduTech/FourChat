const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const friendRoutes = require('./src/routes/friendRoutes');
const postRoutes = require('./src/routes/postRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const chatHandler = require('./src/sockets/chatHandler');
const { connectRedis } = require('./src/config/redis');
const { connectKafka } = require('./src/config/kafka');

const app = express();
connectRedis();
connectKafka();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allows any origin for development
    methods: ["GET", "POST"]
  }
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/social', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/uploads', express.static('uploads'));

// Basic test route
app.get('/', (req, res) => res.send('FourChat API Running'));

// Socket.io initialization
chatHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 