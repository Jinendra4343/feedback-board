import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, login, createBoard, addComment, setStatus, auth } from './helpers.js';

let ctx;
let designerToken;
let clientToken;
let boardId;

before(async () => {
  ctx = await startTestServer();
  ({ token: designerToken } = await login(ctx.base, 'designer@demo.com'));
  ({ token: clientToken } = await login(ctx.base, 'client@demo.com'));
  ({ board: { id: boardId } } = await createBoard(ctx.base, designerToken, { clientEmail: 'client@demo.com' }));
});

after(() => ctx.close());

test('comments: client adds a comment with pin coordinates', async () => {
  const { comment, res } = await addComment(ctx.base, clientToken, boardId, {
    text: 'Make the CTA bigger',
    x: 42.5,
    y: 63.25,
  });
  assert.equal(res.status, 201);
  assert.equal(comment.text, 'Make the CTA bigger');
  assert.equal(comment.x, 42.5);
  assert.equal(comment.y, 63.25);
  assert.equal(comment.role, 'client');
});

test('comments: designer can comment on their own board', async () => {
  const { res } = await addComment(ctx.base, designerToken, boardId, { text: 'Noted, will fix' });
  assert.equal(res.status, 201);
});

test('comments: reject missing text or coordinates', async () => {
  const r1 = await addComment(ctx.base, clientToken, boardId, { text: '' });
  assert.equal(r1.res.status, 400);

  const r2 = await addComment(ctx.base, clientToken, boardId, { x: 10, y: undefined });
  assert.equal(r2.res.status, 400);
});

test('comments: client cannot comment on a board not shared with them', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Other board' });
  const { res } = await addComment(ctx.base, clientToken, board.id);
  assert.equal(res.status, 403);
});

test('comments: list returns comments with author info, oldest first', async () => {
  await addComment(ctx.base, clientToken, boardId, { text: 'First pin', x: 1, y: 1 });
  await addComment(ctx.base, clientToken, boardId, { text: 'Second pin', x: 2, y: 2 });

  const res = await fetch(`${ctx.base}/api/boards/${boardId}/comments`, { headers: auth(designerToken) });
  const comments = await res.json();
  assert.equal(res.status, 200);
  assert.ok(comments.length >= 4);
  assert.deepEqual(comments.map((c) => c.text), ['Make the CTA bigger', 'Noted, will fix', 'First pin', 'Second pin']);
  for (const c of comments) {
    assert.ok(c.name, 'comment carries author name');
    assert.ok(['client', 'designer'].includes(c.role), 'comment carries author role');
  }
});

test('comments: unknown board returns 404', async () => {
  const { res } = await addComment(ctx.base, clientToken, 99999);
  assert.equal(res.status, 404);
});
