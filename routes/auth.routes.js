import { Router } from 'express';
import { login, register, logout, verifyToken, forgotPassword, resetPassword } from '../controllers/auth-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authenticate, logout);
router.get('/verify-token', authenticate, verifyToken);

export default router;


