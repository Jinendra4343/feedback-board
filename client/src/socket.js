import { io } from 'socket.io-client';
import { wsUrl } from './api.js';

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(wsUrl(), {
    auth: { token },
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
