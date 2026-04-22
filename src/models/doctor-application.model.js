import mongoose from 'mongoose';

const doctorApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    licenseNumber: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    medicalLicensePath: { type: String, required: true },
    degreeCertificatePath: { type: String, required: true },
    idDocumentPath: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewNotes: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('DoctorApplication', doctorApplicationSchema);
