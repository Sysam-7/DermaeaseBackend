import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { requireApprovedDoctor } from '../middleware/doctor-approval-middleware.js';
import { createPrescription, listPrescriptions, servePdf, sendPrescriptionToPatient } from '../controllers/prescription-controller.js';

const router = Router();

router.use('/files/:filename', servePdf);
router.use(authenticate);
router.get('/', listPrescriptions);
router.post('/', allowRoles('doctor'), requireApprovedDoctor, createPrescription);
router.post('/send', allowRoles('doctor'), requireApprovedDoctor, sendPrescriptionToPatient);

export default router;


