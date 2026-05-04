const db = require('./src/config/db');

async function migrateFeatures() {
  try {
    console.log('Adding bio and profile_pic to Users...');
    await db.query(`
      ALTER TABLE Users 
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS profile_pic VARCHAR(255)
    `).catch(e => console.log('Columns might already exist or were skipped.'));

    console.log('Creating Posts table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS Posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateFeatures();
