import { extractHands, fingertipsFromHands } from './handAssociation.js';

const crossVector = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function extractFingertips(result, width, height) {
  return fingertipsFromHands(extractHands(result, width, height).map((hand, id) => ({ ...hand, id })));
}

export function polygonArea(points) {
  return Math.abs(points.reduce((area, point, i) => {
    const next = points[(i + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

// A + t(B-A) = C + u(D-C). Parallel/collinear segments need a separate
// branch: division by a tiny determinant must never create a distant corner.
export function segmentIntersection(a, b, c, d, epsilon = 1e-8) {
  if (![a, b, c, d].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const r = subtract(b, a), s = subtract(d, c), q = subtract(c, a);
  const rr = r.x * r.x + r.y * r.y, ss = s.x * s.x + s.y * s.y;
  if (rr < epsilon || ss < epsilon) return null;
  const denominator = crossVector(r, s);
  if (Math.abs(denominator) <= epsilon * Math.sqrt(rr * ss)) {
    if (Math.abs(crossVector(q, r)) > epsilon * Math.sqrt(rr) * Math.max(1, Math.hypot(q.x, q.y))) return null;
    const start = (q.x * r.x + q.y * r.y) / rr;
    const end = start + (s.x * r.x + s.y * r.y) / rr;
    const low = Math.max(0, Math.min(start, end)), high = Math.min(1, Math.max(start, end));
    if (high < low - epsilon) return null;
    return { kind: high - low > epsilon ? 'overlap' : 'touch', x: a.x + low * r.x, y: a.y + low * r.y };
  }
  const t = crossVector(q, s) / denominator, u = crossVector(q, r) / denominator;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;
  const proper = t > epsilon && t < 1 - epsilon && u > epsilon && u < 1 - epsilon;
  return { kind: proper ? 'crossing' : 'touch', x: a.x + t * r.x, y: a.y + t * r.y, t, u };
}

export function anatomicalPolygon(points) {
  if (!points || points.length !== 4) return null;
  const get = (hand, finger) => points.find((p) => p.hand === hand && p.finger === finger);
  // Fixed connections, including when A passes to the right of B.
  const polygon = [get(0, 1), get(1, 1), get(1, 0), get(0, 0)];
  return polygon.every(Boolean) ? polygon : null;
}

export function validateFrame(points, width, height) {
  const invalid = (reason) => ({ valid: false, reason, polygon: null, regions: [], kind: null, intersection: null });
  if (width <= 0 || height <= 0) return invalid('Show both hands');
  const polygon = anatomicalPolygon(points);
  if (!polygon) return invalid('Show both hands');
  if (!polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)) return invalid('Keep all four fingertips in view');
  const minimumDistance = Math.min(width, height) * 0.02;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (distance(polygon[i], polygon[j]) < minimumDistance) return invalid('Spread your fingertips apart');
    }
  }
  const [a, b, c, d] = polygon;
  const first = segmentIntersection(a, b, c, d);
  const second = segmentIntersection(b, c, d, a);
  if ([first, second].some((hit) => hit && hit.kind !== 'crossing')) return invalid('Open the frame a little wider');
  if (first && second) return invalid('Open the frame a little wider');
  const hit = first || second;
  let regions;
  if (hit) {
    const intersection = { x: hit.x, y: hit.y };
    regions = first ? [[a, intersection, d], [b, c, intersection]] : [[a, b, intersection], [c, d, intersection]];
    const areas = regions.map(polygonArea);
    if (Math.min(...areas) < width * height * 0.001 || areas[0] + areas[1] < width * height * 0.008) {
      return invalid('Open both bowtie lobes a little wider');
    }
    return { valid: true, reason: 'Bowtie tracked', polygon, regions, kind: 'bowtie', intersection, area: areas[0] + areas[1] };
  }
  const area = polygonArea(polygon);
  if (area < width * height * 0.008) return invalid('Make a larger frame');
  for (let i = 0; i < 4; i++) {
    const previous = polygon[(i + 3) % 4], point = polygon[i], next = polygon[(i + 1) % 4];
    const sine = Math.abs(crossVector(subtract(previous, point), subtract(next, point)))
      / (distance(previous, point) * distance(next, point));
    if (sine < 0.015) return invalid('Open the frame a little wider');
  }
  return { valid: true, reason: 'Frame tracked', polygon, regions: [polygon], kind: 'quadrilateral', intersection: null, area };
}

export class FrameStabilizer {
  constructor({ holdMs = 220, fadeMs = 180 } = {}) {
    this.holdMs = holdMs;
    this.fadeMs = fadeMs;
    this.reset();
  }

  reset() {
    this.geometry = null;
    this.lastValid = -Infinity;
    this.acquiredAt = null;
    this.reason = 'Show both hands';
    this.measurementValid = false;
  }

  // Coordinates have already been smoothed/predicted by HandIdentityTracker.
  // observedAt is the older hand's real observation timestamp: predicting or
  // redrawing a stale pose must not extend its lifetime indefinitely.
  update(points, timestamp, width, height, { observedAt = timestamp } = {}) {
    const validation = validateFrame(points, width, height);
    this.measurementValid = validation.valid;
    this.reason = validation.valid && timestamp - observedAt > 150 ? 'Show both hands' : validation.reason;
    if (validation.valid && timestamp - observedAt < this.holdMs + this.fadeMs) {
      if (!this.geometry || timestamp - this.lastValid >= this.holdMs + this.fadeMs) this.acquiredAt = timestamp;
      this.geometry = validation;
      this.lastValid = Math.max(this.lastValid, observedAt);
    }
    return this.snapshot(timestamp);
  }

  snapshot(timestamp) {
    const age = Math.max(0, timestamp - this.lastValid);
    if (!this.geometry || age >= this.holdMs + this.fadeMs) {
      return { polygon: null, regions: [], opacity: 0, state: 'searching', reason: this.reason, kind: null };
    }
    const fadeOut = age <= this.holdMs ? 1 : 1 - (age - this.holdMs) / this.fadeMs;
    const fadeIn = Math.min(1, Math.max(0, (timestamp - this.acquiredAt) / 100));
    return {
      ...this.geometry, reason: this.reason,
      opacity: Math.min(fadeIn, fadeOut),
      state: this.measurementValid && age <= 80 ? 'tracked' : age <= 150 && this.measurementValid ? 'predicting' : 'holding',
    };
  }
}
