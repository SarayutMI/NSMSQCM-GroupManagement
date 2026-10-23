import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../line-webhook/worker.mjs';

const secret = 'test-channel-secret';
const groupId = 'C' + 'a'.repeat(32);
function request(body, signedBody = body) {
  return new Request('https://webhook.test', { method: 'POST', body,
    headers: { 'x-line-signature': createHmac('sha256', secret).update(signedBody).digest('base64') } });
}
test('webhook verifies raw request and logs only the verified group ID', async () => {
  const logs = [], original = console.log;
  console.log = value => logs.push(value);
  try {
    const body = JSON.stringify({ events: [{ type: 'message', source: { type: 'group', groupId, userId: 'private-user' }, message: { text: 'private-message' } }] });
    assert.equal((await worker.fetch(request(body), { LINE_CHANNEL_SECRET: secret })).status, 200);
    assert.deepEqual(logs.map(JSON.parse), [{ event: 'verified_line_group', groupId }]);
    assert.equal((await worker.fetch(request(body + ' ', body), { LINE_CHANNEL_SECRET: secret })).status, 401);
    assert.equal(logs.length, 1);
    assert.equal((await worker.fetch(request('{"events":[]}'), { LINE_CHANNEL_SECRET: secret })).status, 200);
  } finally { console.log = original; }
});
test('webhook rejects missing signature or configuration and does not send messages', async () => {
  assert.equal((await worker.fetch(new Request('https://test', { method: 'POST', body: '{}' }), { LINE_CHANNEL_SECRET: secret })).status, 401);
  assert.equal((await worker.fetch(request('{}'), {})).status, 503);
  assert.equal((await worker.fetch(new Request('https://test'), { LINE_CHANNEL_SECRET: secret })).status, 405);
});
