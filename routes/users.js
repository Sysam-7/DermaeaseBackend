import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    name: String,
    email: { type: String, lowercase: true, unique: true },
    password: { type: String }, // Only for manual login
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);

