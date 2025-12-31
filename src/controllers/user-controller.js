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

export async function updateUsername(req, res) {
  try {
    const userId = req.user.id; // Use req.user from authenticate middleware
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is required' 
      });
    }

    // Ensure uniqueness
    const exists = await User.findOne({ 
      username, 
      _id: { $ne: userId } 
    });
    
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already taken' 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId, 
      { username }, 
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Username updated',
      data: user 
    });
  } catch (err) {
    console.error('updateUsername error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
}

/**
 * GET /api/users/me
 * Get current user's profile
 */
export async function getCurrentUser(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password').lean();
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    return res.json({ 
      success: true, 
      data: user 
    });
  } catch (err) {
    console.error('getCurrentUser error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
}

/**
 * PATCH /api/users/me
 * Update current user's profile
 */
export async function updateCurrentUser(req, res) {
  try {
    const userId = req.user.id;
    const { name, email, specialty, location, bio } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (specialty !== undefined) updateData.specialty = specialty;
    if (location !== undefined) updateData.location = location;
    if (bio !== undefined) updateData.bio = bio;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: user 
    });
  } catch (err) {
    console.error('updateCurrentUser error:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: ' + Object.values(err.errors).map(e => e.message).join(', ') 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
}





