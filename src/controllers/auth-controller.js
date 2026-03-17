import jwt from 'jsonwebtoken';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/email.js';
import User from '../models/user.model.js';
import OTP from '../models/otp.model.js';



export const register = async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }

    // Check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashed,
      role: role || 'patient',
      username: username || email.split('@')[0], // optional username
    });

    await user.save();

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('⚠️  JWT_SECRET not set in environment variables');
      return res.status(500).json({ 
        success: false,
        message: 'Server configuration error' 
      });
    }

    let token = null;
    try {
      token = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    } catch (jwtErr) {
      console.error('JWT generation failed:', jwtErr);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to generate authentication token' 
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      role: user.role,
      name: user.name
    });

  } catch (err) {
    console.error('register error:', err);

    // Handle duplicate email error
    if (err.code === 11000 || err.name === 'MongoServerError') {
      return res.status(400).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: err.message || 'Validation error' 
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
};



export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('⚠️  JWT_SECRET not set in environment variables');
      return res.status(500).json({ 
        success: false,
        message: 'Server configuration error' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check if user has a password (OAuth users might not)
    if (!user.password) {
      return res.status(401).json({ 
        success: false,
        message: 'This account was created with Google. Please sign in with Google.' 
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ 
      success: true,
      message: 'Login successful', 
      token, 
      role: user.role, 
      name: user.name 
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
};

export const verifyToken = async (req, res) => {
  try {
    // authenticate middleware sets req.user
    const id = req.user?._id || req.user?.id;
    if (!id) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    return res.json({ 
      success: true,
      message: 'Token valid', 
      data: { user } 
    });
  } catch (err) {
    console.error('verifyToken error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
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

// Generate and send 6-digit OTP for Google OAuth registration
export const sendGoogleOTP = async (email, googleId, name, role = 'patient') => {
  try {
    console.log(`📝 Generating OTP for: ${email}, role: ${role}`);
    
    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔑 Generated OTP: ${otpCode} for ${email}`);
    
    // Delete any existing unverified OTPs for this email
    const deletedCount = await OTP.deleteMany({ email, verified: false });
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing OTPs for ${email}`);
    
    // Create new OTP (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OTP.create({
      email,
      otp: otpCode,
      googleId,
      name,
      role,
      expiresAt,
    });
    console.log(`✅ OTP record created in database for ${email}, expires at: ${expiresAt}`);

    const subject = 'DermaEase — Verify Your Email';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">DermaEase Email Verification</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Here is your 6-digit code to verify your DermaEase account:</p>
        <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #6B7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    console.log(`📧 Attempting to send OTP email to ${email}...`);
    try {
      await sendEmail(email, subject, html);
      console.log('sendGoogleOTP: OTP email sent or logged for', email);
    } catch (sendErr) {
      console.error('sendGoogleOTP: sendEmail error:', sendErr);
    }

    return otpCode;
  } catch (err) {
    console.error('❌ sendGoogleOTP error:', err);
    console.error('❌ Error details:', {
      message: err.message,
      stack: err.stack,
      email,
      googleId,
      name,
      role
    });
    throw err;
  }
};

// Verify OTP for Google OAuth registration (POST from VerifyOTP page)
export const verifyGoogleOTP = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user with Google OAuth data
      user = await User.create({
        googleId: otpRecord.googleId,
        name: otpRecord.name || 'User',
        email: otpRecord.email,
        role: otpRecord.role || 'patient',
        password: undefined, // No password for OAuth users
        verified: true, // Email verified via OTP
      });
    } else {
      // Link Google account to existing user
      if (!user.googleId) {
        user.googleId = otpRecord.googleId;
      }
      if (!user.name && otpRecord.name) {
        user.name = otpRecord.name;
      }
      user.verified = true;
      await user.save();
    }

    // Mark OTP as verified & delete it
    otpRecord.verified = true;
    await otpRecord.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      role: user.role,
      name: user.name
    });
  } catch (err) {
    console.error('verifyGoogleOTP error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during OTP verification'
    });
  }
};

// Resend OTP
export const resendGoogleOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find existing unverified OTP
    const existingOTP = await OTP.findOne({
      email,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!existingOTP) {
      return res.status(400).json({
        success: false,
        message: 'No pending OTP found. Please register again.'
      });
    }

    const subject = 'DermaEase — Verify Your Email';
    const html = `
      <p>Hi ${existingOTP.name || 'there'},</p>
      <p>Here is your 6-digit code to verify your DermaEase account:</p>
      <p style="font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; padding: 20px; background-color: #F3F4F6; border-radius: 8px; margin: 20px 0;">${existingOTP.otp}</p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    await sendEmail(email, subject, html);
    console.log(`OTP resent to ${email}`);

    return res.json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (err) {
    console.error('resendGoogleOTP error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while resending OTP'
    });
  }
};



