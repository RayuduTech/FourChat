const db = require('../config/db');

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get all chats for the user
    // For 1-on-1, we fetch the other participant's username
    // For groups, we fetch the group name
    const [chats] = await db.query(`
      SELECT 
        c.id, c.is_group, c.group_name, c.group_pic, c.created_at, c.anyone_can_post,
        u.username as other_username, u.status as other_status, u.id as other_user_id, u.profile_pic as other_profile_pic,
        cp1.role as my_role
      FROM Chats c
      JOIN Chat_Participants cp1 ON c.id = cp1.chat_id
      LEFT JOIN Chat_Participants cp2 ON c.id = cp2.chat_id AND cp2.user_id != cp1.user_id AND c.is_group = false
      LEFT JOIN Users u ON cp2.user_id = u.id
      WHERE cp1.user_id = ?
      ORDER BY c.created_at DESC
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
      const [chatDetails] = await db.query(`
        SELECT 
          c.id, c.is_group, c.group_name, c.created_at, c.anyone_can_post,
          u.username as other_username, u.status as other_status, u.id as other_user_id, u.profile_pic as other_profile_pic,
          'member' as my_role
        FROM Chats c
        JOIN Users u ON u.id = ?
        WHERE c.id = ?
      `, [otherUserId, existing[0].id]);
      return res.json(chatDetails[0]);
    }

    // Create new chat
    const [chatResult] = await db.query('INSERT INTO Chats (is_group) VALUES (false)');
    const chatId = chatResult.insertId;

    await db.query('INSERT INTO Chat_Participants (chat_id, user_id) VALUES (?, ?), (?, ?)', 
      [chatId, userId, chatId, otherUserId]
    );

    const [newChatDetails] = await db.query(`
      SELECT 
        c.id, c.is_group, c.group_name, c.created_at, c.anyone_can_post,
        u.username as other_username, u.status as other_status, u.id as other_user_id, u.profile_pic as other_profile_pic,
        'member' as my_role
      FROM Chats c
      JOIN Users u ON u.id = ?
      WHERE c.id = ?
    `, [otherUserId, chatId]);

    res.status(201).json(newChatDetails[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createGroup = async (req, res) => {
  const { groupName, memberIds } = req.body;
  const userId = req.user.id;
  try {
    const [chatResult] = await db.query('INSERT INTO Chats (is_group, group_name) VALUES (true, ?)', [groupName]);
    const chatId = chatResult.insertId;

    const allMembers = [...new Set([userId, ...memberIds])];
    const participantValues = allMembers.map(id => [chatId, id, id === userId ? 'admin' : 'member']);
    
    await db.query('INSERT INTO Chat_Participants (chat_id, user_id, role) VALUES ?', [participantValues]);

    res.status(201).json({ 
      id: chatId, 
      is_group: true, 
      group_name: groupName, 
      anyone_can_post: true, 
      my_role: 'admin' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getGroupMembers = async (req, res) => {
  const { chatId } = req.params;
  try {
    const [members] = await db.query(`
      SELECT u.id, u.username, u.profile_pic, u.status, cp.role
      FROM Users u
      JOIN Chat_Participants cp ON u.id = cp.user_id
      WHERE cp.chat_id = ?
    `, [chatId]);

    const [groupInfo] = await db.query('SELECT group_name, group_pic, anyone_can_post FROM Chats WHERE id = ?', [chatId]);

    res.json({ members, group_name: groupInfo[0]?.group_name, group_pic: groupInfo[0]?.group_pic, anyone_can_post: groupInfo[0]?.anyone_can_post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addGroupMembers = async (req, res) => {
  const { chatId } = req.params;
  const { memberIds } = req.body;
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can add members' });

    const participantValues = memberIds.map(id => [chatId, id, 'member']);
    await db.query('INSERT IGNORE INTO Chat_Participants (chat_id, user_id, role) VALUES ?', [participantValues]);

    res.json({ message: 'Members added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMemberRole = async (req, res) => {
  const { chatId } = req.params;
  const { targetUserId, role } = req.body; // role: 'admin' or 'member'
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can change roles' });

    await db.query('UPDATE Chat_Participants SET role = ? WHERE chat_id = ? AND user_id = ?', [role, chatId, targetUserId]);
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.removeGroupMember = async (req, res) => {
  const { chatId, memberId } = req.params;
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can remove members' });

    await db.query('DELETE FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, memberId]);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.togglePostPermissions = async (req, res) => {
  const { chatId } = req.params;
  const { anyoneCanPost } = req.body;
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can change permissions' });

    await db.query('UPDATE Chats SET anyone_can_post = ? WHERE id = ?', [anyoneCanPost, chatId]);
    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateGroupInfo = async (req, res) => {
  const { chatId } = req.params;
  const { groupName } = req.body;
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can update group info' });

    let groupPic = null;
    if (req.file) {
      groupPic = `/uploads/${req.file.filename}`;
    }

    if (groupName) await db.query('UPDATE Chats SET group_name = ? WHERE id = ?', [groupName, chatId]);
    if (groupPic) await db.query('UPDATE Chats SET group_pic = ? WHERE id = ?', [groupPic, chatId]);

    const [updated] = await db.query('SELECT group_name, group_pic FROM Chats WHERE id = ?', [chatId]);
    res.json({ message: 'Group updated', ...updated[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    const [caller] = await db.query('SELECT role FROM Chat_Participants WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
    if (caller.length === 0 || caller[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can delete the group' });

    await db.query('DELETE FROM Chat_Participants WHERE chat_id = ?', [chatId]);
    await db.query('DELETE FROM Messages WHERE chat_id = ?', [chatId]);
    await db.query('DELETE FROM Chats WHERE id = ?', [chatId]);

    res.json({ message: 'Group deleted successfully' });
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
