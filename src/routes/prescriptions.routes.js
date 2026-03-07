import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { createPrescription, listPrescriptions, servePdf, sendPrescriptionToPatient } from '../controllers/prescription-controller.js';

const router = Router();

router.use('/files/:filename', servePdf);
router.use(authenticate);
router.get('/', listPrescriptions);
router.post('/', allowRoles('doctor'), createPrescription);
router.post('/send', allowRoles('doctor'), sendPrescriptionToPatient);

export default router;


