import mongoose from 'mongoose';

const SmsLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('SmsLog', SmsLogSchema);



