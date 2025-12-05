import express from 'express';
import { updateUsername } from '../controllers/user-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = express.Router();

router.put('/username', authenticate, updateUsername);

export default router;


