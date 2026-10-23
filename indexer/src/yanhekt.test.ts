import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Budget, MISSING_CODE, XCLIENT_SIGNATURE, classify } from './yanhekt.ts';

test('client signature: md5(VIDEO_MAGIC + "_v1_undefined"), the golden vector', () => {
  // Same vector as autoslides/src/shared/crypto.test.ts, web, relay and share.
  const computed = createHash('md5').update('1138b69dfef641d9d7ba49137d2d4875_v1_undefined').digest('hex');
  assert.equal(computed, '72b77856f6df3f563ab6e658631cac3d');
  assert.equal(XCLIENT_SIGNATURE, computed);
});

test('classify: ok object', () => {
  assert.deepEqual(classify({ code: 0, data: { id: 1 } }, MISSING_CODE.session), { kind: 'ok', data: { id: 1 } });
  assert.deepEqual(classify({ code: '0', data: { id: 1 } }, MISSING_CODE.session), { kind: 'ok', data: { id: 1 } });
});

test('classify: per-resource missing codes', () => {
  const sessionMissing = { code: 12121010, message: 'service runtime exception', data: [] };
  assert.equal(classify(sessionMissing, MISSING_CODE.session).kind, 'missing');
  // The same code for another resource is not "missing".
  assert.equal(classify(sessionMissing, MISSING_CODE.video).kind, 'unexpected');
  assert.equal(classify({ code: 13121010, data: [] }, MISSING_CODE.video).kind, 'missing');
  assert.equal(classify({ code: 12111010, data: [] }, MISSING_CODE.course).kind, 'missing');
});

test('classify: busy is transient, unknown is unexpected', () => {
  assert.equal(classify({ code: 61101114, data: [] }, MISSING_CODE.session).kind, 'transient');
  assert.equal(classify({ code: 99151011, message: 'failed to invoke service', data: [] }, MISSING_CODE.session).kind, 'transient');
  assert.deepEqual(classify({ code: 61101113, message: '用户未登录', data: [] }, MISSING_CODE.session), {
    kind: 'unexpected',
    code: '61101113',
    message: '用户未登录',
  });
  assert.equal(classify(null, MISSING_CODE.session).kind, 'transient');
});

test('classify: array data', () => {
  assert.deepEqual(classify({ code: 0, data: [{ name: 'a' }] }, MISSING_CODE.course, true), { kind: 'ok', data: [{ name: 'a' }] });
  assert.deepEqual(classify({ code: 0, data: {} }, MISSING_CODE.course, true), { kind: 'ok', data: [] });
});

test('Budget: request cap and deadline', () => {
  let now = 0;
  const b = new Budget(3, 10_000, 1000, () => now);
  assert.equal(b.canAfford(3), true);
  b.take();
  b.take();
  assert.equal(b.canAfford(2), false);
  assert.equal(b.canAfford(1), true);
  now = 9500;
  assert.equal(b.canAfford(1), false);
});
