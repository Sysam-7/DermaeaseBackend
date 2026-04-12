import { Router } from 'express';
import {
  checkAdmin,
  registerFirstAdmin,
  loginAdmin,
  listUsersForAdmin,
  restrictUser,
  unrestrictUser,
  deleteUserByAdmin,
} from '../controllers/admin-controller.js';
import { requireAdmin } from '../middleware/admin-auth.js';

const router = Router();

router.get('/check', checkAdmin);
router.post('/register-first', registerFirstAdmin);
router.post('/login', loginAdmin);
router.get('/users', requireAdmin, listUsersForAdmin);
router.patch('/users/:id/restrict', requireAdmin, restrictUser);
router.patch('/users/:id/unrestrict', requireAdmin, unrestrictUser);
router.patch('/users/:id/delete', requireAdmin, deleteUserByAdmin);

export default router;


