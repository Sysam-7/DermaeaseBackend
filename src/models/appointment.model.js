import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const appointmentSchema = new Schema({
  patientId: { type: Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true }, // Appointment date
  time: { type: String, required: true }, // Appointment time (e.g., "14:30")
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending' 
  },
  // Legacy fields for backward compatibility
  patientUsername: { type: String },
  start: { type: Date }, // For time range bookings
  end: { type: Date }, // For time range bookings
  meta: { type: Schema.Types.Mixed },
}, { timestamps: true });

// Indexes for better query performance
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ doctorId: 1, date: 1, time: 1 }); // For conflict checking
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ status: 1 });

export default model('Appointment', appointmentSchema);



