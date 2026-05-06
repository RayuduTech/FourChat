const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middlewares/authMiddleware');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', auth, chatController.getChats);
router.post('/', auth, chatController.createChat);
router.post('/groups', auth, chatController.createGroup);
router.get('/:chatId/members', auth, chatController.getGroupMembers);
router.post('/:chatId/members', auth, chatController.addGroupMembers);
router.put('/:chatId/role', auth, chatController.updateMemberRole);
router.post('/:chatId/permissions', auth, chatController.togglePostPermissions);
router.put('/:chatId/info', auth, upload.single('group_pic'), chatController.updateGroupInfo);
router.delete('/:chatId', auth, chatController.deleteGroup);
router.delete('/:chatId/members/:memberId', auth, chatController.removeGroupMember);
router.get('/:chatId/messages', auth, chatController.getMessages);
router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
