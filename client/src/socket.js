import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io({
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
