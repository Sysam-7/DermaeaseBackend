import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';

describe('Auth', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dermaease_test');
    await User.deleteMany({ email: /test@example.com/ });
  });
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('registers and logs in', async () => {
    const email = 'authtest@example.com';
    await request(app).post('/api/auth/register').send({ name: 'T', email, password: 'pass', role: 'patient' }).expect(200);
    const res = await request(app).post('/api/auth/login').send({ email, password: 'pass' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
  });
});


