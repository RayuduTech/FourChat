const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');

// Protect all admin routes with both auth (must be logged in) and admin (must be an admin) middlewares
router.use(auth, admin);

router.get('/users', adminController.getUsers);
router.post('/reset-password', adminController.resetPassword);
router.put('/users/:id/unlock', adminController.unlockUser);

module.exports = router;
