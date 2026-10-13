import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptureCountdown } from '../src/captureCountdown.js';

function setup(t, captureFrame) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const updates = [], saved = [], errors = [];
  const capture = new CaptureCountdown({
    captureFrame, saveFrame: (frame) => saved.push(frame),
    onChange: () => updates.push([capture.active, capture.remaining]),
    onError: (error) => errors.push(error.message),
  });
  return { capture, updates, saved, errors };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('counts 3, 2, 1 and captures the current frame only after three seconds', async (t) => {
  let current = 'initial';
  const { capture, updates, saved } = setup(t, () => current);
  assert.equal(capture.start(), true);
  assert.equal(capture.start(), false);
  t.mock.timers.tick(1000);
  t.mock.timers.tick(1000);
  assert.deepEqual(saved, []);
  current = 'frame at countdown end';
  t.mock.timers.tick(1000);
  await flush();
  assert.deepEqual(saved, [current]);
  assert.deepEqual(updates, [[true, 3], [true, 2], [true, 1], [true, 0], [false, 0]]);
  t.mock.timers.tick(5000);
  assert.deepEqual(saved, [current]);
});

test('canceling a countdown clears its timer and allows a fresh capture', async (t) => {
  let calls = 0;
  const { capture, saved } = setup(t, () => ++calls);
  capture.start(); t.mock.timers.tick(1000); capture.cancel();
  t.mock.timers.tick(5000); await flush();
  assert.equal(calls, 0);
  assert.equal(capture.active, false);
  capture.start();
  for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
  await flush(); assert.deepEqual(saved, [1]);
});

test('pending encoding blocks duplicates and a canceled result cannot download or end a new countdown', async (t) => {
  let resolve;
  const { capture, saved } = setup(t, () => new Promise((done) => { resolve = done; }));
  capture.start();
  for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
  assert.equal(capture.active, true);
  assert.equal(capture.start(), false);
  capture.cancel(); capture.start();
  resolve('stale encoded frame'); await flush();
  assert.deepEqual(saved, []);
  assert.equal(capture.active, true);
  assert.equal(capture.remaining, 3);
});

for (const failure of ['empty image', 'encoding error']) {
  test(`${failure} restores the control and allows a retry`, async (t) => {
    let fail = true;
    const { capture, saved, errors } = setup(t, () => {
      if (fail && failure === 'encoding error') throw new Error('Encoding failed');
      return fail ? null : 'new frame';
    });
    capture.start();
    for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
    await flush(); assert.equal(errors.length, 1); assert.equal(capture.active, false);
    fail = false; capture.start();
    for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
    await flush(); assert.deepEqual(saved, ['new frame']);
  });
}
