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
  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);
  assert.equal(data.user.role, 'client');
});

test('auth: refresh rotates tokens, old refresh token stops working', async () => {
  const { refreshToken: first } = await login(ctx.base, 'designer@demo.com');
  const res = await fetch(`${ctx.base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: first }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.accessToken);
  assert.notEqual(data.refreshToken, first);

  const reuse = await fetch(`${ctx.base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: first }),
  });
  assert.equal(reuse.status, 401);
  assert.equal((await reuse.json()).code, 'REUSED');
});

test('auth: refresh rejects garbage tokens', async () => {
  const res = await fetch(`${ctx.base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'bogus' }),
  });
  assert.equal(res.status, 403);
});

test('auth: logout revokes the refresh token', async () => {
  const { refreshToken } = await login(ctx.base, 'designer@demo.com');
  const out = await fetch(`${ctx.base}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(out.status, 204);

  const res = await fetch(`${ctx.base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'REUSED');
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
