import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { initiateKhaltiPayment, verifyKhaltiPayment, getPublicFee } from '../controllers/khalti-payment.controller.js';

const router = Router();

router.get('/fee', getPublicFee);
router.post('/khalti/initiate', authenticate, allowRoles('patient', 'admin'), initiateKhaltiPayment);
router.post('/khalti/verify', authenticate, allowRoles('patient', 'admin'), verifyKhaltiPayment);

export default router;
