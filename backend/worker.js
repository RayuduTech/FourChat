const db = require('./src/config/db');
const { kafka } = require('./src/config/kafka');
require('dotenv').config();

const consumer = kafka.consumer({ groupId: 'message-processors' });

async function runWorker() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'chat-messages', fromBeginning: true });

  console.log('Worker listening for Kafka messages...');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      const { chatId, senderId, content, media_url, eventType } = data;

      try {
        if (eventType === 'SEND_MESSAGE') {
          await db.query(
            'INSERT INTO Messages (chat_id, sender_id, content, media_url) VALUES (?, ?, ?, ?)',
            [chatId, senderId, content, media_url]
          );
          console.log(`[Worker] Saved message for chat ${chatId}`);
        }
      } catch (err) {
        console.error('[Worker] Error processing message:', err);
      }
    },
  });
}

runWorker().catch(console.error);
