import express from 'express';
import { updateUsername, listDoctors, getCurrentUser, updateCurrentUser, listPatients } from '../controllers/user-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = express.Router();

router.put('/username', authenticate, updateUsername);
// Legacy route for backward compatibility
router.get('/doctors', listDoctors);

// Get and update current user profile
router.get('/me', authenticate, getCurrentUser);
router.patch('/me', authenticate, updateCurrentUser);

// List all patients (for doctors)
router.get('/patients', authenticate, listPatients);

export default router;


