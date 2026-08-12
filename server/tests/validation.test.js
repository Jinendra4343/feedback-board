import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, login, createBoard, addComment, auth } from './helpers.js';

let ctx;
let designerToken;

before(async () => {
  ctx = await startTestServer();
  ({ token: designerToken } = await login(ctx.base, 'designer@demo.com'));
});

after(() => ctx.close());

test('validation: register rejects invalid email format', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'not-an-email', password: 'password123' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Invalid email address');
});

test('validation: register rejects short passwords', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'a@b.com', password: 'short' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Password must be at least 8 characters');
});

test('validation: register rejects unknown roles', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'a@b.com', password: 'password123', role: 'admin' }),
  });
  assert.equal(res.status, 400);
});

test('validation: login rejects malformed email', async () => {
  const res = await fetch(`${ctx.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nope', password: 'password123' }),
  });
  assert.equal(res.status, 400);
});

test('validation: comment rejects pins outside the design (0-100%)', async () => {
  const { board } = await createBoard(ctx.base, designerToken, {});
  const { comment, res } = await addComment(ctx.base, designerToken, board.id, { x: 150, y: 50 });
  assert.equal(res.status, 400);
  assert.equal(comment.error, 'Pin must be inside the design');
});

test('validation: comment rejects negative coordinates', async () => {
  const { board } = await createBoard(ctx.base, designerToken, {});
  const { res } = await addComment(ctx.base, designerToken, board.id, { x: -5, y: 50 });
  assert.equal(res.status, 400);
});

test('validation: comment rejects non-numeric coordinates', async () => {
  const { board } = await createBoard(ctx.base, designerToken, {});
  const { res } = await addComment(ctx.base, designerToken, board.id, { x: 'left', y: 50 });
  assert.equal(res.status, 400);
});

test('validation: comment rejects oversized text', async () => {
  const { board } = await createBoard(ctx.base, designerToken, {});
  const { res } = await addComment(ctx.base, designerToken, board.id, { text: 'x'.repeat(2001) });
  assert.equal(res.status, 400);
});

test('validation: board rejects oversized titles', async () => {
  const form = new FormData();
  form.append('title', 'x'.repeat(121));
  form.append('image', new Blob([Buffer.from('img')], { type: 'image/png' }), 't.png');
  const res = await fetch(`${ctx.base}/api/boards`, { method: 'POST', headers: auth(designerToken), body: form });
  assert.equal(res.status, 400);
});

test('validation: board rejects non-image uploads', async () => {
  const form = new FormData();
  form.append('title', 'Bad file');
  form.append('image', new Blob([Buffer.from('#!/bin/sh')], { type: 'application/x-sh' }), 'evil.sh');
  const res = await fetch(`${ctx.base}/api/boards`, { method: 'POST', headers: auth(designerToken), body: form });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Only image files are allowed');
});

test('validation: malformed JSON body returns 400, not 500', async () => {
  const res = await fetch(`${ctx.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Invalid JSON body');
});

test('validation: unknown api path returns a clean 404', async () => {
  const res = await fetch(`${ctx.base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});
