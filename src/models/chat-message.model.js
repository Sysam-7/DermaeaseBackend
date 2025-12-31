import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    attachmentUrl: { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

ChatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

export default mongoose.model('ChatMessage', ChatMessageSchema);



