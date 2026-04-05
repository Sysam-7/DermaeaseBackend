import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.routes.js";
import doctorsRoutes from './routes/doctors.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import adminRoutes from './routes/admin.routes.js';
import usersRoutes from './routes/users.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import chatRoutes from './routes/chat.routes.js';
import prescriptionsRoutes from './routes/prescriptions.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import paymentsRoutes from './routes/payments.routes.js';

const app = express();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin?.includes(allowed))) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway in development, but log warning
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// MongoDB connection with error handling
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not set in environment variables");
  console.error("   Please set MONGO_URI in your .env file");
} else {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => {
      console.error("❌ MongoDB connection error:", err.message);
      console.error("   Please check your MONGO_URI and ensure MongoDB is running");
    });
}

// Routes - all routes are prefixed with /api
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/payments", paymentsRoutes);

// Legacy OAuth routes (without /api prefix) for backward compatibility
// This handles cases where Google Console is configured with /auth/google/callback
// IMPORTANT: Update Google Console to use: http://localhost:5000/api/auth/google/callback
app.get("/auth/google/callback", (req, res) => {
  console.log("⚠️  Legacy OAuth callback route used. Redirecting to /api/auth/google/callback");
  // Redirect to the correct /api/auth/google/callback route
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/auth/google/callback${queryString ? '?' + queryString : ''}`);
});

// Also handle the initial OAuth route without /api prefix
app.get("/auth/google", (req, res) => {
  console.log("⚠️  Legacy OAuth route used. Redirecting to /api/auth/google");
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/auth/google${queryString ? '?' + queryString : ''}`);
});

// Root endpoint - Health check
app.get("/", (req, res) => {
  res.json({
    project: "DermaEase",
    message: "DermaEase API running",
    status: "ok",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      doctors: "/api/doctors",
      appointments: "/api/appointments"
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default app;