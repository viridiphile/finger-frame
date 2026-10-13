const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// A hull is appropriate for the small palm silhouette only. The finger frame
// never uses a hull: its anatomical connections are retained in frameGeometry.
function palmHull(points) {
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

export function handSilhouette(landmarks, width, height) {
  if (landmarks?.length !== 21 || !landmarks.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(landmarks[0], landmarks[9]);
  const scale = Math.max(palmWidth, palmLength * 0.65);
  if (scale < 3 || scale > Math.hypot(width, height) * 0.55) return null;
  const palm = palmHull([0, 1, 2, 5, 9, 13, 17].map((index) => landmarks[index]));
  if (palm.length < 3) return null;
  const segments = [], joints = [];
  for (let finger = 0; finger < CHAINS.length; finger++) {
    const chain = CHAINS[finger];
    if (chain.some((index, i) => i > 0 && distance(landmarks[index], landmarks[chain[i - 1]]) > scale * 1.7)) continue;
    const baseRadius = Math.max(1.5, Math.min(Math.min(width, height) * 0.04,
      scale * [0.11, 0.09, 0.09, 0.085, 0.07][finger]));
    const radii = [1.05, 0.94, 0.8, 0.62].map((factor) => baseRadius * factor);
    chain.forEach((index, i) => joints.push({ point: landmarks[index], radius: radii[i] }));
    for (let i = 0; i < chain.length - 1; i++) {
      const a = landmarks[chain[i]], b = landmarks[chain[i + 1]], length = distance(a, b);
      if (length < 0.01) continue;
      const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
      segments.push([
        { x: a.x + nx * radii[i], y: a.y + ny * radii[i] },
        { x: a.x - nx * radii[i], y: a.y - ny * radii[i] },
        { x: b.x - nx * radii[i + 1], y: b.y - ny * radii[i + 1] },
        { x: b.x + nx * radii[i + 1], y: b.y + ny * radii[i + 1] },
      ]);
    }
  }
  return { palm, segments, joints };
}

export function silhouettePath(silhouette) {
  const path = new Path2D();
  const polygon = (points) => {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
    path.closePath();
  };
  polygon(silhouette.palm);
  for (const segment of silhouette.segments) polygon(segment);
  for (const { point, radius } of silhouette.joints) {
    path.moveTo(point.x + radius, point.y);
    path.arc(point.x, point.y, radius, 0, Math.PI * 2);
    path.closePath();
  }
  return path;
}

export class ForegroundHandMask {
  constructor() {
    this.raw = document.createElement('canvas');
    this.feathered = document.createElement('canvas');
    this.restoration = document.createElement('canvas');
    this.rawContext = this.raw.getContext('2d');
    this.featherContext = this.feathered.getContext('2d');
    this.restoreContext = this.restoration.getContext('2d');
  }

  restore(targetContext, source, hands) {
    if (!hands.some((hand) => hand.maskOpacity > 0)) return;
    for (const canvas of [this.raw, this.feathered, this.restoration]) {
      if (canvas.width !== source.width || canvas.height !== source.height) {
        canvas.width = source.width;
        canvas.height = source.height;
      }
    }
    const raw = this.rawContext;
    raw.clearRect(0, 0, source.width, source.height);
    raw.fillStyle = '#fff';
    for (const hand of hands) {
      if (hand.maskOpacity <= 0) continue;
      const silhouette = handSilhouette(hand.landmarks, source.width, source.height);
      if (!silhouette) continue;
      raw.globalAlpha = hand.maskOpacity;
      // A single nonzero fill unions palm/segments/joints without translucent
      // overlap building up into a darker mask for a predicted hand.
      raw.fill(silhouettePath(silhouette));
    }
    raw.globalAlpha = 1;
    const feather = this.featherContext;
    feather.clearRect(0, 0, source.width, source.height);
    feather.filter = 'blur(1.2px)';
    feather.drawImage(this.raw, 0, 0);
    feather.filter = 'none';
    const restoration = this.restoreContext;
    restoration.clearRect(0, 0, source.width, source.height);
    restoration.drawImage(source, 0, 0);
    restoration.globalCompositeOperation = 'destination-in';
    restoration.drawImage(this.feathered, 0, 0);
    restoration.globalCompositeOperation = 'source-over';
    targetContext.drawImage(this.restoration, 0, 0);
  }
}
