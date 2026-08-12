import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || 'feedback.db';
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('designer', 'client')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    image_url   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved')),
    designer_id INTEGER NOT NULL REFERENCES users(id),
    client_id   INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id   INTEGER NOT NULL REFERENCES boards(id),
    user_id    INTEGER NOT NULL REFERENCES users(id),
    text       TEXT NOT NULL,
    x          REAL NOT NULL,
    y          REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_board ON comments(board_id);

  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id   INTEGER NOT NULL REFERENCES boards(id),
    user_id    INTEGER NOT NULL REFERENCES users(id),
    action     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_boards_client ON boards(client_id);
  CREATE INDEX IF NOT EXISTS idx_boards_designer ON boards(designer_id);
  CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_board ON activity(board_id, id);
  CREATE INDEX IF NOT EXISTS idx_comments_board_id ON comments(board_id, id);
`);

const hashed = bcrypt.hashSync('password123', 10);
db.exec(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES
    ('Demo Designer', 'designer@demo.com', '${hashed}', 'designer'),
    ('Demo Client', 'client@demo.com', '${hashed}', 'client');
`);

export default db;

