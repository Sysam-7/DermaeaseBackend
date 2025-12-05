import Appointment from '../models/appointment.model.js';
import User from '../models/user.model.js';
import { sendInApp } from './notification-controller.js';
import { getIO } from '../services/socket.service.js';

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function createAppointment(req, res) {
  try {
    const { doctorId, start, end } = req.body;
    const patientId = req.user.id;
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor' || !doctor.verified) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!(startDate < endDate)) return res.status(400).json({ success: false, message: 'Invalid time range' });
    const existing = await Appointment.find({ doctorId, status: { $in: ['pending', 'approved'] } });
    const conflict = existing.some((a) => overlaps(startDate, endDate, a.start, a.end));
    if (conflict) return res.status(400).json({ success: false, message: 'Slot already booked' });
    const appt = await Appointment.create({ doctorId, patientId, start: startDate, end: endDate, status: 'pending' });
    await sendInApp(doctorId, 'appointment', 'New appointment request');
    await sendInApp(patientId, 'appointment', 'Appointment requested');
    res.json({ success: true, message: 'Appointment created', data: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Create failed', data: err.message });
  }
}

export async function listMyAppointments(req, res) {
  const userId = req.user.id;
  const role = req.user.role;
  const filter = role === 'doctor' ? { doctorId: userId } : role === 'patient' ? { patientId: userId } : {};
  const appts = await Appointment.find(filter).sort({ start: 1 }).populate('doctorId', 'name specialty').populate('patientId', 'name');
  res.json({ success: true, message: 'Appointments', data: appts });
}

export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const appt = await Appointment.findById(id);
  if (!appt) return res.status(404).json({ success: false, message: 'Not found' });
  const role = req.user.role;
  if (role === 'doctor' && !['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for doctor' });
  }
  if (role === 'patient' && !['cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status for patient' });
  }
  if (role === 'doctor' && String(appt.doctorId) !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
  if (role === 'patient' && String(appt.patientId) !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
  appt.status = status;
  await appt.save();
  await sendInApp(appt.doctorId, 'appointment', `Appointment ${status}`);
  await sendInApp(appt.patientId, 'appointment', `Appointment ${status}`);
  res.json({ success: true, message: 'Status updated', data: appt });
}

export async function reschedule(req, res) {
  const { id } = req.params;
  const { start, end } = req.body;
  const appt = await Appointment.findById(id);
  if (!appt) return res.status(404).json({ success: false, message: 'Not found' });
  if (String(appt.patientId) !== req.user.id && String(appt.doctorId) !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  const existing = await Appointment.find({ doctorId: appt.doctorId, _id: { $ne: appt._id }, status: { $in: ['pending', 'approved'] } });
  const conflict = existing.some((a) => overlaps(startDate, endDate, a.start, a.end));
  if (conflict) return res.status(400).json({ success: false, message: 'Slot already booked' });
  appt.start = startDate;
  appt.end = endDate;
  appt.status = 'rescheduled';
  await appt.save();
  await sendInApp(appt.doctorId, 'appointment', 'Appointment rescheduled');
  await sendInApp(appt.patientId, 'appointment', 'Appointment rescheduled');
  res.json({ success: true, message: 'Rescheduled', data: appt });
}

// POST /appointments/book
export const bookAppointment = async (req, res) => {
  try {
    const patientId = req.userId || req.body.patientId;
    const { doctorId, patientUsername, date } = req.body;

    if (!patientId || !doctorId || !patientUsername) {
      return res.status(400).json({ success: false, message: 'patientId, doctorId and patientUsername required' });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appt = new Appointment({
      patientId,
      doctorId,
      patientUsername,
      date: date ? new Date(date) : undefined,
      status: 'pending',
    });
    await appt.save();

    // emit real-time event to doctor room (room name = doctorId)
    try {
      const io = getIO();
      if (io) {
        io.to(String(doctorId)).emit('new-appointment', appt);
      }
    } catch (emitErr) {
      console.error('emit new-appointment error', emitErr);
    }

    return res.status(201).json({ success: true, message: 'Appointment booked and pending approval.', data: appt });
  } catch (err) {
    console.error('bookAppointment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /appointments/doctor   (doctor must be authenticated)
export const getIncomingAppointments = async (req, res) => {
  try {
    const doctorId = req.userId;
    if (!doctorId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appts = await Appointment.find({ doctorId, status: 'pending' }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: appts });
  } catch (err) {
    console.error('getIncomingAppointments error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveAppointment = async (req, res) => {
  try {
    const doctorId = req.userId;
    const { id } = req.params;
    if (!doctorId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (String(appt.doctorId) !== String(doctorId)) return res.status(403).json({ success: false, message: 'Not allowed' });

    appt.status = 'approved';
    await appt.save();

    // Emit update to patient and doctor rooms
    try {
      const io = getIO();
      if (io) {
        io.to(String(appt.patientId)).emit('appointment-updated', appt);
        io.to(String(appt.doctorId)).emit('appointment-updated', appt);
      }
    } catch (err) {
      console.error('emit appointment-updated error', err);
    }

    return res.json({ success: true, message: 'Appointment approved', data: appt });
  } catch (err) {
    console.error('approveAppointment error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const rejectAppointment = async (req, res) => {
  try {
    const doctorId = req.userId;
    const { id } = req.params;
    if (!doctorId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (String(appt.doctorId) !== String(doctorId)) return res.status(403).json({ success: false, message: 'Not allowed' });

    appt.status = 'rejected';
    await appt.save();

    try {
      const io = getIO();
      if (io) {
        io.to(String(appt.patientId)).emit('appointment-updated', appt);
        io.to(String(appt.doctorId)).emit('appointment-updated', appt);
      }
    } catch (err) {
      console.error('emit appointment-updated error', err);
    }

    return res.json({ success: true, message: 'Appointment rejected', data: appt });
  } catch (err) {
    console.error('rejectAppointment error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.userId;
    if (!patientId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appts = await Appointment.find({ patientId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: appts });
  } catch (err) {
    console.error('getMyAppointments error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



