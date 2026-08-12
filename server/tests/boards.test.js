import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, login, createBoard, auth } from './helpers.js';

let ctx;
let designerToken;
let clientToken;
let otherClientToken;

before(async () => {
  ctx = await startTestServer();
  ({ token: designerToken } = await login(ctx.base, 'designer@demo.com'));
  ({ token: clientToken } = await login(ctx.base, 'client@demo.com'));

  const res = await fetch(`${ctx.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Other Client', email: 'other@test.com', password: 'password123' }),
  });
  ({ accessToken: otherClientToken } = await res.json());
});

after(() => ctx.close());

test('boards: clients cannot create boards', async () => {
  const { res } = await createBoard(ctx.base, clientToken);
  assert.equal(res.status, 403);
});

test('boards: designer creates a board shared with a client', async () => {
  const { board, res } = await createBoard(ctx.base, designerToken, {
    title: 'Homepage mockup',
    clientEmail: 'client@demo.com',
  });
  assert.equal(res.status, 201);
  assert.equal(board.title, 'Homepage mockup');
  assert.equal(board.status, 'pending');
  assert.ok(board.image_url.startsWith('/uploads/'));
});

test('boards: rejects unknown client email', async () => {
  const { res } = await createBoard(ctx.base, designerToken, { clientEmail: 'nobody@test.com' });
  assert.equal(res.status, 400);
});

test('boards: requires an image', async () => {
  const form = new FormData();
  form.append('title', 'No image board');
  const res = await fetch(`${ctx.base}/api/boards`, { method: 'POST', headers: auth(designerToken), body: form });
  assert.equal(res.status, 400);
});

test('boards: clients only see boards shared with them', async () => {
  await createBoard(ctx.base, designerToken, { title: 'Board for Other', clientEmail: 'other@test.com' });
  await createBoard(ctx.base, designerToken, { title: 'Board for Demo Client', clientEmail: 'client@demo.com' });

  const designerRes = await fetch(`${ctx.base}/api/boards`, { headers: auth(designerToken) });
  const designerBoards = await designerRes.json();

  const clientRes = await fetch(`${ctx.base}/api/boards`, { headers: auth(clientToken) });
  const clientBoards = await clientRes.json();

  const otherRes = await fetch(`${ctx.base}/api/boards`, { headers: auth(otherClientToken) });
  const otherBoards = await otherRes.json();

  assert.ok(designerBoards.length >= 3, 'designer sees all boards');
  assert.deepEqual(clientBoards.map((b) => b.title), ['Board for Demo Client', 'Homepage mockup']);
  assert.deepEqual(otherBoards.map((b) => b.title), ['Board for Other']);
  assert.ok(!clientBoards.some((b) => b.title === 'Board for Other'), 'client never sees other clients\' boards');
});

test('boards: clients cannot change status', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Status test' });
  const res = await fetch(`${ctx.base}/api/boards/${board.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(clientToken) },
    body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(res.status, 403);
});

test('boards: designer can move status pending -> in_review -> approved', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Workflow test' });

  const r1 = await fetch(`${ctx.base}/api/boards/${board.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(designerToken) },
    body: JSON.stringify({ status: 'in_review' }),
  });
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).status, 'in_review');

  const r2 = await fetch(`${ctx.base}/api/boards/${board.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(designerToken) },
    body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).status, 'approved');
});

test('boards: rejects invalid status values', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Invalid status' });
  const res = await fetch(`${ctx.base}/api/boards/${board.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(designerToken) },
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert.equal(res.status, 400);
});

test('boards: designer can create a board without sharing (unlisted for clients)', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Private board' });
  const clientBoards = await (await fetch(`${ctx.base}/api/boards`, { headers: auth(clientToken) })).json();
  assert.ok(!clientBoards.some((b) => b.id === board.id));
});
