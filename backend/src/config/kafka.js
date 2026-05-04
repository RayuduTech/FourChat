const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'fourchat-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();

async function connectKafka() {
  try {
    await producer.connect();
    console.log('Connected to Kafka Producer');
  } catch (err) {
    console.warn('Could not connect to Kafka, falling back to direct DB writes (Mock mode)');
  }
}

module.exports = { kafka, producer, connectKafka };
