import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { createBoardSchema, commentSchema, statusSchema, validate } from '../validation.js';

const router = Router();
const uploadDir = process.env.UPLOAD_DIR || path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

const publicBoard = (board) => ({
  ...board,
  image_url: `/uploads/${path.basename(board.image_url)}`,
});

router.get('/', requireAuth, (req, res) => {
  const rows = req.user.role === 'designer'
    ? db.prepare('SELECT * FROM boards ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM boards WHERE client_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(publicBoard));
});

router.post('/', requireAuth, upload.single('image'), validate(createBoardSchema), (req, res) => {
  if (req.user.role !== 'designer') return res.status(403).json({ error: 'Only designers can create boards' });
  if (!req.file) return res.status(400).json({ error: 'An image is required' });

  const { title, clientEmail } = req.body;
  let clientId = null;
  if (clientEmail) {
    const client = db.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get(clientEmail, 'client');
    if (!client) return res.status(400).json({ error: 'Client not found' });
    clientId = client.id;
  }

  const info = db
    .prepare('INSERT INTO boards (title, image_url, designer_id, client_id) VALUES (?, ?, ?, ?)')
    .run(title || 'Untitled board', req.file.path, req.user.id, clientId);
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(publicBoard(board));
});

router.get('/:id/comments', requireAuth, (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canView(req.user, board)) return res.status(403).json({ error: 'Not allowed' });

  const rows = db
    .prepare(`SELECT c.*, u.name, u.role FROM comments c JOIN users u ON u.id = c.user_id
              WHERE c.board_id = ? ORDER BY c.created_at ASC, c.id ASC`)
    .all(req.params.id);
  res.json(rows);
});

router.post('/:id/comments', requireAuth, validate(commentSchema), (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canView(req.user, board)) return res.status(403).json({ error: 'Not allowed' });

  const { text, x, y } = req.body;
  const info = db
    .prepare('INSERT INTO comments (board_id, user_id, text, x, y) VALUES (?, ?, ?, ?, ?)')
    .run(board.id, req.user.id, String(text), Number(x), Number(y));
  const comment = db
    .prepare(`SELECT c.*, u.name, u.role FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`)
    .get(info.lastInsertRowid);

  req.app.get('io').to(`board:${board.id}`).emit('comment:new', { boardId: board.id, comment });
  res.status(201).json(comment);
});

router.patch('/:id/status', requireAuth, validate(statusSchema), (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (req.user.role !== 'designer') return res.status(403).json({ error: 'Only designers can change status' });

  const { status } = req.body;
  db.prepare('UPDATE boards SET status = ? WHERE id = ?').run(status, board.id);
  req.app.get('io').to(`board:${board.id}`).emit('status:change', { boardId: board.id, status });
  res.json({ id: board.id, status });
});

function canView(user, board) {
  if (user.role === 'designer') return true;
  return board.client_id === user.id;
}

export default router;
