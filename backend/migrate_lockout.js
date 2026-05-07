const db = require('./src/config/db');

async function migrate() {
  try {
    console.log('Adding failed_attempts and locked_until to Users table...');
    
    try {
      await db.query("ALTER TABLE Users ADD COLUMN failed_attempts INT DEFAULT 0");
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    
    try {
      await db.query("ALTER TABLE Users ADD COLUMN locked_until DATETIME DEFAULT NULL");
    } catch(e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

    console.log('Migration successful: Account lockout columns added.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
