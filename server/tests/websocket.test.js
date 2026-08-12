import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { startTestServer, login, createBoard, addComment, setStatus } from './helpers.js';

let ctx;
let designerToken;
let clientToken;
let boardId;
const received = [];

function connect(token) {
  const socket = io(ctx.base, { auth: { token } });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

before(async () => {
  ctx = await startTestServer();
  ({ token: designerToken } = await login(ctx.base, 'designer@demo.com'));
  ({ token: clientToken } = await login(ctx.base, 'client@demo.com'));
  ({ board: { id: boardId } } = await createBoard(ctx.base, designerToken, { clientEmail: 'client@demo.com' }));
});

after(() => ctx.close());

test('ws: rejects connections without a valid token', async () => {
  const bad = io(ctx.base, { auth: { token: 'bogus-token' } });
  await assert.rejects(
    new Promise((resolve, reject) => {
      bad.on('connect', resolve);
      bad.on('connect_error', reject);
    })
  );
  bad.close();
});

test('ws: comment:new and status:change are delivered live to room members', async () => {
  const designerSocket = await connect(designerToken);
  const clientSocket = await connect(clientToken);
  const otherSocket = await connect(clientToken);

  designerSocket.on('comment:new', (d) => received.push(`designer:comment:${d.comment.text}`));
  designerSocket.on('status:change', (d) => received.push(`designer:status:${d.status}`));
  clientSocket.on('comment:new', (d) => received.push(`client:comment:${d.comment.text}`));
  clientSocket.on('status:change', (d) => received.push(`client:status:${d.status}`));
  otherSocket.on('comment:new', (d) => received.push(`other:comment:${d.comment.text}`));
  otherSocket.on('status:change', (d) => received.push(`other:status:${d.status}`));

  await addComment(ctx.base, clientToken, boardId, { text: 'Live pin' });
  await setStatus(ctx.base, designerToken, boardId, 'in_review');

  await new Promise((resolve) => setTimeout(resolve, 500));

  assert.ok(received.includes('designer:comment:Live pin'), 'designer received the live comment');
  assert.ok(received.includes('client:comment:Live pin'), 'commenting client received it too');
  assert.ok(received.includes('other:comment:Live pin'), 'other board members received it');
  assert.ok(received.includes('designer:status:in_review'), 'designer received status change');
  assert.ok(received.some((e) => e.startsWith('client:status:')), 'clients received status change');

  designerSocket.close();
  clientSocket.close();
  otherSocket.close();
});

test('ws: clients are not in rooms of boards not shared with them', async () => {
  const { board } = await createBoard(ctx.base, designerToken, { title: 'Not shared' });

  const spy = io(ctx.base, { auth: { token: clientToken } });
  let gotEvent = false;
  spy.on('comment:new', () => { gotEvent = true; });

  await new Promise((resolve) => spy.on('connect', resolve));
  await addComment(ctx.base, designerToken, board.id, { text: 'should not leak' });
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(gotEvent, false, 'client must not receive events for unshared boards');
  spy.close();
});
