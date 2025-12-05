import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';

describe('Booking', () => {
  let doctor, patient, token;
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dermaease_test');
    await Promise.all([User.deleteMany({}), Appointment.deleteMany({})]);
    doctor = await User.create({ name: 'D', email: 'd@test.com', password: 'x', role: 'doctor', verified: true });
    patient = await User.create({ name: 'P', email: 'p@test.com', password: 'x', role: 'patient' });
    const loginRes = await request(app).post('/api/auth/register').send({ name: 'P2', email: 'p2@test.com', password: 'pass', role: 'patient' });
    const loginRes2 = await request(app).post('/api/auth/login').send({ email: 'p2@test.com', password: 'pass' });
    token = loginRes2.body.data.token;
  });
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('prevents double booking for the same doctor slot', async () => {
    const start = new Date(Date.now() + 3600_000).toISOString();
    const end = new Date(Date.now() + 7200_000).toISOString();
    const r1 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: doctor._id.toString(), start, end });
    expect(r1.body.success).toBe(true);
    const r2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: doctor._id.toString(), start, end });
    expect(r2.body.success).toBe(false);
  });
});


