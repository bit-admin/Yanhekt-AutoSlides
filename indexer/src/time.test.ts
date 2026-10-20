import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cnClock, inWindow, nextWindowStartMs, windowEndMs } from './time.ts';

// 2026-10-20 03:30 UTC+8 == 2026-10-19 19:30 UTC
const t0330 = Date.UTC(2026, 9, 19, 19, 30);
// 2026-10-20 12:00 UTC+8
const t1200 = Date.UTC(2026, 9, 20, 4, 0);

test('cnClock formats Beijing time like Yanhekt', () => {
  assert.equal(cnClock(t0330), '2026-10-20 03:30:00');
});

test('inWindow 2-5', () => {
  assert.equal(inWindow(t0330, 2, 5), true);
  assert.equal(inWindow(t1200, 2, 5), false);
  assert.equal(inWindow(Date.UTC(2026, 9, 19, 21, 0), 2, 5), false); // 05:00 is outside
  assert.equal(inWindow(Date.UTC(2026, 9, 19, 18, 0), 2, 5), true); // 02:00 is inside
});

test('inWindow wrapping midnight', () => {
  assert.equal(inWindow(Date.UTC(2026, 9, 19, 15, 30), 23, 2), true); // 23:30
  assert.equal(inWindow(Date.UTC(2026, 9, 19, 17, 30), 23, 2), true); // 01:30
  assert.equal(inWindow(Date.UTC(2026, 9, 19, 18, 30), 23, 2), false); // 02:30
});

test('windowEndMs', () => {
  assert.equal(cnClock(windowEndMs(t0330, 2, 5)), '2026-10-20 05:00:00');
  assert.equal(cnClock(windowEndMs(Date.UTC(2026, 9, 19, 15, 30), 23, 2)), '2026-10-20 02:00:00');
  assert.equal(cnClock(windowEndMs(Date.UTC(2026, 9, 19, 17, 30), 23, 2)), '2026-10-20 02:00:00');
});

test('nextWindowStartMs', () => {
  assert.equal(cnClock(nextWindowStartMs(t1200, 2)), '2026-10-21 02:00:00');
  assert.equal(cnClock(nextWindowStartMs(t0330, 2)), '2026-10-21 02:00:00');
  assert.equal(cnClock(nextWindowStartMs(Date.UTC(2026, 9, 19, 16, 0), 2)), '2026-10-20 02:00:00'); // 00:00
});
