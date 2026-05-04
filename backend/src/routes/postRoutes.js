const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middlewares/authMiddleware');

router.use(auth);

router.post('/', postController.createPost);
router.get('/', postController.getPosts);
router.post('/:postId/like', postController.toggleLike);
router.post('/:postId/comments', postController.addComment);
router.get('/:postId/comments', postController.getComments);

module.exports = router;
