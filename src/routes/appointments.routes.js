import express from 'express';
import { 
  bookAppointment, 
  getDoctorAppointments, 
  getPatientAppointments, 
  updateAppointmentStatus,
  getMyAppointments,
  getIncomingAppointments,
  approveAppointment,
  rejectAppointment,
  getAvailableSlots
} from '../controllers/appointment-controller.js';
import { updateWorkingHours } from '../controllers/doctors-controller.js';
import { authenticate } from '../middleware/auth-middleware.js';
import * as rolesMiddleware from '../middleware/roles-middleware.js';

// Resolve requireRole whether the module exports it as a named or default export
const requireRole = rolesMiddleware.requireRole
  || (rolesMiddleware.default && rolesMiddleware.default.requireRole)
  || ((role) => (req, res, next) => { next(); });

const router = express.Router();

// Patient books appointment
// POST /api/appointments
router.post('/', authenticate, bookAppointment);

// Get appointments for a specific doctor
// GET /api/appointments/doctor/:doctorId
router.get('/doctor/:doctorId', authenticate, getDoctorAppointments);

// Get appointments for a specific patient
// GET /api/appointments/patient/:patientId
router.get('/patient/:patientId', authenticate, getPatientAppointments);

// Update appointment status
// PATCH /api/appointments/:id/status
router.patch('/:id/status', authenticate, updateAppointmentStatus);

// Get current user's appointments (works for both doctor and patient)
// GET /api/appointments/my
router.get('/my', authenticate, getMyAppointments);

// Legacy routes for backward compatibility
// POST /api/appointments/book
router.post('/book', authenticate, bookAppointment);

// GET /api/appointments/doctor (doctor's own appointments)
router.get('/doctor', authenticate, requireRole('doctor'), getIncomingAppointments);

// POST /api/appointments/:id/approve
router.post('/:id/approve', authenticate, requireRole('doctor'), approveAppointment);

// POST /api/appointments/:id/reject
router.post('/:id/reject', authenticate, requireRole('doctor'), rejectAppointment);

// GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD
router.get('/available-slots/:doctorId', getAvailableSlots);

// PATCH /api/appointments/working-hours
router.patch('/working-hours', authenticate, requireRole('doctor'), updateWorkingHours);

export default router;
