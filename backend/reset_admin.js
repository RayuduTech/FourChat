const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    
    await db.query('UPDATE Users SET password_hash = ? WHERE email = ?', [hash, 'admin@fourchat.com']);
    console.log('Admin password reset to admin123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetAdmin();
