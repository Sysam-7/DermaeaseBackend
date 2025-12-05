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
  console.log(`Server running on port ${PORT}`);
});