import { handSilhouette, silhouettePath } from './handMask.js';
import { drawStudyScene } from './demoScene.js';

// The scene stays still; existing simulated hands provide all demo motion.
export function drawDemoScene(ctx, width, height, timestamp) {
  drawStudyScene(ctx, width, height);
}

export function demoFingertips(width, height, timestamp) {
  return demoHands(width, height, timestamp).flatMap((hand) => [4, 8].map((index, finger) => ({
    ...hand.landmarks[index], hand: hand.id, finger,
  })));
}

const eased = (time, start, end) => {
  const progress = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return (1 - Math.cos(progress * Math.PI)) / 2;
};

export function demoPhase(timestamp) {
  const t = ((timestamp / 1000) % 32 + 32) % 32;
  if (t < 4) return 'Normal frame';
  if (t < 8) return 'Turning into a bowtie';
  if (t < 12) return 'Bowtie · two filtered lobes';
  if (t < 18) return 'Hand interchange · A and B keep their identities';
  if (t < 22) return 'Returning to a normal frame';
  if (t < 26) return 'Normal frame · A is now on the right';
  return 'Returning to the starting positions';
}

export function demoHands(width, height, timestamp) {
  const t = ((timestamp / 1000) % 32 + 32) % 32;
  const exchange = eased(t, 12, 18) - eased(t, 26, 32);
  const flip = eased(t, 4, 8) - eased(t, 18, 22);
  // Periodic, smooth gestures make automatic Motion Glitch demonstrable. All
  // effects use the same pose, so selecting a mode never repositions the hands.
  const phase = t * Math.PI / 4;
  const center = { x: width * (0.51 + 0.08 * Math.sin(phase * 2)), y: height * (0.52 + 0.025 * Math.sin(phase * 3)) };
  const breath = 1 + 0.08 * Math.sin(phase * 4);
  const frameWidth = width * (0.43 + Math.sin(t * Math.PI / 16) * 0.025) * breath;
  const frameHeight = height * (0.45 + Math.sin(t * Math.PI / 16) * 0.025) * breath;
  const rotation = Math.sin(t * Math.PI / 16) * 0.11 + 0.24 * Math.sin(phase * 3);
  return [0, 1].map((id) => {
    const side = id === 0 ? -1 : 1;
    const cx = side * frameWidth / 2 * (1 - exchange * 2);
    const cy = side * Math.sin(exchange * Math.PI) * height * 0.16;
    const localAngle = id === 1 ? flip * Math.PI : 0;
    const unit = Math.min(width / 960, height / 600);
    const halfHeight = frameHeight / 2;
    const base = [
      [side * 75, 55], [side * 57, 52], [side * 38, 68], [side * 20, 105], [0, halfHeight / unit],
      [side * 45, 0], [side * 26, -46], [side * 10, -90], [0, -halfHeight / unit],
      [side * 65, -3], [side * 78, -35], [side * 83, -60], [side * 86, -81],
      [side * 81, 7], [side * 99, -19], [side * 111, -41], [side * 119, -55],
      [side * 91, 25], [side * 114, 15], [side * 132, 4], [side * 145, -4],
    ];
    const landmarks = base.map(([bx, by]) => {
      const x = bx * unit * Math.cos(localAngle) - by * unit * Math.sin(localAngle) + cx;
      const y = bx * unit * Math.sin(localAngle) + by * unit * Math.cos(localAngle) + cy;
      return { x: center.x + x * Math.cos(rotation) - y * Math.sin(rotation), y: center.y + x * Math.sin(rotation) + y * Math.cos(rotation) };
    });
    return { id, landmarks, handedness: id === 0 ? 'Left' : 'Right', score: 0.99, maskOpacity: 1 };
  });
}

export function drawDemoHands(ctx, hands, width, height) {
  ctx.save();
  for (const hand of hands) {
    const silhouette = handSilhouette(hand.landmarks, width, height);
    if (!silhouette) continue;
    ctx.fillStyle = hand.id === 0 ? '#d9a583' : '#c79270';
    ctx.fill(silhouettePath(silhouette));
    const wrist = hand.landmarks[0];
    ctx.fillStyle = '#775338';
    ctx.font = `${Math.max(10, width / 80)}px ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(hand.id === 0 ? 'A' : 'B', wrist.x, wrist.y - 4);
  }
  ctx.restore();
}
