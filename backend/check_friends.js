const db = require('./src/config/db');

async function checkData() {
  try {
    const [users] = await db.query('SELECT id, username FROM Users');
    console.log('Users:', users);

    const [friendships] = await db.query('SELECT * FROM Friendships');
    console.log('Friendships:', friendships);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
