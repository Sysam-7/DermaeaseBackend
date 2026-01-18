import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { listMyNotifications, markRead, markAllAsRead, listSmsLogs } from '../controllers/notification-controller.js';

const router = Router();

router.use(authenticate);
router.get('/', listMyNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllAsRead);
router.get('/sms/logs', allowRoles('admin'), listSmsLogs);

export default router;


