const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/search', auth, authController.searchUsers);
router.get('/profile', auth, authController.getProfile);
router.get('/profile/:userId', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);

module.exports = router;
