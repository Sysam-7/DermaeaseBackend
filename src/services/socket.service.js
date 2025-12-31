import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

let io = null;

export function initializeSocket(server) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join', (room) => {
      try { if (room) socket.join(String(room)); } catch (e) { console.error('socket join error', e); }
    });
    socket.on('disconnect', () => {});
  });

  console.log('Socket.io initialized');
  return io;
}

// alias to match other code that used initSocket
export const initSocket = initializeSocket;

export function getIO() {
  if (!io) console.warn('Socket.io not initialized - call initializeSocket(server) first');
  return io;
}





