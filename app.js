import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import localAuthRoutes from "./routes/auth.routes.js"; // <-- ADD THIS
import doctorsRoutes from './routes/doctors.js'; // <-- add this
import appointmentsRoutes from './routes/appointments.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/auth", authRoutes);       // Google OAuth (/auth/google, /auth/google/callback)
app.use("/auth", localAuthRoutes);  // Local auth (/auth/login, /auth/register, /auth/logout, /auth/verify-token)
app.use("/doctors", doctorsRoutes); // <-- mount doctors endpoint
app.use("/appointments", appointmentsRoutes); // <-- mount appointments endpoint
app.use("/admin", adminRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    project: "DermaEase",
    message: "DermaEase API running",
    status: "ok",
    env: process.env.NODE_ENV || "development",
  });
});

export default app;