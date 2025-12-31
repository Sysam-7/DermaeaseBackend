import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

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

export async function createAdmin(req, res) {
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


