// All geometry uses the same mirrored canvas coordinates as the preview.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const copyPoints = (points) => points.map((point) => ({ ...point }));

export function extractFingertips(result, width, height) {
  if (result?.landmarks?.length !== 2) return null;
  const points = result.landmarks.flatMap((hand, handId) =>
    [4, 8].map((landmark, finger) => {
      const point = hand[landmark];
      return { x: (1 - point?.x) * width, y: point?.y * height, hand: handId, finger };
    }),
  );
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ? points : null;
}

export function polygonArea(points) {
  return Math.abs(points.reduce((area, point, i) => {
    const next = points[(i + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

// A convex hull avoids self-intersection, and rejects a fingertip inside the
// other three. Unlike sorting by screen x, it works at every frame rotation.
export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list) => {
    const hull = [];
    for (const point of list) {
      while (hull.length >= 2 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop();
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function validateFrame(points, width, height) {
  const invalid = (reason) => ({ valid: false, reason, polygon: null });
  if (!points || points.length !== 4 || width <= 0 || height <= 0) return invalid('Show both hands');
  if (!points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)) return invalid('Keep all four fingertips in view');
  // Each hand must supply one thumb and one index; missing identities are invalid.
  const ids = new Set(points.map((p) => `${p.hand}:${p.finger}`));
  if (![0, 1].every((hand) => [0, 1].every((finger) => ids.has(`${hand}:${finger}`)))) return invalid('Show both hands');
  const polygon = convexHull(points);
  if (polygon.length !== 4) return invalid('Uncross and spread your fingers');
  const area = polygonArea(polygon);
  if (area < width * height * 0.012) return invalid('Make a larger frame');
  const minEdge = Math.min(width, height) * 0.045;
  for (let i = 0; i < 4; i++) {
    const a = polygon[i], b = polygon[(i + 1) % 4], c = polygon[(i + 2) % 4];
    const ab = distance(a, b), bc = distance(b, c);
    if (ab < minEdge) return invalid('Spread your fingertips apart');
    if (Math.abs(cross(a, b, c)) / (ab * bc) < 0.12) return invalid('Open the frame a little wider');
    // A hand's thumb and index should form a boundary edge, not a diagonal.
    const partner = polygon.findIndex((p) => p.hand === a.hand && p.finger !== a.finger);
    if ((partner - i + 4) % 4 === 2) return invalid('Uncross your hands');
  }
  return { valid: true, reason: 'Frame tracked', polygon };
}

export class FrameStabilizer {
  constructor({ smoothingMs = 75, holdMs = 220, fadeMs = 160 } = {}) {
    this.smoothingMs = smoothingMs;
    this.holdMs = holdMs;
    this.fadeMs = fadeMs;
    this.reset();
  }

  reset() {
    this.points = null;
    this.lastValid = -Infinity;
    this.lastUpdate = null;
    this.acquiredAt = null;
    this.reason = 'Show both hands';
    this.measurementValid = false;
  }

  update(points, timestamp, width, height) {
    // Expire old identities before reacquiring a gesture in a new position.
    if (timestamp - this.lastValid >= this.holdMs + this.fadeMs) this.points = null;
    const validation = validateFrame(points, width, height);
    this.measurementValid = false;
    this.reason = validation.reason;
    if (!validation.valid) return this.snapshot(timestamp);
    let next = copyPoints(points);
    if (this.points) {
      // MediaPipe's result array can change hand order. Compare the two possible
      // hand assignments, keeping thumb/index identity within each hand.
      const cost = (swapped) => next.reduce((sum, p) => {
        const previous = this.points.find((old) => old.hand === (swapped ? 1 - p.hand : p.hand) && old.finger === p.finger);
        return sum + distance(p, previous) ** 2;
      }, 0);
      if (cost(true) < cost(false)) next = next.map((p) => ({ ...p, hand: 1 - p.hand }));
      const largestJump = Math.max(...next.map((p) => distance(p, this.points.find((old) => old.hand === p.hand && old.finger === p.finger))));
      if (largestJump > Math.hypot(width, height) * 0.23) {
        this.reason = 'Reacquiring frame';
        return this.snapshot(timestamp);
      }
      const elapsed = Math.min(100, Math.max(1, timestamp - this.lastUpdate));
      const alpha = 1 - Math.exp(-elapsed / this.smoothingMs);
      next = next.map((p) => {
        const old = this.points.find((previous) => previous.hand === p.hand && previous.finger === p.finger);
        return { ...p, x: old.x + alpha * (p.x - old.x), y: old.y + alpha * (p.y - old.y) };
      });
      const smoothedValidation = validateFrame(next, width, height);
      if (!smoothedValidation.valid) {
        this.reason = 'Reacquiring frame';
        return this.snapshot(timestamp);
      }
    } else {
      this.acquiredAt = timestamp;
    }
    this.points = next;
    this.lastValid = timestamp;
    this.lastUpdate = timestamp;
    this.measurementValid = true;
    return this.snapshot(timestamp);
  }

  snapshot(timestamp) {
    const age = timestamp - this.lastValid;
    if (!this.points || age >= this.holdMs + this.fadeMs) {
      return { polygon: null, opacity: 0, state: 'searching', reason: this.reason };
    }
    const fadeOut = age <= this.holdMs ? 1 : 1 - (age - this.holdMs) / this.fadeMs;
    const fadeIn = Math.min(1, Math.max(0, (timestamp - this.acquiredAt) / 100));
    return {
      polygon: convexHull(this.points),
      opacity: Math.min(fadeIn, fadeOut),
      state: this.measurementValid && age < 120 ? 'tracked' : 'holding',
      reason: this.reason,
    };
  }
}
