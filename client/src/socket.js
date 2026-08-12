import { io } from 'socket.io-client';
import { wsUrl } from './api.js';
import { refreshAccessToken } from './auth.js';

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(wsUrl(), {
    auth: { token },
  });
  socket.on('connect_error', async (err) => {
    if (err.message === 'Invalid token') {
      const fresh = await refreshAccessToken();
      if (fresh && socket) {
        socket.auth = { token: fresh };
        socket.connect();
      }
    }
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
