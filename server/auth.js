import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import db from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, SECRET, { expiresIn: ACCESS_TTL });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signRefreshToken(user) {
  return jwt.sign({ id: user.id, jti: crypto.randomUUID() }, SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token', code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' });
  }
}

function storeRefresh(userId, token) {
  const decoded = verifyToken(token);
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, hashToken(token), new Date(decoded.exp * 1000).toISOString());
}

function revokeAllForUser(userId) {
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), userId);
}

export function rotateRefreshToken(oldToken) {
  const decoded = verifyToken(oldToken);
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(oldToken));

  if (!row || new Date(row.expires_at) < new Date()) {
    throw Object.assign(new Error('Refresh token invalid or expired'), { code: 'INVALID' });
  }

  if (row.revoked_at) {
    revokeAllForUser(decoded.id);
    throw Object.assign(new Error('Refresh token reuse detected — all sessions revoked'), { code: 'REUSED' });
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
  if (!user) throw Object.assign(new Error('User not found'), { code: 'INVALID' });

  const newToken = signRefreshToken(user);
  db.prepare('UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?')
    .run(new Date().toISOString(), newToken.split('.')[0], row.id);
  storeRefresh(user.id, newToken);

  return { accessToken: signAccessToken(user), refreshToken: newToken, user };
}

export function revokeRefreshToken(oldToken) {
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(oldToken));
  if (row && !row.revoked_at) {
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  }
}

export function issueTokenPair(user) {
  const refreshToken = signRefreshToken(user);
  storeRefresh(user.id, refreshToken);
  return { accessToken: signAccessToken(user), refreshToken };
}
