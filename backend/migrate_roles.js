const db = require('./src/config/db');

async function migrate() {
  try {
    // 1. Add role to Chat_Participants
    await db.query("ALTER TABLE Chat_Participants ADD COLUMN role ENUM('member', 'admin') DEFAULT 'member'");
    
    // 2. Add anyone_can_post to Chats
    await db.query("ALTER TABLE Chats ADD COLUMN anyone_can_post BOOLEAN DEFAULT TRUE");

    // 3. Migrate existing admins from Chats.admin_id to Chat_Participants.role
    const [groups] = await db.query('SELECT id, admin_id FROM Chats WHERE is_group = true AND admin_id IS NOT NULL');
    for (const group of groups) {
      await db.query("UPDATE Chat_Participants SET role = 'admin' WHERE chat_id = ? AND user_id = ?", [group.id, group.admin_id]);
    }

    console.log('Migration successful: Multiple admins and post permissions supported.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
