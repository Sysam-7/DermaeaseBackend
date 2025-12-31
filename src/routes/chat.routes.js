import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { sendMessage, getHistory, getPatientConversations, getDoctorConversations } from '../controllers/chat-controller.js';

const router = Router();
router.use(authenticate);

router.get('/history', getHistory);
router.post('/send', sendMessage);
router.get('/conversations/patient', getPatientConversations);
router.get('/conversations/doctor', getDoctorConversations);

export default router;


