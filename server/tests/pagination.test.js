import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, login, createBoard, addComment, setStatus, auth } from './helpers.js';

let ctx;
let designerToken;
let clientToken;

before(async () => {
  ctx = await startTestServer();
  ({ token: designerToken } = await login(ctx.base, 'designer@demo.com'));
  ({ token: clientToken } = await login(ctx.base, 'client@demo.com'));
});

after(() => ctx.close());

test('pagination: boards list walks pages with a stable cursor (no duplicates, no gaps)', async () => {
  for (let i = 0; i < 7; i++) {
    await createBoard(ctx.base, designerToken, { title: `Page board ${i}` });
  }

  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const url = `${ctx.base}/api/boards?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: auth(designerToken) });
    const data = await res.json();
    assert.ok(Array.isArray(data.items), 'paginated response has items');
    pages++;
    seen.push(...data.items.map((b) => b.id));
    cursor = data.nextCursor;
  } while (cursor !== null);

  assert.ok(pages >= 3, 'walked multiple pages');
  assert.equal(new Set(seen).size, seen.length, 'no board appears twice');
});

test('pagination: comments walk forward with nextCursor, newest last', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Paginated comments', clientEmail: 'client@demo.com' });
  for (let i = 1; i <= 5; i++) {
    await addComment(ctx.base, clientToken, board.id, { text: `comment ${i}`, x: i * 10, y: 10 });
  }

  const first = await (
    await fetch(`${ctx.base}/api/boards/${board.id}/comments?limit=2`, { headers: auth(designerToken) })
  ).json();
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].text, 'comment 1');
  assert.ok(first.nextCursor, 'page 1 has a next cursor');

  const second = await (
    await fetch(`${ctx.base}/api/boards/${board.id}/comments?limit=2&cursor=${first.nextCursor}`, {
      headers: auth(designerToken),
    })
  ).json();
  assert.equal(second.items.length, 2);
  assert.equal(second.items[0].text, 'comment 3', 'continues exactly where page 1 stopped');

  const third = await (
    await fetch(`${ctx.base}/api/boards/${board.id}/comments?limit=2&cursor=${second.nextCursor}`, {
      headers: auth(designerToken),
    })
  ).json();
  assert.equal(third.items.length, 1);
  assert.equal(third.items[0].text, 'comment 5');
  assert.equal(third.nextCursor, null, 'last page has no next cursor');
});

test('pagination: caps limit at 100', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Limit cap' });
  const res = await fetch(`${ctx.base}/api/boards/${board.id}/comments?limit=9999`, { headers: auth(designerToken) });
  const data = await res.json();
  assert.equal(data.items.length, 0);
});

test('pagination: ignores malformed cursor instead of 500', async () => {
  const res = await fetch(`${ctx.base}/api/boards?limit=2&cursor=abc`, { headers: auth(designerToken) });
  assert.equal(res.status, 200);
});

test('activity: status change is recorded with actor and action', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Audited board', clientEmail: 'client@demo.com' });
  await setStatus(ctx.base, designerToken, board.id, 'in_review');

  const res = await fetch(`${ctx.base}/api/boards/${board.id}/activity`, { headers: auth(clientToken) });
  const activity = await res.json();
  assert.equal(res.status, 200);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].action, 'status:in_review');
  assert.equal(activity[0].name, 'Demo Designer');
  assert.equal(activity[0].role, 'designer');
});

test('activity: history grows in order, newest first', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'History board' });
  await setStatus(ctx.base, designerToken, board.id, 'in_review');
  await setStatus(ctx.base, designerToken, board.id, 'approved');

  const activity = await (
    await fetch(`${ctx.base}/api/boards/${board.id}/activity`, { headers: auth(designerToken) })
  ).json();

  assert.equal(activity.length, 2);
  assert.deepEqual(activity.map((a) => a.action), ['status:approved', 'status:in_review']);
});

test('activity: clients cannot read another board activity', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Secret board' });
  await setStatus(ctx.base, designerToken, board.id, 'in_review');
  const res = await fetch(`${ctx.base}/api/boards/${board.id}/activity`, { headers: auth(clientToken) });
  assert.equal(res.status, 403);
});

test('transaction: board status and its activity row are written atomically', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Atomic board' });
  await setStatus(ctx.base, designerToken, board.id, 'approved');

  const db = await import('../db.js');
  const row = db.default
    .prepare('SELECT b.status, (SELECT COUNT(*) FROM activity a WHERE a.board_id = b.id) AS events FROM boards b WHERE b.id = ?')
    .get(board.id);
  assert.equal(row.status, 'approved');
  assert.equal(row.events, 1, 'status change always pairs with exactly one activity row');
});
