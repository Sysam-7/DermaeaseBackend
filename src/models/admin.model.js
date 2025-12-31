import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const adminSchema = new Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default model('Admin', adminSchema);


