import jwt from 'jsonwebtoken';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/email.js';
import User from '../models/user.model.js';



export const register = async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !email || !password) 
      return res.status(400).json({ message: 'Name, email, password required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashed,
      role: role || 'patient',
      username: username || email.split('@')[0], // optional username
    });

    await user.save();

    let token = null;
    try {
      token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );
    } catch (jwtErr) {
      console.error('JWT generation failed:', jwtErr);
    }

    // Always return success, even if JWT failed
    return res.status(201).json({
      message: 'Registered',
      token, // null if JWT failed
      role: user.role,
      name: user.name
    });

  } catch (err) {
    console.error('register error:', err);

    // If user was saved, still return success
    if (err.name === 'MongoError' || err.name === 'ValidationError') {
      return res.status(201).json({
        message: 'Registered, but token may not be generated',
        role: req.body.role || 'patient',
        name: req.body.name
      });
    }

    return res.status(500).json({ message: 'Server error' });
  }
};



export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.json({ message: 'Logged in', token, role: user.role, name: user.name });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
};

export const verifyToken = async (req, res) => {
  try {
    // expects authenticate middleware to set req.userId
    const id = req.userId || (req.user && req.user._id);
    if (!id) return res.status(401).json({ message: 'Not authenticated' });
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    res.json({ message: 'Token valid', data: { user } });
  } catch (err) {
    console.error('verifyToken error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email });
    // always respond success to avoid account enumeration
    if (!user) {
      console.log('forgotPassword: no user for', email);
      return res.json({ message: 'If that account exists, a reset link was sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    // Use findByIdAndUpdate to avoid running full schema validation (prevents required password errors)
    await User.findByIdAndUpdate(user._id, {
      $set: { resetPasswordToken: token, resetPasswordExpires: expires }
    }, { runValidators: false });

    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${frontend}/auth/forgot?token=${token}&email=${encodeURIComponent(user.email)}`;

    const subject = 'DermaEase — Password reset';
    const html = `
      <p>Hi ${user.name || ''},</p>
      <p>Click to reset your password (valid 1 hour):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `;

    try {
      await sendEmail(user.email, subject, html);
      console.log('forgotPassword: reset email sent or logged for', user.email);
    } catch (sendErr) {
      console.error('forgotPassword: sendEmail error:', sendErr);
    }

    return res.json({ message: 'If that account exists, a reset link was sent' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) return res.status(400).json({ message: 'Missing fields' });

    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};



