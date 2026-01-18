import Appointment from '../models/appointment.model.js';
import User from '../models/user.model.js';
import { sendInApp } from './notification-controller.js';
import { getIO } from '../services/socket.service.js';

// Helper function to check time overlaps
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Helper function to validate time is in hours or quarters (00, 15, 30, 45)
function isValidTimeSlot(timeString) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(timeString)) {
    return false;
  }
  const [, hours, minutes] = timeString.match(timeRegex);
  const minutesInt = parseInt(minutes, 10);
  // Only allow 00, 15, 30, 45 minutes
  return minutesInt === 0 || minutesInt === 15 || minutesInt === 30 || minutesInt === 45;
}

// Helper function to convert time string to minutes since midnight
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to check if time is within working hours
function isWithinWorkingHours(timeString, startTime, endTime) {
  if (!startTime || !endTime) {
    return true; // If no working hours set, allow any time
  }
  const timeMinutes = timeToMinutes(timeString);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

/**
 * POST /api/appointments
 * Book a new appointment (Patient)
 */
export const bookAppointment = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { doctorId, date, time, start, end } = req.body;

    // Validate required fields
    if (!doctorId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Doctor ID is required' 
      });
    }

    if (!date || !time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both date and time are required' 
      });
    }

    // Validate date format
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot book appointments in the past' 
      });
    }

    // Validate time format and ensure it's in hours or quarters
    if (!isValidTimeSlot(time)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Time must be in hours or quarters (e.g., 09:00, 09:15, 09:30, 09:45). Random minutes are not allowed.' 
      });
    }

    // Check if doctor exists and is valid
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    // Check doctor's working hours
    if (doctor.workingHoursStart && doctor.workingHoursEnd) {
      if (!isWithinWorkingHours(time, doctor.workingHoursStart, doctor.workingHoursEnd)) {
        return res.status(400).json({ 
          success: false, 
          message: `This time slot is outside the doctor's working hours (${doctor.workingHoursStart} - ${doctor.workingHoursEnd})` 
        });
      }
    }

    // Check doctor's working days
    if (doctor.workingDays && doctor.workingDays.length > 0) {
      const appointmentDay = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (!doctor.workingDays.includes(appointmentDay)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const workingDayNames = doctor.workingDays.map(d => dayNames[d]).join(', ');
        return res.status(400).json({ 
          success: false, 
          message: `The doctor is not available on this day. Available days: ${workingDayNames}` 
        });
      }
    }

    // Parse time and set appointment date
    const [hours, minutes] = time.split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);
    const appointmentTime = time;

    // Calculate end time (1 hour after start)
    const endTime = new Date(appointmentDate);
    endTime.setHours(endTime.getHours() + 1);

    // Check for double booking - find existing appointments for the same doctor at the same time
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await Appointment.find({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] } // Only check non-cancelled appointments
    });

    // Check if the time slot overlaps with any existing appointment
    const hasConflict = existingAppointments.some((existing) => {
      // If existing appointment has start/end, check overlap
      if (existing.start && existing.end) {
        return overlaps(appointmentDate, endTime, existing.start, existing.end);
      }
      // Otherwise, check if time matches exactly (same hour slot)
      if (existing.time === appointmentTime) {
        return true;
      }
      // Check if times are in the same hour slot
      const existingTime = existing.time ? existing.time.split(':') : null;
      if (existingTime) {
        const existingHour = parseInt(existingTime[0], 10);
        const requestedHour = parseInt(hours, 10);
        // If same hour, it's a conflict (1-hour appointments)
        return existingHour === requestedHour;
      }
      return false;
    });

    if (hasConflict) {
      return res.status(400).json({ 
        success: false, 
        message: 'This time slot is already booked. Please choose another time.' 
      });
    }

    // Create appointment
    const appointment = new Appointment({
      patientId,
      doctorId,
      date: appointmentDate,
      time: appointmentTime,
      start: appointmentDate,
      end: endTime,
      status: 'pending',
      patientUsername: req.user.name || req.user.email,
    });

    await appointment.save();

    // Populate patient and doctor info for response
    await appointment.populate('patientId', 'name email');
    await appointment.populate('doctorId', 'name specialty');

    // Send notifications with appointment details
    try {
      const patientName = appointment.patientId?.name || appointment.patientUsername || 'A patient';
      await sendInApp(
        doctorId, 
        'appointment_request', 
        `${patientName} sent you an appointment request for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.time}`,
        appointment._id,
        { patientName, date: appointment.date, time: appointment.time, status: 'pending' }
      );
      await sendInApp(
        patientId, 
        'appointment_requested', 
        `Your appointment request has been sent to Dr. ${appointment.doctorId?.name || 'Doctor'}`,
        appointment._id,
        { doctorName: appointment.doctorId?.name, date: appointment.date, time: appointment.time, status: 'pending' }
      );
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    // Emit real-time event
    try {
      const io = getIO();
      if (io) {
        io.to(String(doctorId)).emit('new-appointment', appointment);
      }
    } catch (emitErr) {
      console.error('Socket emit error:', emitErr);
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Appointment booked successfully', 
      data: appointment 
    });
  } catch (err) {
    console.error('bookAppointment error:', err);
    
    // Handle specific MongoDB errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: ' + Object.values(err.errors).map(e => e.message).join(', ') 
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid ID format' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: 'Server error while booking appointment', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * GET /api/appointments/doctor/:doctorId
 * Get all appointments for a specific doctor
 */
export const getDoctorAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    // If requesting user is the doctor, allow access
    // If requesting user is admin, allow access
    // Otherwise, deny access
    if (requestingUserRole !== 'doctor' && requestingUserRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    if (requestingUserRole === 'doctor' && String(requestingUserId) !== String(doctorId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only view your own appointments' 
      });
    }

    const appointments = await Appointment.find({ doctorId })
      .sort({ date: 1, time: 1 })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .lean();

    return res.json({ 
      success: true, 
      data: appointments 
    });
  } catch (err) {
    console.error('getDoctorAppointments error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

/**
 * GET /api/appointments/patient/:patientId
 * Get all appointments for a specific patient
 */
export const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    // If requesting user is the patient, allow access
    // If requesting user is admin, allow access
    // Otherwise, deny access
    if (requestingUserRole !== 'patient' && requestingUserRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    if (requestingUserRole === 'patient' && String(requestingUserId) !== String(patientId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only view your own appointments' 
      });
    }

    const appointments = await Appointment.find({ patientId })
      .sort({ date: 1, time: 1 })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .lean();

    return res.json({ 
      success: true, 
      data: appointments 
    });
  } catch (err) {
    console.error('getPatientAppointments error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

/**
 * PATCH /api/appointments/:id/status
 * Update appointment status
 */
export const updateAppointmentStatus = async (req, res) => {
  try {
  const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Find appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found' 
      });
    }

    // Check permissions
    const isDoctor = userRole === 'doctor' && String(appointment.doctorId) === String(userId);
    const isPatient = userRole === 'patient' && String(appointment.patientId) === String(userId);
    const isAdmin = userRole === 'admin';

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to update this appointment' 
      });
    }

    // Validate status transitions
    if (isPatient && status !== 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Patients can only cancel appointments' 
      });
    }

    if (isDoctor && !['confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Doctors can only confirm, cancel, or complete appointments' 
      });
    }

    // Update status
    appointment.status = status;
    await appointment.save();

    // Populate for response
    await appointment.populate('patientId', 'name email');
    await appointment.populate('doctorId', 'name specialty');

    // Send notifications with appointment details
    try {
      const patientName = appointment.patientId?.name || 'Patient';
      const doctorName = appointment.doctorId?.name || 'Doctor';
      const appointmentDate = appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A';
      const appointmentTime = appointment.time || 'N/A';
      
      if (status === 'confirmed') {
        await sendInApp(
          appointment.patientId, 
          'appointment_confirmed', 
          `Dr. ${doctorName} has confirmed your appointment for ${appointmentDate} at ${appointmentTime}`,
          appointment._id,
          { doctorName, date: appointment.date, time: appointment.time, status: 'confirmed' }
        );
      } else if (status === 'cancelled') {
        // Only notify patient when doctor cancels
        if (userRole === 'doctor') {
          await sendInApp(
            appointment.patientId, 
            'appointment_cancelled', 
            `Dr. ${doctorName} has cancelled your appointment for ${appointmentDate} at ${appointmentTime}`,
            appointment._id,
            { doctorName, date: appointment.date, time: appointment.time, status: 'cancelled' }
          );
        }
      } else if (status === 'completed') {
        await sendInApp(
          appointment.patientId, 
          'appointment_completed', 
          `Your appointment with Dr. ${doctorName} on ${appointmentDate} has been marked as completed`,
          appointment._id,
          { doctorName, date: appointment.date, time: appointment.time, status: 'completed' }
        );
      }
    } catch (notifErr) {
      console.error('Notification error:', notifErr);
    }

    // Emit real-time update
    try {
      const io = getIO();
      if (io) {
        io.to(String(appointment.patientId)).emit('appointment-updated', appointment);
        io.to(String(appointment.doctorId)).emit('appointment-updated', appointment);
      }
    } catch (emitErr) {
      console.error('Socket emit error:', emitErr);
    }

    return res.json({ 
      success: true, 
      message: 'Appointment status updated', 
      data: appointment 
    });
  } catch (err) {
    console.error('updateAppointmentStatus error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

/**
 * GET /api/appointments/my
 * Get current user's appointments (works for both doctor and patient)
 */
export const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let filter = {};
    if (userRole === 'doctor') {
      filter = { doctorId: userId };
    } else if (userRole === 'patient') {
      filter = { patientId: userId };
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid role' 
      });
    }

    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .lean();

    return res.json({ 
      success: true, 
      data: appointments 
    });
  } catch (err) {
    console.error('getMyAppointments error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Legacy functions for backward compatibility
export const getIncomingAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const appointments = await Appointment.find({ 
      doctorId, 
      status: 'pending' 
    })
      .sort({ createdAt: -1 })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .lean();

    return res.json({ success: true, data: appointments });
  } catch (err) {
    console.error('getIncomingAppointments error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveAppointment = async (req, res) => {
  return updateAppointmentStatus(req, res);
};

export const rejectAppointment = async (req, res) => {
  req.body.status = 'cancelled';
  return updateAppointmentStatus(req, res);
};

// Legacy createAppointment function
export async function createAppointment(req, res) {
  return bookAppointment(req, res);
}

// Legacy listMyAppointments function
export async function listMyAppointments(req, res) {
  return getMyAppointments(req, res);
      }

// Legacy updateStatus function
export async function updateStatus(req, res) {
  return updateAppointmentStatus(req, res);
}

// Legacy reschedule function
export async function reschedule(req, res) {
  try {
    const { id } = req.params;
    const { start, end, date, time } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (String(appointment.patientId) !== String(userId) && String(appointment.doctorId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let newDate, newTime;
    if (date && time) {
      // Validate time format
      if (!isValidTimeSlot(time)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Time must be in hours or quarters (e.g., 09:00, 09:15, 09:30, 09:45)' 
        });
      }
      const [hours, minutes] = time.split(':');
      newDate = new Date(date);
      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      newTime = time;
    } else if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      newDate = startDate;
      newTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
      
      // Check for conflicts
      const existing = await Appointment.find({ 
        doctorId: appointment.doctorId, 
        _id: { $ne: appointment._id }, 
        status: { $in: ['pending', 'confirmed'] } 
      });
      const conflict = existing.some((a) => {
        if (a.start && a.end) {
          return overlaps(startDate, endDate, a.start, a.end);
        }
        return false;
      });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Slot already booked' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid reschedule data' });
  }

    appointment.date = newDate;
    appointment.time = newTime;
    if (start && end) {
      appointment.start = new Date(start);
      appointment.end = new Date(end);
    }
    appointment.status = 'pending';
    await appointment.save();

    try {
      await sendInApp(appointment.doctorId, 'appointment', 'Appointment rescheduled');
      await sendInApp(appointment.patientId, 'appointment', 'Appointment rescheduled');
    } catch (err) {
      console.error('Notification error:', err);
    }

    return res.json({ success: true, message: 'Rescheduled', data: appointment });
  } catch (err) {
    console.error('reschedule error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * GET /api/appointments/available-slots/:doctorId
 * Get available time slots for a doctor on a specific date
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Date parameter is required' 
      });
    }

    // Check if doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    // Get doctor's working hours
    const startTime = doctor.workingHoursStart || '09:00';
    const endTime = doctor.workingHoursEnd || '17:00';

    // Parse date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }

    // Check if the date is on a working day
    if (doctor.workingDays && doctor.workingDays.length > 0) {
      const appointmentDay = appointmentDate.getDay();
      if (!doctor.workingDays.includes(appointmentDay)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const workingDayNames = doctor.workingDays.map(d => dayNames[d]).join(', ');
        return res.json({
          success: true,
          data: {
            doctorId,
            date,
            workingHours: {
              start: startTime,
              end: endTime
            },
            workingDays: doctor.workingDays,
            slots: [],
            message: `Doctor is not available on this day. Available days: ${workingDayNames}`
          }
        });
      }
    }

    // Get all booked appointments for this doctor on this date
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] }
    });

    // Create set of booked time slots
    const bookedSlots = new Set();
    bookedAppointments.forEach((apt) => {
      if (apt.time) {
        bookedSlots.add(apt.time);
      } else if (apt.start) {
        const timeStr = `${apt.start.getHours().toString().padStart(2, '0')}:${apt.start.getMinutes().toString().padStart(2, '0')}`;
        bookedSlots.add(timeStr);
      }
    });

    // Generate all possible time slots (in quarters) within working hours
    const availableSlots = [];
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeSlot = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      
      // Check if this slot is booked
      const isBooked = bookedSlots.has(timeSlot);
      
      availableSlots.push({
        time: timeSlot,
        available: !isBooked
      });
    }

    return res.json({
      success: true,
      data: {
        doctorId,
        date,
        workingHours: {
          start: startTime,
          end: endTime
        },
        workingDays: doctor.workingDays || [],
        slots: availableSlots
      }
    });
  } catch (err) {
    console.error('getAvailableSlots error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};
