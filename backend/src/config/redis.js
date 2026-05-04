const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('Redis Client Error', err));

async function connectRedis() {
  if (!client.isOpen) {
    try {
      await client.connect();
      console.log('Connected to Redis');
    } catch (err) {
      console.warn('Could not connect to Redis, falling back to in-memory (Mock mode)');
    }
  }
}

module.exports = { client, connectRedis };
