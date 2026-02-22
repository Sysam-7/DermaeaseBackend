import mongoose from 'mongoose';

const PrescriptionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: {
      disease: String,
      medicines: [
        new mongoose.Schema(
          {
            name: String,
            dosage: String,
            frequency: String,
            duration: String,
            notes: String
          },
          { _id: false }
        )
      ],
      notes: String
    },
    pdfLink: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model('Prescription', PrescriptionSchema);



