import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

import User from './models/user.model.js';
import Appointment from './models/appointment.model.js';
import Review from './models/review.model.js';
import ChatMessage from './models/chat-message.model.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dermaease';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB:', mongoUri);

  await Promise.all([
    User.deleteMany({}),
    Appointment.deleteMany({}),
    Review.deleteMany({}),
    ChatMessage.deleteMany({})
  ]);

  const password = await bcrypt.hash('password123', 10);
  const adminPass = await bcrypt.hash('admin123', 10);

  const doctors = await User.insertMany([
    { name: 'Dr. Alice Skin', email: 'doctor1@example.com', password, role: 'doctor', specialty: 'Dermatology', location: 'City A', verified: true, rating: 4.5, availability: [] },
    { name: 'Dr. Bob Care', email: 'doctor2@example.com', password, role: 'doctor', specialty: 'Dermatology', location: 'City B', verified: true, rating: 4.0, availability: [] },
    { name: 'Dr. Carol Heal', email: 'doctor3@example.com', password, role: 'doctor', specialty: 'Cosmetology', location: 'City C', verified: false, rating: 0, availability: [] }
  ]);

  const patients = await User.insertMany([
    { name: 'Patient One', email: 'patient1@example.com', password, role: 'patient' },
    { name: 'Patient Two', email: 'patient2@example.com', password, role: 'patient' },
    { name: 'Patient Three', email: 'patient3@example.com', password, role: 'patient' },
    { name: 'Patient Four', email: 'patient4@example.com', password, role: 'patient' },
    { name: 'Patient Five', email: 'patient5@example.com', password, role: 'patient' }
  ]);

  const admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: adminPass, role: 'admin', verified: true });

  const now = new Date();
  const start1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const end1 = new Date(start1.getTime() + 30 * 60 * 1000);
  const start2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const end2 = new Date(start2.getTime() + 30 * 60 * 1000);

  await Appointment.insertMany([
    { doctorId: doctors[0]._id, patientId: patients[0]._id, start: start1, end: end1, status: 'approved' },
    { doctorId: doctors[1]._id, patientId: patients[1]._id, start: start2, end: end2, status: 'pending' }
  ]);

  await Review.insertMany([
    { doctorId: doctors[0]._id, patientId: patients[0]._id, rating: 5, text: 'Great consultation.' },
    { doctorId: doctors[0]._id, patientId: patients[1]._id, rating: 4, text: 'Very helpful.' }
  ]);

  await ChatMessage.insertMany([
    { senderId: patients[0]._id, receiverId: doctors[0]._id, message: 'Hello doctor!' },
    { senderId: doctors[0]._id, receiverId: patients[0]._id, message: 'Hi, how can I help?' }
  ]);

  console.log('Seed complete.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


