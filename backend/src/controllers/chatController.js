const db = require('../config/db');

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get all chats for the user, along with the other participant's details
    const [chats] = await db.query(`
      SELECT c.id, c.is_group, c.group_name, c.created_at,
             u.id as other_user_id, u.username as other_username, u.status as other_status
      FROM Chats c
      JOIN Chat_Participants cp1 ON c.id = cp1.chat_id
      JOIN Chat_Participants cp2 ON c.id = cp2.chat_id AND cp2.user_id != cp1.user_id
      LEFT JOIN Users u ON cp2.user_id = u.id
      WHERE cp1.user_id = ?
    `, [userId]);
    
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createChat = async (req, res) => {
  const { otherUserId } = req.body;
  const userId = req.user.id;
  try {
    // Check if 1-on-1 chat already exists
    const [existing] = await db.query(`
      SELECT c.id FROM Chats c
      JOIN Chat_Participants cp1 ON c.id = cp1.chat_id
      JOIN Chat_Participants cp2 ON c.id = cp2.chat_id
      WHERE c.is_group = false 
        AND cp1.user_id = ? 
        AND cp2.user_id = ?
    `, [userId, otherUserId]);

    if (existing.length > 0) {
      return res.json({ id: existing[0].id });
    }

    // Create new chat
    const [chatResult] = await db.query('INSERT INTO Chats (is_group) VALUES (false)');
    const chatId = chatResult.insertId;

    await db.query('INSERT INTO Chat_Participants (chat_id, user_id) VALUES (?, ?), (?, ?)', 
      [chatId, userId, chatId, otherUserId]
    );

    res.status(201).json({ id: chatId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  try {
    // Basic authorization: check if user is in chat
    const [participant] = await db.query(
      'SELECT * FROM Chat_Participants WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.id]
    );
    if (participant.length === 0) return res.status(403).json({ error: 'Not a participant' });

    const [messages] = await db.query(`
      SELECT m.*, u.username as sender_username 
      FROM Messages m 
      JOIN Users u ON m.sender_id = u.id 
      WHERE m.chat_id = ? 
      ORDER BY m.created_at ASC
    `, [chatId]);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
