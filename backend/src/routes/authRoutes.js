const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/authMiddleware');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/search', auth, authController.searchUsers);
router.get('/profile', auth, authController.getProfile);
router.get('/profile/:userId', auth, authController.getProfile);
router.put('/profile', auth, upload.single('profile_pic'), authController.updateProfile);

module.exports = router;
