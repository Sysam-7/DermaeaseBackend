import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { createPrescription, listPrescriptions, servePdf } from '../controllers/prescription-controller.js';

const router = Router();

router.use('/files/:filename', servePdf);
router.use(authenticate);
router.get('/', listPrescriptions);
router.post('/', allowRoles('doctor'), createPrescription);

export default router;


