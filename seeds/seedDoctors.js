import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';

const doctors = [
  {
    name: 'Dr. Sarah Khan',
    email: 'sarah.khan@example.com',
    password: 'password123',
    role: 'doctor',
    specialty: 'Dermatology',
    location: 'London, UK',
    bio: 'Board-certified dermatologist with 10+ years treating acne, eczema and skin cosmetic issues.',
    profilePic: '/Images/doctors/doctor1.jpg',
    rating: 4.8,
    reviews: [{ author: 'Alice', comment: 'Excellent care!' }]
  },
  {
    name: 'Dr. Michael Rivers',
    email: 'michael.rivers@example.com',
    password: 'password123',
    role: 'doctor',
    specialty: 'Dermatology',
    location: 'New York, USA',
    bio: 'Specialist in skin surgery and mole evaluations. Author of multiple dermatology papers.',
    profilePic: '/Images/doctors/doctor2.jpg',
    rating: 4.7
  },
  {
    name: 'Dr. Priya Mehra',
    email: 'priya.mehra@example.com',
    password: 'password123',
    role: 'doctor',
    specialty: 'Dermatology',
    location: 'Mumbai, India',
    bio: 'Dermatology consultant specializing in pediatric dermatology and hair disorders.',
    profilePic: '/Images/doctors/doctor3.jpg',
    rating: 4.9
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  for (const d of doctors) {
    const exists = await User.findOne({ email: d.email });
    if (exists) {
      console.log('Already exists:', d.email);
      continue;
    }
    const hashed = await bcrypt.hash(d.password, 10);
    const user = new User({
      name: d.name,
      email: d.email,
      password: hashed,
      role: d.role,
      specialty: d.specialty,
      location: d.location,
      bio: d.bio,
      profilePic: d.profilePic,
      rating: d.rating,
      reviews: d.reviews || []
    });
    await user.save();
    console.log('Created:', d.email);
  }

  await mongoose.connection.close();
  console.log('Seed finished');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});