const db = require('./src/config/db');

async function migrateFriends() {
  try {
    console.log('Creating Friendships table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS Friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id1 INT NOT NULL,
        user_id2 INT NOT NULL,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        sender_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id1) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id2) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_friendship (user_id1, user_id2)
      )
    `);
    console.log('Friendships table created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateFriends();
