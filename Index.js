import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import session from "express-session";
import passport from "./config/passport.js";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import localAuthRoutes from "./routes/auth.routes.js";
import appRoutes from "./app.js"; // if app.js exports an express app or router

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dermaease";
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";

async function start() {
  try {
    console.log("Connecting to MongoDB...", MONGO_URI);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");

    const app = express();

    app.use(cookieParser());
    app.use(cors({ origin: FRONTEND, credentials: true }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
      session({
        secret: process.env.SESSION_SECRET || "default_session_secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Mount your routes (ensure these files exist and export a router)
    app.use("/auth", authRoutes);
    app.use("/auth", localAuthRoutes);

    // If you have an app.js that exports routers or middleware, attach it:
    // app.use(appRoutes);

    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    // Exit process so you can see failure and fix env / mongo
    process.exit(1);
  }
}

start();