import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  applyDoctor,
  listPendingDoctorApplications,
  reviewDoctorApplication,
} from '../controllers/doctor-application-controller.js';
import { requireAdmin } from '../middleware/admin-auth.js';

const router = Router();

const uploadsRoot = path.join(process.cwd(), 'uploads', 'doctor-documents');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeField = (file.fieldname || 'doc').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeField}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

router.post(
  '/apply',
  upload.fields([
    { name: 'medicalLicense', maxCount: 1 },
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
  ]),
  applyDoctor
);

router.get('/pending', requireAdmin, listPendingDoctorApplications);
router.patch('/:id/review', requireAdmin, reviewDoctorApplication);

export default router;
