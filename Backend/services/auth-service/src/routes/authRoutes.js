const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);
router.get('/doctors', authenticate, authController.getDoctors);
// Was anonymous: anyone could look up any user's name/email/role by id.
router.get('/users/:id', authenticate, authController.getUserById);

module.exports = router;