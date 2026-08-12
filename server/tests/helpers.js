import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function startTestServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');
  process.env.JWT_SECRET = 'test-secret';
  process.env.LOG_LEVEL = 'silent';

  const { createApp } = await import('../app.js');
  const { app, server, io } = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    server,
    io,
    tmpDir,
    async close() {
      io.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
}

export async function login(base, email, password = 'password123') {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { token: data.accessToken, refreshToken: data.refreshToken, user: data.user, res };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function createBoard(base, token, fields = {}) {
  const form = new FormData();
  form.append('title', fields.title || 'Test board');
  form.append('image', new Blob([Buffer.from('fake-image')], { type: 'image/png' }), 'test.png');
  if (fields.clientEmail) form.append('clientEmail', fields.clientEmail);
  const res = await fetch(`${base}/api/boards`, { method: 'POST', headers: auth(token), body: form });
  return { board: await res.json(), res };
}

export async function addComment(base, token, boardId, body = {}) {
  const res = await fetch(`${base}/api/boards/${boardId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ text: 'Looks good', x: 10, y: 20, ...body }),
  });
  return { comment: await res.json(), res };
}

export async function setStatus(base, token, boardId, status) {
  const res = await fetch(`${base}/api/boards/${boardId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ status }),
  });
  return { data: await res.json(), res };
}
