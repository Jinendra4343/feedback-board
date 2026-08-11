import express from 'express';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import { Server } from 'socket.io';
import db from './db.js';
import { verifyToken } from './auth.js';
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing token'));
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { role, id } = socket.user;

  const boards = role === 'designer'
    ? db.prepare('SELECT id FROM boards').all()
    : db.prepare('SELECT id FROM boards WHERE client_id = ?').all(id);

  for (const b of boards) socket.join(`board:${b.id}`);
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
