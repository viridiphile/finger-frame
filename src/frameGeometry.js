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

export function validateFrame(points, width, height, { retain = false, activeRegionIds = [] } = {}) {
  const invalid = (reason, geometryState = 'degenerate') => ({
    valid: false, reason, polygon: null, regions: [], regionIds: [], kind: null, intersection: null, geometryState,
  });
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return invalid('Show both hands', 'lost');
  const polygon = anatomicalPolygon(points);
  if (!polygon) return invalid('Show both hands', 'lost');
  if (!polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)) return invalid('Keep all four fingertips in view', 'lost');
  const center = polygon.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  const spreadSquared = polygon.reduce((sum, p) => sum + distance(p, center) ** 2 / 4, 0);
  // Local spread, not full-screen area or every pair's separation, determines
  // whether there are meaningful pixels. Nothing is expanded artificially.
  const baseArea = Math.max(1.5, spreadSquared * 0.0015);
  const pixelTolerance = Math.max(1e-4, Math.hypot(width, height) * 1e-7);
  const [a, b, c, d] = polygon;
  const first = segmentIntersection(a, b, c, d);
  const second = segmentIntersection(b, c, d, a);
  if ([first, second].some((hit) => hit?.kind === 'overlap')) return invalid('Open the frame a little wider');
  if (first && second && distance(first, second) > pixelTolerance) return invalid('Open the frame a little wider');
  const hit = first || second;
  if (hit) {
    const intersection = { x: hit.x, y: hit.y };
    const triangles = first ? [[a, intersection, d], [b, c, intersection]] : [[a, b, intersection], [c, d, intersection]];
    // A always contains A.index, B always contains B.thumb. These anatomical
    // labels survive rotation, reversed winding and screen-position exchange.
    const ids = ['A', 'B'];
    const regions = [], regionIds = [];
    let area = 0;
    for (let i = 0; i < 2; i++) {
      const lobeArea = polygonArea(triangles[i]);
      const threshold = baseArea * (activeRegionIds.includes(ids[i]) ? 0.65 : 1.25);
      if (lobeArea >= threshold) {
        regions.push(triangles[i]); regionIds.push(ids[i]); area += lobeArea;
      }
    }
    if (!regions.length) return invalid('Open the frame a little wider');
    return {
      valid: true, reason: 'Bowtie tracked', polygon, regions, regionIds, kind: 'bowtie', intersection, area,
      geometryState: regions.length < 2 || hit.kind === 'touch' || Math.min(...triangles.map(polygonArea)) < baseArea * 8 ? 'near-degenerate' : 'stable',
    };
  }
  const area = polygonArea(polygon);
  if (area < baseArea * (retain ? 0.65 : 1.25)) return invalid('Make a larger frame');
  let minimumDistance = Infinity;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minimumDistance = Math.min(minimumDistance, distance(polygon[i], polygon[j]));
  return {
    valid: true, reason: 'Frame tracked', polygon, regions: [polygon], regionIds: ['frame'],
    kind: 'quadrilateral', intersection: null, area,
    geometryState: area < baseArea * 8 || minimumDistance < Math.sqrt(spreadSquared) * 0.025 ? 'near-degenerate' : 'stable',
  };
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
    this.collapsedAt = null;
    this.currentGeometryState = 'lost';
  }

  // Coordinates have already been smoothed/predicted by HandIdentityTracker.
  // observedAt is the older hand's real observation timestamp: predicting or
  // redrawing a stale pose must not extend its lifetime indefinitely.
  update(points, timestamp, width, height, { observedAt = timestamp } = {}) {
    const retaining = this.geometry !== null && timestamp - this.lastValid < this.holdMs + this.fadeMs
      && (this.collapsedAt === null || timestamp - this.collapsedAt < 80 + this.fadeMs);
    const validation = validateFrame(points, width, height, {
      retain: retaining,
      activeRegionIds: retaining ? this.geometry.regionIds : [],
    });
    this.measurementValid = validation.valid;
    this.currentGeometryState = validation.geometryState;
    if (validation.valid || validation.geometryState === 'lost') this.collapsedAt = null;
    else if (this.collapsedAt === null) this.collapsedAt = timestamp;
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
    // Actual collapse gets a shorter hold than missing detection. Neither
    // repeated collapsed samples nor predicted points refresh the lifetime.
    const collapseAge = this.collapsedAt === null ? 0 : timestamp - this.collapsedAt;
    if (!this.geometry || age >= this.holdMs + this.fadeMs || collapseAge >= 80 + this.fadeMs) {
      return { polygon: null, regions: [], regionIds: [], opacity: 0, state: 'searching', reason: this.reason, kind: null, geometryState: this.currentGeometryState };
    }
    const fadeOut = age <= this.holdMs ? 1 : 1 - (age - this.holdMs) / this.fadeMs;
    const fadeIn = Math.min(1, Math.max(0, (timestamp - this.acquiredAt) / 100));
    return {
      ...this.geometry, reason: this.reason, geometryState: this.currentGeometryState,
      opacity: Math.min(fadeIn, fadeOut, collapseAge <= 80 ? 1 : 1 - (collapseAge - 80) / this.fadeMs),
      state: this.measurementValid && age <= 80 ? 'tracked' : age <= 150 && this.measurementValid ? 'predicting' : 'holding',
    };
  }
}
