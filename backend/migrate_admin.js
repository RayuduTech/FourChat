const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function runMigration() {
  try {
    console.log('Adding is_admin column to Users table...');
    try {
      await db.query('ALTER TABLE Users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
      console.log('Added is_admin column successfully.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('is_admin column already exists.');
      } else {
        throw e;
      }
    }

    console.log('Creating default admin user...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);

    try {
      await db.query(`
        INSERT INTO Users (username, email, password_hash, is_admin)
        VALUES (?, ?, ?, ?)
      `, ['admin', 'admin@fourchat.com', hash, true]);
      console.log('Admin user created successfully.');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log('Admin user already exists.');
      } else {
        throw e;
      }
    }
    
    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
