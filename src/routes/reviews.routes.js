import { Router } from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { allowRoles } from '../middleware/roles-middleware.js';
import { createOrUpdateReview, listDoctorReviews, deleteReview, getMyDoctorReviews } from '../controllers/review-controller.js';

const router = Router();

router.get('/me/doctor', authenticate, allowRoles('doctor'), getMyDoctorReviews);
router.get('/:doctorId', listDoctorReviews);
router.post('/', authenticate, allowRoles('patient'), createOrUpdateReview);
router.delete('/:id', authenticate, allowRoles('admin'), deleteReview);

export default router;


