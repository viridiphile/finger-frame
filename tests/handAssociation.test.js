import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHands, HandIdentityTracker, fingertipsFromHands } from '../src/handAssociation.js';

const width = 960, height = 600;
function hand(x, label = null, score = 0) {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: x + (i % 4) * 12, y: 300 - Math.floor(i / 4) * 18 }));
  landmarks[0] = { x, y: 340 };
  landmarks[4] = { x: x + 55, y: 310 };
  landmarks[8] = { x: x + 20, y: 190 };
  return { landmarks, handedness: label, score };
}

test('all 21 landmarks mirror once; handedness uses category confidence only', () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.25, y: 0.5 }));
  const [result] = extractHands({ landmarks: [landmarks], handedness: [[{ categoryName: 'Left', score: 0.94 }]] }, width, height);
  assert.equal(result.landmarks[0].x, 720);
  assert.equal(result.landmarks[20].y, 300);
  assert.equal(result.handedness, 'Left');
  assert.equal(result.score, 0.94);
  assert.deepEqual(extractHands({ landmarks: [[{ x: NaN, y: 0 }]] }, width, height), []);
});

test('detection-array swaps and a brief wrong handedness label preserve identity', () => {
  const tracker = new HandIdentityTracker();
  tracker.update([hand(200, 'Left', 0.95), hand(700, 'Right', 0.95)], 0, width, height);
  const swapped = tracker.update([hand(700, 'Right', 0.95), hand(200, 'Left', 0.95)], 50, width, height);
  assert.equal(swapped[0].landmarks[0].x, 200);
  assert.equal(swapped[1].landmarks[0].x, 700);
  const wrong = tracker.update([hand(200, 'Right', 0.99), hand(700, 'Left', 0.99)], 100, width, height);
  assert.equal(wrong[0].handedness, 'Left');
  assert.ok(wrong[0].landmarks[0].x < 300);
});

test('reliable labels, wrist/palm and velocity keep identities through interchange', () => {
  const tracker = new HandIdentityTracker();
  for (let i = 0; i <= 24; i++) {
    const a = hand(180 + i * 24, 'Left', 0.95), b = hand(760 - i * 24, 'Right', 0.95);
    tracker.update(i % 2 ? [b, a] : [a, b], i * 50, width, height);
  }
  const hands = tracker.snapshot(1200);
  assert.ok(hands[0].landmarks[0].x > hands[1].landmarks[0].x);
  assert.equal(hands[0].handedness, 'Left');
  assert.equal(hands[1].handedness, 'Right');
});

test('motion continuity associates unlabeled hands through crossing', () => {
  const tracker = new HandIdentityTracker();
  for (let i = 0; i <= 30; i++) {
    const a = hand(150 + i * 20), b = hand(750 - i * 20);
    tracker.update(i % 2 ? [b, a] : [a, b], i * 50, width, height);
  }
  const hands = tracker.snapshot(1500);
  assert.ok(hands[0].landmarks[0].x > 650);
  assert.ok(hands[1].landmarks[0].x < 250);
});

test('one-hand occlusion predicts briefly, caps displacement, and returns smoothly', () => {
  const tracker = new HandIdentityTracker();
  for (let i = 0; i <= 5; i++) tracker.update([hand(180 + i * 10), hand(700)], i * 50, width, height);
  tracker.update([hand(700)], 300, width, height);
  const before = tracker.snapshot(250)[0].landmarks[0].x;
  const predicted = tracker.snapshot(350)[0].landmarks[0].x;
  assert.ok(predicted > before);
  assert.equal(tracker.snapshot(450)[0].landmarks[0].x, tracker.snapshot(650)[0].landmarks[0].x);
  assert.equal(tracker.snapshot(450)[0].maskOpacity, 0);
  const recovered = tracker.update([hand(700), hand(260)], 400, width, height);
  assert.ok(Math.abs(recovered[0].landmarks[0].x - predicted) < 35);
  assert.equal(recovered[0].lastSeen, 400);
});

test('a tip spike is rejected without refreshing track time', () => {
  const tracker = new HandIdentityTracker();
  tracker.update([hand(200, 'Left', 0.95), hand(700, 'Right', 0.95)], 0, width, height);
  const spike = hand(200, 'Left', 0.95);
  spike.landmarks[8] = { x: 940, y: 5 };
  const result = tracker.update([spike, hand(700, 'Right', 0.95)], 50, width, height);
  assert.equal(result[0].lastSeen, 0);
  assert.ok(result[0].landmarks[8].x < 300);
});

test('adaptive smoothing reduces stationary jitter but follows deliberate motion', () => {
  const tracker = new HandIdentityTracker();
  tracker.update([hand(200), hand(700)], 0, width, height);
  let error = 0;
  for (let i = 1; i <= 40; i++) {
    const result = tracker.update([hand(200 + (i % 2 ? 6 : -6)), hand(700)], i * 50, width, height);
    error += (result[0].landmarks[0].x - 200) ** 2;
  }
  assert.ok(Math.sqrt(error / 40) < 4);
  const moved = tracker.update([hand(260), hand(700)], 2050, width, height);
  assert.ok(moved[0].landmarks[0].x > 235);
});

test('stale identities expire, and fingertips require both persistent slots', () => {
  const tracker = new HandIdentityTracker();
  const hands = tracker.update([hand(200, 'Left', 0.95)], 0, width, height);
  assert.equal(fingertipsFromHands(hands), null);
  assert.deepEqual(tracker.snapshot(1000), []);
  tracker.update([hand(700, 'Right', 0.95)], 1000, width, height);
  const both = tracker.update([hand(200, 'Left', 0.95), hand(700, 'Right', 0.95)], 1050, width, height);
  assert.equal(fingertipsFromHands(both).length, 4);
});
