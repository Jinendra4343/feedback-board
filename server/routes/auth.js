import { Router } from 'express';
import db from '../db.js';
import { hashPassword, verifyPassword, issueTokenPair, rotateRefreshToken, revokeRefreshToken } from '../auth.js';
import { registerSchema, loginSchema, validate } from '../validation.js';

const router = Router();

router.post('/register', validate(registerSchema), (req, res) => {
  const { name, email, password, role } = req.body;

  const userRole = role === 'designer' ? 'designer' : 'client';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hashPassword(password), userRole);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...issueTokenPair(user), user });
});

router.post('/login', validate(loginSchema), (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ ...issueTokenPair(safeUser), user: safeUser });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  try {
    const pair = rotateRefreshToken(refreshToken);
    res.json(pair);
  } catch (err) {
    const status = err.code === 'REUSED' ? 401 : 403;
    return res.status(status).json({ error: err.message, code: err.code || 'INVALID_REFRESH' });
  }
});

router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) revokeRefreshToken(refreshToken);
  res.status(204).end();
});

export default router;
