import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import User from '../models/user.model.js';

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'secret';
const ADMIN_TOKEN_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '12h';

export async function checkAdmin(req, res) {
  try {
    const exists = await Admin.exists({});
    res.json({ adminExists: Boolean(exists) });
  } catch (err) {
    console.error('checkAdmin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function registerFirstAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(409).json({ message: 'Admin already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await Admin.create({ email, password: hashed });

    res.status(201).json({ message: 'Admin created' });
  } catch (err) {
    console.error('createAdmin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = jwt.sign({ adminId: admin._id, role: 'admin' }, ADMIN_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRES_IN });
    res.json({ token });
  } catch (err) {
    console.error('loginAdmin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function listUsersForAdmin(req, res) {
  try {
    const users = await User.find({ role: { $in: ['patient', 'doctor'] } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('listUsersForAdmin error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function restrictUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot restrict admin' });

    user.accessStatus = 'restricted';
    user.accessReason = reason.trim();
    user.accessUpdatedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'User restricted successfully', data: user });
  } catch (err) {
    console.error('restrictUser error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function unrestrictUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.accessStatus = 'active';
    user.accessReason = '';
    user.accessUpdatedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'User access restored', data: user });
  } catch (err) {
    console.error('unrestrictUser error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function deleteUserByAdmin(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin' });

    user.accessStatus = 'deleted';
    user.accessReason = reason.trim();
    user.accessUpdatedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'User deleted/blocked by admin', data: user });
  } catch (err) {
    console.error('deleteUserByAdmin error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}


