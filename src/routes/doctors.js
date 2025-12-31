import express from 'express';
import { listDoctors, getDoctor, listSpecialties, deleteDoctor } from '../controllers/doctors-controller.js';
import { requireAdmin } from '../middleware/admin-auth.js';

const router = express.Router();

// GET /doctors?q=...&specialty=...&location=...&availableDate=YYYY-MM-DD&page=1&limit=20
router.get('/', listDoctors);

// GET /doctors/specialties
router.get('/specialties', listSpecialties);

// DELETE /doctors/:id (admin only)
router.delete('/:id', requireAdmin, deleteDoctor);

// GET /doctors/:id
router.get('/:id', getDoctor);

export default router;