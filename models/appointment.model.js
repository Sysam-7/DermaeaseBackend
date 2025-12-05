import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const appointmentSchema = new Schema({
  patientId: { type: Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: Types.ObjectId, ref: 'User', required: true },
  patientUsername: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }, // pending, approved, cancelled, etc.
  meta: { type: Schema.Types.Mixed },
}, { timestamps: true });

export default model('Appointment', appointmentSchema);



