import express from 'express';
import { updateUsername, listDoctors, getCurrentUser, updateCurrentUser } from '../controllers/user-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = express.Router();

router.put('/username', authenticate, updateUsername);
// Legacy route for backward compatibility
router.get('/doctors', listDoctors);

// Get and update current user profile
router.get('/me', authenticate, getCurrentUser);
router.patch('/me', authenticate, updateCurrentUser);

export default router;


