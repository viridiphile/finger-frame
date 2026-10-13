import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFingertips, validateFrame, polygonArea, FrameStabilizer } from '../src/frameGeometry.js';
import { demoFingertips } from '../src/demo.js';

const width = 960, height = 600;
const rectangle = () => [
  { x: 280, y: 440, hand: 0, finger: 0 },
  { x: 280, y: 160, hand: 0, finger: 1 },
  { x: 680, y: 440, hand: 1, finger: 0 },
  { x: 680, y: 160, hand: 1, finger: 1 },
];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} differs from ${b}`);

test('landmarks 4 and 8 map to mirrored coordinates and retain finger identity', () => {
  const hands = [0.2, 0.7].map((x) => Array.from({ length: 21 }, (_, i) => ({ x, y: i / 25 })));
  const points = extractFingertips({ landmarks: hands }, width, height);
  near(points[0].x, 768);
  near(points[0].y, 96);
  near(points[1].y, 192);
  assert.equal(points[2].hand, 1);
  assert.equal(points[1].finger, 1);
  assert.equal(extractFingertips({ landmarks: hands.slice(0, 1) }, width, height), null);
  hands[0][4].x = NaN;
  assert.equal(extractFingertips({ landmarks: hands }, width, height), null);
});

test('a valid quadrilateral has the same area regardless of input order', () => {
  const result = validateFrame(rectangle().reverse(), width, height);
  assert.equal(result.valid, true);
  near(polygonArea(result.polygon), 112000);
});

test('frames stay valid through a full rotation and rescaling', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.04) {
    for (const scale of [0.6, 0.85, 1]) {
      const points = rectangle().map((p) => {
        const x = (p.x - 480) * scale, y = (p.y - 300) * scale;
        return { ...p, x: 480 + x * Math.cos(angle) - y * Math.sin(angle), y: 300 + x * Math.sin(angle) + y * Math.cos(angle) };
      });
      assert.equal(validateFrame(points, width, height).valid, true);
    }
  }
});

test('overlap, duplicates, collinearity, narrow frames, and offscreen points are rejected', () => {
  const cases = [
    null,
    rectangle().slice(0, 3),
    rectangle().map((p) => ({ ...p, y: 300 })),
    rectangle().map((p, i) => i === 0 ? { ...p, x: 480, y: 300 } : p),
    rectangle().map((p, i) => i === 0 ? { ...p, x: 280, y: 160 } : p),
    rectangle().map((p) => ({ ...p, x: 480 + (p.x - 480) * 0.02 })),
    rectangle().map((p, i) => i === 0 ? { ...p, x: -2 } : p),
    rectangle().map((p, i) => i === 0 ? { ...p, x: Infinity } : p),
  ];
  for (const points of cases) assert.equal(validateFrame(points, width, height).valid, false);
});

test('a convex set with hands on diagonals is rejected as crossed', () => {
  const points = rectangle();
  [points[0].x, points[2].x] = [points[2].x, points[0].x];
  assert.equal(validateFrame(points, width, height).valid, false);
});

test('hand-order swaps cause no geometry jump', () => {
  const stabilizer = new FrameStabilizer();
  stabilizer.update(rectangle(), 0, width, height);
  const before = stabilizer.snapshot(100).polygon;
  const after = stabilizer.update(rectangle().map((p) => ({ ...p, hand: 1 - p.hand })), 100, width, height).polygon;
  assert.deepEqual(after, before);
});

test('EMA reduces alternating landmark jitter', () => {
  const stabilizer = new FrameStabilizer();
  stabilizer.update(rectangle(), 0, width, height);
  let squaredError = 0;
  for (let i = 1; i <= 80; i++) {
    const noise = i % 2 ? 10 : -10;
    const frame = stabilizer.update(rectangle().map((p) => ({ ...p, x: p.x + noise })), i * 50, width, height);
    squaredError += (frame.polygon[0].x - 280) ** 2;
  }
  assert.ok(Math.sqrt(squaredError / 80) < 5);
});

test('short detection loss holds the last frame, then fades and expires by time', () => {
  const stabilizer = new FrameStabilizer();
  stabilizer.update(rectangle(), 0, width, height);
  stabilizer.update(rectangle(), 100, width, height);
  const held = stabilizer.update(null, 250, width, height);
  assert.equal(held.state, 'holding');
  assert.equal(held.opacity, 1);
  const fading = stabilizer.snapshot(400);
  assert.ok(fading.opacity > 0 && fading.opacity < 1);
  assert.equal(stabilizer.snapshot(481).polygon, null);
});

test('a large spike is held; a sustained reposition reacquires after expiration', () => {
  const stabilizer = new FrameStabilizer();
  const small = rectangle().map((p) => ({ ...p, x: p.x - 230 }));
  stabilizer.update(small, 0, width, height);
  stabilizer.update(small, 100, width, height);
  const moved = small.map((p) => ({ ...p, x: p.x + 400 }));
  const held = stabilizer.update(moved, 150, width, height);
  assert.equal(held.state, 'holding');
  near(held.polygon[0].x, 50);
  assert.equal(stabilizer.update(moved, 500, width, height).state, 'tracked');
  near(stabilizer.snapshot(600).polygon[0].x, 450);
});

test('the complete animated demo remains valid over two minutes', () => {
  const stabilizer = new FrameStabilizer();
  for (let t = 0; t <= 120_000; t += 50) {
    const points = demoFingertips(width, height, t);
    assert.equal(validateFrame(points, width, height).valid, true);
    assert.equal(stabilizer.update(points, t, width, height).state, 'tracked');
  }
});
