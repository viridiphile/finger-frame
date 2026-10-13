const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const deadZone = (value, zone) => Math.abs(value) <= zone ? 0 : Math.sign(value) * (Math.abs(value) - zone);
export const ZERO_MOTION = Object.freeze({ intensity: 0, translation: 0, angular: 0, scale: 0, angle: 0, vx: 0, vy: 0, interrupted: true });

export function frameFeatures(polygon, previousAngle = 0) {
  const center = polygon.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  const spread = Math.sqrt(polygon.reduce((sum, p) => sum + ((p.x - center.x) ** 2 + (p.y - center.y) ** 2) / 4, 0));
  const index = polygon.find((p) => p.hand === 0 && p.finger === 1) ?? polygon[0];
  const thumb = polygon.find((p) => p.hand === 0 && p.finger === 0) ?? polygon[3];
  const length = Math.hypot(index.x - thumb.x, index.y - thumb.y);
  // A.thumb → A.index is an anatomical axis. It never reverses merely because
  // A passes to the other side of B. Keep orientation when this axis collapses.
  const angle = length > Math.max(1, spread * 0.02) ? Math.atan2(index.y - thumb.y, index.x - thumb.x) : previousAngle;
  return { center, spread: Math.max(1, spread), angle };
}

export class FrameMotion {
  constructor() { this.reset(); }

  reset() {
    this.previous = null;
    this.lastTime = null;
    this.values = { ...ZERO_MOTION, geometryState: 'lost' };
  }

  update(frame, timestamp) {
    if (!Number.isFinite(timestamp)) return this.values;
    const dt = this.lastTime === null ? 0 : Math.max(0, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    const valid = frame.polygon?.length === 4 && frame.polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      && frame.opacity > 0 && frame.state === 'tracked' && frame.geometryState !== 'degenerate';
    this.values.geometryState = frame.geometryState ?? 'lost';
    if (!valid) {
      const decay = Math.exp(-Math.min(dt, 1) / 0.16);
      for (const name of ['translation', 'angular', 'scale', 'vx', 'vy', 'intensity']) this.values[name] *= decay;
      if (this.values.intensity < 0.002) this.values.intensity = 0;
      this.previous = null; this.values.interrupted = true;
      return this.values;
    }
    const features = frameFeatures(frame.polygon, this.previous?.angle ?? this.values.angle);
    if (!this.previous || dt <= 0 || dt > 0.25) {
      Object.assign(this.values, ZERO_MOTION, { angle: features.angle, geometryState: frame.geometryState ?? 'stable' });
      this.previous = features;
      return this.values;
    }
    const reference = Math.max(8, features.spread + this.previous.spread);
    let vx = (features.center.x - this.previous.center.x) / reference / dt;
    let vy = (features.center.y - this.previous.center.y) / reference / dt;
    const speed = Math.hypot(vx, vy);
    const normalized = speed > 0.08 ? Math.min(3, speed - 0.08) / speed : 0;
    vx *= normalized; vy *= normalized;
    // atan2(sin(delta),cos(delta)) unwraps the ±pi branch cut.
    const delta = Math.atan2(Math.sin(features.angle - this.previous.angle), Math.cos(features.angle - this.previous.angle));
    const angular = clamp(deadZone(delta / dt, 0.12), -6, 6);
    const scale = clamp(deadZone(Math.log(features.spread / this.previous.spread) / dt, 0.06), -3, 3);
    const alpha = 1 - Math.exp(-dt / 0.11);
    this.values.vx += alpha * (vx - this.values.vx);
    this.values.vy += alpha * (vy - this.values.vy);
    this.values.translation = Math.hypot(this.values.vx, this.values.vy);
    this.values.angular += alpha * (angular - this.values.angular);
    this.values.scale += alpha * (scale - this.values.scale);
    this.values.angle += delta;
    const damping = frame.geometryState === 'near-degenerate' ? 0.35 : 1;
    const target = clamp((this.values.translation * 0.65 + Math.abs(this.values.angular) * 0.15 + Math.abs(this.values.scale) * 0.35) * damping, 0, 1);
    const envelope = 1 - Math.exp(-dt / (target > this.values.intensity ? 0.07 : 0.24));
    this.values.intensity += envelope * (target - this.values.intensity);
    this.values.interrupted = false;
    this.previous = features;
    return this.values;
  }
}
