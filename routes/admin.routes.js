import { Router } from 'express';
import { checkAdmin, createAdmin, loginAdmin } from '../controllers/admin-controller.js';

const router = Router();

router.get('/check', checkAdmin);
router.post('/create', createAdmin);
router.post('/login', loginAdmin);

export default router;


