// models/otp.model.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const otpSchema = new Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  googleId: { type: String }, // Store Google ID for OAuth users
  name: { type: String }, // Store name from Google profile
  role: { type: String, default: 'patient' }, // Store role preference
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Auto-delete after expiration
  verified: { type: Boolean, default: false },
}, { timestamps: true });

// Create index for faster lookups
otpSchema.index({ email: 1, verified: 1 });

export default model('OTP', otpSchema);

