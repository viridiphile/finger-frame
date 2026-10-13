// Identity and motion are separate from polygon geometry. A/B are persistent
// slots, not "the hand currently on the left/right of the screen".
const PALM = [0, 5, 9, 13, 17];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const copy = (points) => points.map((p) => ({ ...p }));

export function palmCenter(landmarks) {
  return PALM.reduce((center, index) => ({
    x: center.x + landmarks[index].x / PALM.length,
    y: center.y + landmarks[index].y / PALM.length,
  }), { x: 0, y: 0 });
}

export function extractHands(result, width, height) {
  return (result?.landmarks ?? []).slice(0, 2).flatMap((hand, index) => {
    if (hand.length !== 21 || !hand.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return [];
    const category = result.handedness?.[index]?.[0];
    return [{
      // Inference is unmirrored. Coordinates are mirrored exactly once here;
      // the label is an association hint and is never swapped with screen x.
      landmarks: hand.map((p) => ({ x: (1 - p.x) * width, y: p.y * height })),
      handedness: ['Left', 'Right'].includes(category?.categoryName) ? category.categoryName : null,
      score: Number.isFinite(category?.score) ? category.score : 0,
    }];
  });
}

export function fingertipsFromHands(hands) {
  if (hands.length !== 2 || ![0, 1].every((id) => hands.some((hand) => hand.id === id))) return null;
  return hands.flatMap((hand) => [4, 8].map((index, finger) => ({
    ...hand.landmarks[index], hand: hand.id, finger,
  })));
}

export class HandIdentityTracker {
  constructor({ predictionMs = 150, identityMs = 900 } = {}) {
    this.predictionMs = predictionMs;
    this.identityMs = identityMs;
    this.reset();
  }

  reset() { this.tracks = [null, null]; }

  prediction(track, timestamp) {
    const age = Math.max(0, timestamp - track.lastSeen);
    // A damped translation prediction, capped at 150ms. No speculative finger
    // rotations: after the cap, the pose holds until geometry fades away.
    const time = 90 * (1 - Math.exp(-Math.min(age, this.predictionMs) / 90));
    return { x: track.velocity.x * time, y: track.velocity.y * time };
  }

  associationCost(observation, track, timestamp, diagonal) {
    if (!track) return 0.025;
    const offset = this.prediction(track, timestamp);
    const predicted = (index) => ({ x: track.landmarks[index].x + offset.x, y: track.landmarks[index].y + offset.y });
    const center = palmCenter(observation.landmarks);
    const oldCenter = palmCenter(track.landmarks);
    let cost = 0.55 * distance(observation.landmarks[0], predicted(0)) ** 2
      + 0.35 * distance(center, { x: oldCenter.x + offset.x, y: oldCenter.y + offset.y }) ** 2
      + 0.05 * distance(observation.landmarks[4], predicted(4)) ** 2
      + 0.05 * distance(observation.landmarks[8], predicted(8)) ** 2;
    cost /= diagonal ** 2;
    if (observation.score >= 0.8 && track.label && observation.handedness !== track.label) cost += 0.035;
    return cost;
  }

  update(observations, timestamp, width, height) {
    const diagonal = Math.hypot(width, height);
    for (let id = 0; id < 2; id++) {
      if (this.tracks[id] && timestamp - this.tracks[id].lastSeen > this.identityMs) this.tracks[id] = null;
    }
    const valid = observations.filter((hand) => hand.landmarks?.length === 21
      && hand.landmarks.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).slice(0, 2);
    if (!valid.length) return this.snapshot(timestamp);
    let assignments = valid.length === 2 ? [[0, 1], [1, 0]] : [[0], [1]];
    // Only seed identities from reliable distinct labels on first acquisition.
    // Later assignment uses motion and anatomy, even during hand interchange.
    if (!this.tracks.some(Boolean)) {
      const labels = valid.map((hand) => hand.score >= 0.8 ? hand.handedness : null);
      if (valid.length === 2 && labels.includes('Left') && labels.includes('Right')) {
        assignments = [labels.map((label) => label === 'Left' ? 0 : 1)];
      } else if (valid.length === 1 && labels[0]) assignments = [[labels[0] === 'Left' ? 0 : 1]];
    }
    const cost = (assignment) => assignment.reduce((sum, id, i) => sum
      + this.associationCost(valid[i], this.tracks[id], timestamp, diagonal), 0);
    const assignment = assignments.reduce((best, next) => cost(next) < cost(best) ? next : best);
    valid.forEach((hand, index) => this.accept(hand, assignment[index], timestamp, diagonal));
    return this.snapshot(timestamp);
  }

  accept(hand, id, timestamp, diagonal) {
    const old = this.tracks[id];
    const center = palmCenter(hand.landmarks);
    if (!old) {
      this.tracks[id] = {
        id, landmarks: copy(hand.landmarks), rawCenter: center, lastSeen: timestamp,
        velocity: { x: 0, y: 0 }, label: hand.score >= 0.8 ? hand.handedness : null,
        candidateLabel: null, labelEvidence: 0,
      };
      return;
    }
    const dt = Math.max(1, timestamp - old.lastSeen);
    const offset = this.prediction(old, timestamp);
    const palmError = distance(center, { x: palmCenter(old.landmarks).x + offset.x, y: palmCenter(old.landmarks).y + offset.y });
    const palmScale = distance(hand.landmarks[0], hand.landmarks[9]) + distance(hand.landmarks[5], hand.landmarks[17]);
    const tipJump = Math.max(...[4, 8].map((i) => distance(hand.landmarks[i], {
      x: old.landmarks[i].x + offset.x, y: old.landmarks[i].y + offset.y,
    })));
    // Reject the entire pose if a tip is implausible, so a false tip cannot
    // refresh the geometry while the palm mask appears to keep tracking.
    if (palmError > diagonal * 0.14 + Math.min(dt, 150) * diagonal * 0.0005
      || tipJump > diagonal * 0.12 + palmScale * 1.1 + Math.min(dt, 150) * diagonal * 0.0003) return;
    const speed = distance(center, old.rawCenter) / dt;
    const smoothingMs = clamp(90 / (1 + speed / (diagonal * 0.00012)), 28, 90);
    const alpha = 1 - Math.exp(-Math.min(dt, 100) / smoothingMs);
    const vx = (center.x - old.rawCenter.x) / dt, vy = (center.y - old.rawCenter.y) / dt;
    const velocityScale = Math.min(1, diagonal * 0.001 / Math.max(0.0001, Math.hypot(vx, vy)));
    old.velocity.x = old.velocity.x * 0.65 + vx * velocityScale * 0.35;
    old.velocity.y = old.velocity.y * 0.65 + vy * velocityScale * 0.35;
    for (let i = 0; i < 21; i++) {
      const startX = old.landmarks[i].x + offset.x, startY = old.landmarks[i].y + offset.y;
      old.landmarks[i].x = startX + alpha * (hand.landmarks[i].x - startX);
      old.landmarks[i].y = startY + alpha * (hand.landmarks[i].y - startY);
    }
    // Established labels do not flip with a single classification error. An
    // initially unknown label needs three consistent high-score observations.
    if (!old.label && hand.score >= 0.8 && hand.handedness) {
      old.labelEvidence = old.candidateLabel === hand.handedness ? old.labelEvidence + 1 : 1;
      old.candidateLabel = hand.handedness;
      if (old.labelEvidence >= 3) old.label = hand.handedness;
    }
    old.rawCenter = center;
    old.lastSeen = timestamp;
  }

  snapshot(timestamp) {
    return this.tracks.flatMap((track) => {
      if (!track || timestamp - track.lastSeen > this.identityMs) return [];
      const age = Math.max(0, timestamp - track.lastSeen);
      const offset = this.prediction(track, timestamp);
      return [{
        id: track.id, handedness: track.label, lastSeen: track.lastSeen, age,
        landmarks: track.landmarks.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })),
        // Stale silhouettes should not restore background after a hand leaves.
        maskOpacity: clamp(1 - Math.max(0, age - 80) / 70, 0, 1),
      }];
    });
  }
}
