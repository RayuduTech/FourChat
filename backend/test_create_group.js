const db = require('./src/config/db');

async function test() {
  try {
    const groupName = "Test Group";
    const userId = 1;
    const memberIds = [2, 3];
    
    const [chatResult] = await db.query('INSERT INTO Chats (is_group, group_name) VALUES (true, ?)', [groupName]);
    const chatId = chatResult.insertId;

    const allMembers = [...new Set([userId, ...memberIds])];
    const participantValues = allMembers.map(id => [chatId, id, id === userId ? 'admin' : 'member']);
    
    await db.query('INSERT INTO Chat_Participants (chat_id, user_id, role) VALUES ?', [participantValues]);

    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

test();
