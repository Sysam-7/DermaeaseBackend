import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model('Review', ReviewSchema);





