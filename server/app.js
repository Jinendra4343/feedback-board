import express from 'express';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import { MulterError } from 'multer';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import db from './db.js';
import { verifyToken } from './auth.js';
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';

export function createApp() {
  const app = express();
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  app.use(helmet());
  app.use(cors());
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
  app.use('/api/auth/refresh', refreshLimiter);

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

  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image too large (max 10MB)' });
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Only image files are allowed') return res.status(400).json({ error: err.message });
    req.log.error({ err }, 'unhandled error');
    return res.status(500).json({ error: 'Internal server error' });
  });

  return { app, server, io, logger };
}
