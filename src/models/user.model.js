// models/user.model.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String }, // Not required for Google OAuth users
  googleId: { type: String, sparse: true, unique: true }, // For Google OAuth
  role: { type: String, default: 'patient' },
  specialty: { type: String },
  location: { type: String },
  bio: { type: String },
  profilePic: { type: String },
  rating: { type: Number },
  reviews: { type: Array, default: [] },
  verified: { type: Boolean, default: false },
  // Working hours for doctors (in 24-hour format, e.g., "07:00", "16:00")
  workingHoursStart: { type: String }, // e.g., "07:00"
  workingHoursEnd: { type: String }, // e.g., "16:00"
  // Working days for doctors (array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday)
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Default: Monday to Friday

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

export default model('User', userSchema);

