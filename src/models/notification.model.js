import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
    relatedData: { type: mongoose.Schema.Types.Mixed } // Store additional context (e.g., patient/doctor name, status)
  },
  { timestamps: true }
);

export default mongoose.model('Notification', NotificationSchema);



