import test from 'node:test';
import assert from 'node:assert/strict';
import { anatomicalPolygon, extractFingertips, validateFrame, polygonArea, segmentIntersection, FrameStabilizer } from '../src/frameGeometry.js';

const width = 960, height = 600;
const rectangle = () => [
  { x: 280, y: 440, hand: 0, finger: 0 },
  { x: 280, y: 160, hand: 0, finger: 1 },
  { x: 680, y: 440, hand: 1, finger: 0 },
  { x: 680, y: 160, hand: 1, finger: 1 },
];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} differs from ${b}`);

function bowtie(pair = 'thumbs') {
  const points = rectangle();
  if (pair === 'thumbs') [points[0].x, points[2].x] = [points[2].x, points[0].x];
  else [points[2].y, points[3].y] = [points[3].y, points[2].y];
  return points;
}

test('landmarks 4/8 map to mirrored fingertips with anatomical identities', () => {
  const hands = [0.2, 0.7].map((x) => Array.from({ length: 21 }, (_, i) => ({ x, y: i / 25 })));
  const points = extractFingertips({ landmarks: hands }, width, height);
  near(points[0].x, 768);
  near(points[0].y, 96);
  near(points[1].y, 192);
  assert.equal(points[2].hand, 1);
  assert.equal(points[1].finger, 1);
  assert.equal(extractFingertips({ landmarks: hands.slice(0, 1) }, width, height), null);
});

test('normal geometry always orders A.index, B.index, B.thumb, A.thumb', () => {
  const result = validateFrame(rectangle().reverse(), width, height);
  assert.equal(result.valid, true);
  assert.equal(result.kind, 'quadrilateral');
  assert.deepEqual(result.polygon.map((p) => [p.hand, p.finger]), [[0, 1], [1, 1], [1, 0], [0, 0]]);
  near(polygonArea(result.polygon), 112000);
});

test('both crossing edge pairs split into two nondegenerate lobes', () => {
  for (const pair of ['thumbs', 'one-hand']) {
    const result = validateFrame(bowtie(pair), width, height);
    assert.equal(result.valid, true);
    assert.equal(result.kind, 'bowtie');
    assert.equal(result.regions.length, 2);
    assert.ok(result.regions.every((triangle) => triangle.length === 3 && polygonArea(triangle) > 10000));
    near(result.intersection.x, 480);
    near(result.intersection.y, 300);
    near(result.area, 56000);
    // Shoelace cancellation is not used as the bowtie validity test.
    near(polygonArea(result.polygon), 0);
  }
});

test('interchange preserves connections and supports reversed winding', () => {
  const reversed = rectangle().map((p) => ({ ...p, x: width - p.x }));
  const geometry = validateFrame(reversed, width, height);
  assert.equal(geometry.valid, true);
  assert.ok(geometry.polygon[0].x > geometry.polygon[1].x);
  assert.deepEqual(geometry.polygon.map((p) => p.hand), [0, 1, 1, 0]);
  const crossed = validateFrame(bowtie().map((p) => ({ ...p, x: width - p.x })), width, height);
  assert.equal(crossed.kind, 'bowtie');
  near(crossed.area, 56000);
});

test('normal and bowtie frames survive full rotation and scaling', () => {
  for (const base of [rectangle(), bowtie()]) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.04) {
      for (const scale of [0.6, 1]) {
        const points = base.map((p) => {
          const x = (p.x - 480) * scale, y = (p.y - 300) * scale;
          return { ...p, x: 480 + x * Math.cos(angle) - y * Math.sin(angle), y: 300 + x * Math.sin(angle) + y * Math.cos(angle) };
        });
        assert.equal(validateFrame(points, width, height).valid, true);
      }
    }
  }
});

test('segment intersection distinguishes crossing, endpoint touch, overlap, and parallel', () => {
  const point = (x, y) => ({ x, y });
  const crossed = segmentIntersection(point(0, 0), point(10, 10), point(0, 10), point(10, 0));
  assert.equal(crossed.kind, 'crossing');
  near(crossed.x, 5);
  near(crossed.t, 0.5);
  assert.equal(segmentIntersection(point(0, 0), point(10, 0), point(10, 0), point(10, 10)).kind, 'touch');
  assert.equal(segmentIntersection(point(0, 0), point(10, 0), point(2, 0), point(15, 0)).kind, 'overlap');
  assert.equal(segmentIntersection(point(0, 0), point(10, 0), point(0, 2), point(10, 2)), null);
  assert.equal(segmentIntersection(point(0, 0), point(0, 0), point(0, 2), point(10, 2)), null);
  assert.equal(segmentIntersection(point(0, 0), point(1e6, 1), point(0, 1), point(1e6, 2.000000001)), null);
});

test('duplicates, collinearity, narrow/one-lobe frames and offscreen tips are rejected', () => {
  const tinyLobe = bowtie();
  tinyLobe[1].y = tinyLobe[3].y = 435;
  const cases = [null, rectangle().slice(0, 3), tinyLobe,
    rectangle().map((p) => ({ ...p, y: 300 })),
    rectangle().map((p, i) => i === 0 ? { ...p, x: 280, y: 160 } : p),
    rectangle().map((p) => ({ ...p, x: 480 + (p.x - 480) * 0.02 })),
    rectangle().map((p, i) => i === 0 ? { ...p, x: -2 } : p),
    rectangle().map((p, i) => i === 0 ? { ...p, x: Infinity } : p),
  ];
  for (const points of cases) assert.equal(validateFrame(points, width, height).valid, false);
  assert.equal(anatomicalPolygon(rectangle().map((p) => ({ ...p, hand: 0 }))), null);
});

test('short loss predicts/holds, then fades and expires using real observation time', () => {
  const stabilizer = new FrameStabilizer();
  stabilizer.update(rectangle(), 0, width, height);
  stabilizer.update(rectangle(), 100, width, height);
  assert.equal(stabilizer.snapshot(220).state, 'predicting');
  const held = stabilizer.update(null, 300, width, height);
  assert.equal(held.state, 'holding');
  assert.equal(held.opacity, 1);
  assert.ok(stabilizer.snapshot(400).opacity > 0 && stabilizer.snapshot(400).opacity < 1);
  assert.equal(stabilizer.snapshot(501).polygon, null);
});

test('continuously redrawing predicted coordinates cannot prevent expiration', () => {
  const stabilizer = new FrameStabilizer();
  for (let t = 0; t <= 600; t += 20) stabilizer.update(rectangle(), t, width, height, { observedAt: 0 });
  assert.equal(stabilizer.snapshot(600).polygon, null);
});

test('normal → bowtie → reversed normal returns without changing anatomy', () => {
  const stabilizer = new FrameStabilizer();
  const normal = stabilizer.update(rectangle(), 0, width, height);
  const crossed = stabilizer.update(bowtie(), 100, width, height);
  const returned = stabilizer.update(rectangle().map((p) => ({ ...p, x: width - p.x })), 200, width, height);
  assert.equal(normal.kind, 'quadrilateral');
  assert.equal(crossed.kind, 'bowtie');
  assert.equal(returned.kind, 'quadrilateral');
  assert.deepEqual(returned.polygon.map((p) => [p.hand, p.finger]), [[0, 1], [1, 1], [1, 0], [0, 0]]);
});
