import dotenv from "dotenv";
dotenv.config();

import http from "http";

import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { initializeSocket } from "./services/socket.service.js";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// initialize socket.io (initializeSocket is synchronous — use try/catch instead of .catch)
try {
  initializeSocket(server);
} catch (err) {
  console.error('initSocket error', err);
}

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/`);
  console.log(`✅ API base: http://localhost:${PORT}/api`);
  
  // Validate critical environment variables
  const required = ['MONGO_URI', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
  }
  
  const oauthRequired = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const oauthMissing = oauthRequired.filter(key => !process.env[key]);
  if (oauthMissing.length > 0) {
    console.warn(`⚠️  Google OAuth not configured: ${oauthMissing.join(', ')}`);
  } else {
    console.log(`✅ Google OAuth configured`);
  }
  
  // Check SMTP configuration
  const smtpRequired = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const smtpMissing = smtpRequired.filter(key => !process.env[key]);
  if (smtpMissing.length > 0) {
    console.warn(`⚠️  SMTP not configured. Missing: ${smtpMissing.join(', ')}`);
    console.warn(`⚠️  Emails will be logged to console instead of being sent.`);
  } else {
    console.log(`✅ SMTP configured (Host: ${process.env.SMTP_HOST}, Port: ${process.env.SMTP_PORT || 587})`);
  }
});