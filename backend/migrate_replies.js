require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'Abc@123',
      database: process.env.DB_NAME || 'fourchat_db'
    });

    console.log('Connected to MySQL.');

    // Add reply_to_message_id column
    await connection.query(`
      ALTER TABLE Messages 
      ADD COLUMN reply_to_message_id INT DEFAULT NULL;
    `).catch(err => {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      console.log('reply_to_message_id column already exists.');
    });

    // Add foreign key constraint
    await connection.query(`
      ALTER TABLE Messages 
      ADD CONSTRAINT fk_message_reply 
      FOREIGN KEY (reply_to_message_id) REFERENCES Messages(id) 
      ON DELETE SET NULL;
    `).catch(err => {
      if (!err.message.includes('Duplicate key')) throw err;
      console.log('Foreign key fk_message_reply already exists.');
    });

    console.log('Migration completed successfully.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

migrate();
