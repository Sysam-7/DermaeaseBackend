import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { sendMessage, getHistory } from '../controllers/chat-controller.js';

const router = Router();
router.use(authenticate);

router.get('/history', getHistory);
router.post('/send', sendMessage);

export default router;


