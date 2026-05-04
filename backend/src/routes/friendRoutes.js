const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/invite', friendController.sendRequest);
router.post('/respond', friendController.respondToRequest);
router.get('/list', friendController.getFriends);
router.get('/pending', friendController.getPendingRequests);

module.exports = router;
