// models/user.model.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'patient' },
  specialty: { type: String },
  location: { type: String },
  bio: { type: String },
  profilePic: { type: String },
  rating: { type: Number },
  reviews: { type: Array, default: [] },
  verified: { type: Boolean, default: false },

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

export default model('User', userSchema);

