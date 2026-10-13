import test from 'node:test';
import assert from 'node:assert/strict';
import { handSilhouette } from '../src/handMask.js';

export function sampleHand() {
  return [
    [100, 158], [83, 139], [69, 123], [56, 107], [46, 98],
    [80, 108], [76, 86], [73, 65], [72, 46],
    [98, 102], [98, 77], [98, 54], [98, 35],
    [116, 108], [119, 86], [121, 65], [122, 48],
    [131, 122], [139, 108], [143, 94], [146, 80],
  ].map(([x, y]) => ({ x, y }));
}

test('palm and all five fingers form bounded tapered silhouettes', () => {
  const mask = handSilhouette(sampleHand(), 200, 200);
  assert.ok(mask.palm.length >= 4);
  assert.equal(mask.segments.length, 15);
  assert.equal(mask.joints.length, 20);
  assert.ok(mask.joints[0].radius > mask.joints[3].radius);
  assert.ok([...mask.palm, ...mask.segments.flat()].every((p) => p.x > 30 && p.x < 170 && p.y > 25 && p.y < 165));
});

test('missing/invalid and collapsed palms are rejected safely', () => {
  assert.equal(handSilhouette([], 200, 200), null);
  assert.equal(handSilhouette(Array.from({ length: 21 }, () => ({ x: 10, y: 10 })), 200, 200), null);
  const invalid = sampleHand(); invalid[8].x = NaN;
  assert.equal(handSilhouette(invalid, 200, 200), null);
});

test('an implausible finger joint does not create a broad background strip', () => {
  const hand = sampleHand(); hand[6] = { x: 500, y: 500 };
  const mask = handSilhouette(hand, 200, 200);
  assert.equal(mask.segments.length, 12);
  assert.ok(mask.segments.flat().every((p) => p.x < 180 && p.y < 180));
});
