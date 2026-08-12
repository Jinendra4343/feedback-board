import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, login } from './helpers.js';

let ctx;

before(async () => {
  ctx = await startTestServer();
});

after(() => ctx.close());

test('register: creates a client account and returns a token', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Client', email: 'newclient@test.com', password: 'secret123', role: 'client' }),
  });
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.ok(data.token);
  assert.equal(data.user.role, 'client');
});

test('register: rejects duplicate emails', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup', email: 'newclient@test.com', password: 'secret123' }),
  });
  assert.equal(res.status, 409);
});

test('register: requires name, email and password', async () => {
  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@test.com' }),
  });
  assert.equal(res.status, 400);
});

test('login: succeeds with seeded demo designer', async () => {
  const { res, user } = await login(ctx.base, 'designer@demo.com');
  assert.equal(res.status, 200);
  assert.equal(user.role, 'designer');
});

test('login: rejects wrong password', async () => {
  const res = await fetch(`${ctx.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'designer@demo.com', password: 'wrong' }),
  });
  assert.equal(res.status, 401);
});

test('protected routes: reject requests without a token', async () => {
  const res = await fetch(`${ctx.base}/api/boards`);
  assert.equal(res.status, 401);
});

test('protected routes: reject tampered tokens', async () => {
  const res = await fetch(`${ctx.base}/api/boards`, { headers: { Authorization: 'Bearer not.a.jwt' } });
  assert.equal(res.status, 401);
});
