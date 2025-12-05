import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'secret';

export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Admin token required' });
    }

    const payload = jwt.verify(token, ADMIN_SECRET);
    const admin = await Admin.findById(payload.adminId).lean();
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(401).json({ message: 'Invalid admin token' });
  }
}

export default requireAdmin;


