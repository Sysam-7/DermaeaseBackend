import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  updateUsername,
  listDoctors,
  getCurrentUser,
  updateCurrentUser,
  listPatients,
  uploadProfileImage,
} from '../controllers/user-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';

const router = express.Router();

const profileUploadsRoot = path.join(process.cwd(), 'uploads', 'profile-images');
if (!fs.existsSync(profileUploadsRoot)) {
  fs.mkdirSync(profileUploadsRoot, { recursive: true });
}

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadsRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    }
  },
});

router.put('/username', authenticate, updateUsername);
// Legacy route for backward compatibility
router.get('/doctors', listDoctors);

// Get and update current user profile
router.get('/me', authenticate, getCurrentUser);
router.patch('/me', authenticate, updateCurrentUser);
router.post(
  '/me/profile-image',
  authenticate,
  (req, res, next) => {
    profileUpload.single('profileImage')(req, res, (err) => {
      if (err) {
        const msg = err.message || 'Upload failed';
        return res.status(400).json({ success: false, message: msg });
      }
      next();
    });
  },
  uploadProfileImage
);

// List all patients (for doctors)
router.get('/patients', authenticate, listPatients);

export default router;


