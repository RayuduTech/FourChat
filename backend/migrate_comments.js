require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Adding parent_comment_id and like_count to Comments table...');
    
    // Check if parent_comment_id exists
    try {
      await connection.query('ALTER TABLE Comments ADD COLUMN parent_comment_id INT DEFAULT NULL');
      console.log('Added parent_comment_id column.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('parent_comment_id column already exists.');
      } else {
        throw err;
      }
    }
    
    // Check if like_count exists
    try {
      await connection.query('ALTER TABLE Comments ADD COLUMN like_count INT DEFAULT 0');
      console.log('Added like_count column.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('like_count column already exists.');
      } else {
        throw err;
      }
    }

    // Add foreign key for parent_comment_id
    try {
      await connection.query('ALTER TABLE Comments ADD CONSTRAINT fk_parent_comment FOREIGN KEY (parent_comment_id) REFERENCES Comments(id) ON DELETE CASCADE');
      console.log('Added foreign key for parent_comment_id.');
    } catch (err) {
      // Ignore if exists or similar
      console.log('Foreign key might already exist or failed:', err.message);
    }

    console.log('Creating Comment_Likes table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Comment_Likes (
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);
    console.log('Comment_Likes table ready.');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
