# Real-Time Chat Application Implementation Plan

This document outlines the architecture, design, and implementation steps for building a modern real-time chat application similar to Facebook Messenger or Snapchat.

## 1. Backend Technology Selection

**Recommendation:** **Node.js + Express with Socket.IO**

**Justification:**
1. **Event-Driven & Non-Blocking I/O:** Node.js is inherently designed for handling thousands of concurrent, I/O-bound connections (like WebSockets) efficiently on a single thread.
2. **Socket.IO Ecosystem:** Socket.IO provides built-in support for "rooms" (perfect for group chats), automatic reconnections, broadcasting, and fallbacks to long-polling if WebSockets aren't available.
3. **Full-Stack JavaScript:** Using Node.js allows you to share data models, validation logic, and utility functions between your React frontend and the backend.
4. **Rapid Development:** Compared to Spring Boot, setting up a real-time server with Express and Socket.IO requires significantly less boilerplate, allowing for faster iterations.

*(While Spring Boot is excellent for CPU-intensive, enterprise-scale transactional systems, Node.js excels at lightweight, highly concurrent, real-time messaging.)*

---

## 2. Database Schema Design (MySQL)

We will use a normalized schema to support both 1-on-1 and group chats.

```sql
-- Users Table
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('online', 'offline') DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chats Table (Represents a conversation instance)
CREATE TABLE Chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    is_group BOOLEAN DEFAULT FALSE,
    group_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat_Participants Table (Many-to-Many relationship between Users and Chats)
CREATE TABLE Chat_Participants (
    chat_id INT,
    user_id INT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES Chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Messages Table
CREATE TABLE Messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT,
    media_url VARCHAR(255) NULL, -- For basic file/image sharing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES Chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE
);
```

---

## 3. API & WebSocket Event Design

### RESTful API (Express)
* **Auth Endpoints:**
  * `POST /api/auth/register` - Create a new user (returns JWT).
  * `POST /api/auth/login` - Authenticate user (returns JWT).
* **User Endpoints:**
  * `GET /api/users/search?q={query}` - Search users to start a chat.
* **Chat Endpoints:**
  * `GET /api/chats` - Get all active chats for the logged-in user.
  * `POST /api/chats` - Create a new 1-on-1 or group chat.
  * `GET /api/chats/:chatId/messages` - Fetch message history with pagination.

### WebSocket Events (Socket.IO)
* **Client -> Server:**
  * `join_room` (payload: `chatId`) - Join a specific chat room.
  * `send_message` (payload: `chatId, content, mediaUrl`) - Send a new message.
  * `typing` (payload: `chatId`) - User started typing.
  * `stop_typing` (payload: `chatId`) - User stopped typing.
* **Server -> Client:**
  * `receive_message` (payload: `messageObject`) - Broadcast new message to room.
  * `user_status_change` (payload: `userId, status`) - Notify when a contact goes online/offline.
  * `user_typing` / `user_stopped_typing` (payload: `userId, chatId`) - Update typing indicators.

---

## 4. Project Structure

```text
fourchat/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── server.js               # Entry point, Express & Socket.io setup
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js           # MySQL connection pool
│   │   ├── controllers/        # Route handlers
│   │   ├── middlewares/        # JWT auth, Error handling
│   │   ├── routes/             # API routes definitions
│   │   └── sockets/
│   │       └── chatHandler.js  # Socket.io event listeners
├── frontend/
│   ├── .env
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/         # Reusable UI (ChatBubble, TextInput, Avatar)
│   │   ├── pages/              # Login, Register, ChatDashboard
│   │   ├── hooks/              # Custom hooks (useSocket, useAuth)
│   │   ├── services/           # Axios API calls
│   │   └── context/            # Global state (AuthContext)
```

---

## 5. Starter Boilerplate Code

### Backend (`backend/server.js`)
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Basic route
app.get('/', (req, res) => res.send('FourChat API Running'));

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins a specific chat room
  socket.on('join_room', (chatId) => {
    socket.join(chatId);
    console.log(`User joined room: ${chatId}`);
  });

  // Handle incoming messages
  socket.on('send_message', (data) => {
    // data = { chatId, senderId, content }
    // TODO: Save message to MySQL here
    
    // Broadcast to everyone in the room
    io.to(data.chatId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // TODO: Update user status to 'offline' in MySQL
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### Frontend (`frontend/src/hooks/useSocket.js`)
```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export const useSocket = (token) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      auth: { token }, // Pass JWT for socket authentication
    });
    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  return socket;
};
```

### Frontend (`frontend/src/pages/ChatDashboard.jsx`)
```jsx
import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

const ChatDashboard = ({ user, currentChatId }) => {
  const socket = useSocket(user.token);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    if (socket && currentChatId) {
      socket.emit('join_room', currentChatId);

      socket.on('receive_message', (message) => {
        setMessages((prev) => [...prev, message]);
      });
    }
    
    return () => {
      if (socket) socket.off('receive_message');
    };
  }, [socket, currentChatId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && socket) {
      const msgData = {
        chatId: currentChatId,
        senderId: user.id,
        content: inputMessage,
      };
      socket.emit('send_message', msgData);
      setInputMessage('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map((msg, index) => (
          <div key={index} className={msg.senderId === user.id ? 'sent' : 'received'}>
            {msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage}>
        <input 
          type="text" 
          value={inputMessage} 
          onChange={(e) => setInputMessage(e.target.value)} 
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatDashboard;
```

---

## 6. Local Setup Instructions

1. **Initialize Project:**
   ```bash
   mkdir fourchat
   cd fourchat
   ```

2. **Backend Setup:**
   ```bash
   mkdir backend
   cd backend
   npm init -y
   npm install express socket.io mysql2 dotenv cors jsonwebtoken bcryptjs
   npm install --save-dev nodemon
   ```
   *Create `.env` inside `backend/`:*
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=yourpassword
   DB_NAME=fourchat_db
   JWT_SECRET=supersecretkey
   ```
   *Run Backend:* `npx nodemon server.js`

3. **Frontend Setup:**
   ```bash
   # Open a new terminal
   cd fourchat
   npx create-vite@latest frontend --template react
   cd frontend
   npm install socket.io-client axios react-router-dom
   ```
   *Create `.env` inside `frontend/`:*
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```
   *Run Frontend:* `npm run dev`

---

## 7. Scaling & Deployment (Bonus)

### Scaling Strategies
* **Redis Pub/Sub adapter for Socket.IO:** If you scale to multiple backend Node.js instances (e.g., behind a load balancer), a Socket.IO connection on Server A won't know about a connection on Server B. Redis acts as a message broker to broadcast events across all servers.
* **Message Queues (RabbitMQ/Kafka):** For heavy message loads, you can dump incoming messages into a queue for background processing/saving to MySQL, keeping the WebSocket thread extremely fast.
* **Database Indexing:** Ensure indexes on `Messages(chat_id)` and `Chat_Participants(user_id)` to keep query times low as the table grows.

### Deployment Options
* **Docker:** Containerize both the Node.js backend and the built React frontend (using Nginx). Use `docker-compose` to run the app alongside a MySQL and Redis container.
* **Cloud (AWS/Render/Vercel):**
  * Frontend: Deploy to Vercel or Netlify (free and fast).
  * Backend: Deploy to Render, Railway, or AWS ECS. These platforms easily support WebSocket connections.
  * Database: Use AWS RDS (MySQL) or PlanetScale.

---

## Open Questions & Review
Are you ready to proceed with scaffolding this out in the `D:\xerago\FourChat` workspace? I can run the commands and create these folders and boilerplate code automatically for you.
