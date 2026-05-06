const db = require('./src/config/db');

async function migrate() {
  try {
    await db.query("ALTER TABLE Chats ADD COLUMN group_pic VARCHAR(255) NULL");
    console.log('Migration successful: group_pic column added.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists, skipping.');
      process.exit(0);
    }
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
