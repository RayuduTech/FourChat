# FourChat - Social Media App

FourChat is a high-performance chat and social application built with Node.js, React, and MySQL/MariaDB. This project has been upgraded to a **Production-Grade Architecture** featuring real-time caching with Redis and event-driven messaging with Kafka.

## 🏗️ Architecture Overview

The system is designed for high scalability and decoupling:

1.  **Frontend (React + Vite)**: Modern UI with Socket.io for real-time updates.
2.  **API Gateway (Express)**: Handles REST requests and manages WebSockets.
3.  **Real-time Cache (Redis)**: Manages user presence (online/offline status) and scales WebSockets across multiple server instances.
4.  **Message Queue (Kafka)**: Decouples message sending from database writing. The API "Produces" messages to Kafka, ensuring instant delivery to the recipient.
5.  **Background Worker**: A dedicated process that "Consumes" messages from Kafka and persists them to MariaDB.
6.  **Persistent Storage (MariaDB)**: Optimized for long-term data storage.

---

## 🚀 Getting Started (UAT/Production)

### 1. Prerequisites
- **Docker & Docker Compose** (for Redis/Kafka)
- **Node.js v18+**
- **MariaDB Instance** (already configured at `10.100.21.158`)

### 2. Infrastructure Setup
Start the Redis and Kafka infrastructure using Docker:
```bash
docker-compose up -d
```
*   **Redis**: Port `6379`
*   **Kafka**: Port `9092`
*   **Kafka UI**: Port `8081` (Open in browser to see message flow)

### 3. Backend Configuration
Create/Update `backend/.env`:
```env
PORT=5000
DB_HOST=10.100.21.158
DB_USER=root
DB_PASS=abcdef
DB_NAME=fourchat_db
JWT_SECRET=f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8

# Infrastructure
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
```

### 4. Running the Services
You need to run **two** processes for the backend:
```bash
# Terminal 1: The API and WebSocket Server
cd backend
npm install
npm start

# Terminal 2: The Background Worker (Persistence Engine)
cd backend
node worker.js
```

### 5. Frontend Configuration
Update `frontend/.env` with your server's IP:
```env
VITE_API_URL=http://your-server-ip:5000/api
VITE_SOCKET_URL=http://your-server-ip:5000
```
Run the frontend:
```bash
cd frontend
npm install
npm run dev # for UAT
# OR
npm run build # for Production
```

---

## 🛠️ Management & Monitoring

-   **Monitoring Kafka**: Open `http://your-server-ip:8080` to access the Kafka UI. You can view the `chat-messages` topic and see messages being processed in real-time.
-   **Scaling**: To scale the backend, simply start more instances of the API server. The Redis adapter ensures all instances stay synced.
-   **Logs**: Check `backend/server.log` (if enabled) or the process console for real-time debugging.

## 🔒 Security
-   The **JWT Secret** is a 256-bit secure key. Keep it confidential.
-   Ensure the MariaDB instance is only accessible via the local network or through a VPN.

---

**Developed for the FourChat Project.**
