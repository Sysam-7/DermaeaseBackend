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
      .select('name email specialty location bio profilePic rating')
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
    res.json({ data: doc });
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