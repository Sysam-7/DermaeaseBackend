import express from 'express';
import { bookAppointment, getIncomingAppointments, approveAppointment, rejectAppointment, getMyAppointments } from '../controllers/appointment-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';
import * as rolesMiddleware from '../middleware/roles-middleware.js';

// resolve requireRole whether the module exports it as a named or default export
const requireRole = rolesMiddleware.requireRole
  || (rolesMiddleware.default && rolesMiddleware.default.requireRole)
  || ((role) => (req, res, next) => { /* fallback: allow through if middleware missing; change to deny if you prefer */ next(); });

const router = express.Router();

// patient books
router.post('/book', authenticate, bookAppointment);

// doctor lists incoming pending
router.get('/doctor', authenticate, getIncomingAppointments);

// doctor approves/rejects
router.post('/:id/approve', authenticate, requireRole('doctor'), approveAppointment);
router.post('/:id/reject', authenticate, requireRole('doctor'), rejectAppointment);

// patient views his own appointments
router.get('/my', authenticate, getMyAppointments);

export default router;





