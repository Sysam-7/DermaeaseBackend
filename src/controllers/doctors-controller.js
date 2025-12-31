import User from '../models/user.model.js';
import Appointment from '../models/appointment.model.js'; // appointment schema
import mongoose from 'mongoose';

export const listDoctors = async (req, res) => {
  try {
    const { q, specialty, location, availableDate, page = 1, limit = 20 } = req.query;
    const skip = Math.max(0, (parseInt(page, 10) - 1) * parseInt(limit, 10));

    // Base filter - only doctors
    const filter = { role: 'doctor' };

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { specialty: regex }, { bio: regex }];
    }

    if (specialty) filter.specialty = specialty;
    if (location) filter.location = new RegExp(location, 'i');

    // Count total for pagination
    const total = await User.countDocuments(filter);

    // Query doctors
    const doctors = await User.find(filter)
      .select('name email specialty location bio profilePic rating workingHoursStart workingHoursEnd workingDays')
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // If availableDate provided, compute availability per doctor
    if (availableDate && doctors.length) {
      const date = new Date(availableDate);
      date.setHours(0, 0, 0, 0);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);

      const doctorIds = doctors.map(d => mongoose.Types.ObjectId(d._id));
      const appts = await Appointment.find({
        doctor: { $in: doctorIds },
        date: { $gte: date, $lt: next },
        status: { $ne: 'cancelled' } // assume field name status
      }).select('doctor').lean();

      const busy = new Set(appts.map(a => String(a.doctor)));
      doctors.forEach(d => d.available = !busy.has(String(d._id)));
    }

    res.json({ total, data: doctors });
  } catch (err) {
    console.error('listDoctors error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await User.findById(id).select('-password').lean();
    if (!doc || doc.role !== 'doctor') return res.status(404).json({ message: 'Doctor not found' });
    // Include working hours in response
    res.json({ 
      data: {
        ...doc,
        workingHoursStart: doc.workingHoursStart || null,
        workingHoursEnd: doc.workingHoursEnd || null
      }
    });
  } catch (err) {
    console.error('getDoctor error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listSpecialties = async (req, res) => {
  try {
    const list = await User.distinct('specialty', { role: 'doctor' });
    res.json({ data: list.filter(Boolean) });
  } catch (err) {
    console.error('listSpecialties error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await User.findById(id);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    await doctor.deleteOne();
    res.json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('deleteDoctor error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PATCH /api/doctors/working-hours
 * Update doctor's working hours
 */
export const updateWorkingHours = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { workingHoursStart, workingHoursEnd, workingDays } = req.body;

    // Only doctors can update their working hours
    if (userRole !== 'doctor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only doctors can update working hours' 
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    
    if (workingHoursStart && !timeRegex.test(workingHoursStart)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid start time format. Use HH:MM format (e.g., 07:00)' 
      });
    }

    if (workingHoursEnd && !timeRegex.test(workingHoursEnd)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid end time format. Use HH:MM format (e.g., 16:00)' 
      });
    }

    // If both are provided, validate that start < end
    if (workingHoursStart && workingHoursEnd) {
      const startMinutes = parseInt(workingHoursStart.split(':')[0], 10) * 60 + parseInt(workingHoursStart.split(':')[1], 10);
      const endMinutes = parseInt(workingHoursEnd.split(':')[0], 10) * 60 + parseInt(workingHoursEnd.split(':')[1], 10);
      
      if (startMinutes >= endMinutes) {
        return res.status(400).json({ 
          success: false, 
          message: 'Start time must be before end time' 
        });
      }
    }

    // Find doctor
    const doctor = await User.findById(userId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }

    // Update working hours
    if (workingHoursStart !== undefined) {
      doctor.workingHoursStart = workingHoursStart;
    }
    if (workingHoursEnd !== undefined) {
      doctor.workingHoursEnd = workingHoursEnd;
    }
    if (workingDays !== undefined) {
      // Validate working days (should be array of numbers 0-6)
      if (Array.isArray(workingDays) && workingDays.length > 0) {
        const validDays = workingDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
        if (validDays.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'At least one valid working day must be selected' 
          });
        }
        doctor.workingDays = validDays;
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Working days must be a non-empty array' 
        });
      }
    }

    await doctor.save();

    return res.json({
      success: true,
      message: 'Working hours and days updated successfully',
      data: {
        workingHoursStart: doctor.workingHoursStart,
        workingHoursEnd: doctor.workingHoursEnd,
        workingDays: doctor.workingDays
      }
    });
  } catch (err) {
    console.error('updateWorkingHours error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};