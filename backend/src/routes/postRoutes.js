const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middlewares/authMiddleware');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, 'post-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(auth);

router.post('/', upload.single('image'), postController.createPost);
router.get('/', postController.getPosts);
router.post('/:postId/like', postController.toggleLike);
router.post('/:postId/comments', postController.addComment);
router.get('/:postId/comments', postController.getComments);
router.post('/comments/:commentId/like', postController.toggleCommentLike);

module.exports = router;
