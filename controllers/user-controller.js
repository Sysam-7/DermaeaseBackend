import User from '../models/user.model.js';

export async function getMe(req, res) {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ success: true, message: 'Me', data: user });
}

export async function listDoctors(req, res) {
  const { specialty, location, rating } = req.query;
  const filter = { role: 'doctor', verified: true };
  if (specialty) filter.specialty = new RegExp(`^${specialty}$`, 'i');
  if (location) filter.location = new RegExp(location, 'i');
  if (rating) filter.rating = { $gte: Number(rating) };
  const doctors = await User.find(filter).select('-password');
  res.json({ success: true, message: 'Doctors', data: doctors });
}

export async function approveDoctor(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user || user.role !== 'doctor') return res.status(404).json({ success: false, message: 'Doctor not found' });
  user.verified = true;
  await user.save();
  res.json({ success: true, message: 'Doctor approved', data: { id: user._id } });
}

// export const updateUsername = async (req, res) => {
//   try {
//     const userId = req.userId;
//     const { username } = req.body;
//     if (!userId || !username) return res.status(400).json({ success: false, message: 'Username required' });

//     // Ensure uniqueness
//     const exists = await User.findOne({ username, _id: { $ne: userId } });
//     if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });

//     const u = await User.findByIdAndUpdate(userId, { username }, { new: true }).select('-password');
//     return res.json({ success: true, data: u });
//   } catch (err) {
//     console.error('updateUsername error:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// };





