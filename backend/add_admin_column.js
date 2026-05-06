const db = require('./src/config/db');

async function migrate() {
  try {
    await db.query('ALTER TABLE Chats ADD COLUMN admin_id INT');
    await db.query('ALTER TABLE Chats ADD CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES Users(id)');
    
    // Set admin_id for existing groups (just pick the first participant for now)
    const [groups] = await db.query('SELECT id FROM Chats WHERE is_group = true');
    for (const group of groups) {
      const [participants] = await db.query('SELECT user_id FROM Chat_Participants WHERE chat_id = ? LIMIT 1', [group.id]);
      if (participants.length > 0) {
        await db.query('UPDATE Chats SET admin_id = ? WHERE id = ?', [participants[0].user_id, group.id]);
      }
    }
    
    console.log('Migration successful: admin_id added to Chats');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
