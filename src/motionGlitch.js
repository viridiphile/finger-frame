import { EffectSurface, EffectOutput } from './effectSurface.js';
import { ZERO_MOTION } from './frameMotion.js';

export const GLITCH_CONFIG = Object.freeze({ maxChannelOffset: 10, maxSliceOffset: 14, quietSeparation: 0.35, sliceIntervalMs: 90 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function shiftedChannel(data, width, height, x, y, dx, dy, fx, fy, channel) {
  const x0 = clamp(x + dx, 0, width - 1), x1 = clamp(x + dx + 1, 0, width - 1);
  const y0 = clamp(y + dy, 0, height - 1), y1 = clamp(y + dy + 1, 0, height - 1);
  const top = data[(y0 * width + x0) * 4 + channel] * (1 - fx) + data[(y0 * width + x1) * 4 + channel] * fx;
  const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - fx) + data[(y1 * width + x1) * 4 + channel] * fx;
  return top * (1 - fy) + bottom * fy;
}

export function glitchDisplacement(motion = ZERO_MOTION, sign = 1, resolutionScale = 1) {
  const intensity = clamp(Number.isFinite(motion.intensity) ? motion.intensity : 0, 0, 1);
  const angle = Number.isFinite(motion.angle) ? motion.angle : 0;
  const amplitude = Math.min(GLITCH_CONFIG.maxChannelOffset, GLITCH_CONFIG.quietSeparation + intensity * 9) * resolutionScale;
  return { x: Math.cos(angle) * amplitude * sign, y: Math.sin(angle) * amplitude * sign, intensity };
}

export function motionGlitchPixels(source, output, { motion = ZERO_MOTION, sign = 1, timestamp = 0, originY = 0, resolutionScale = 1 } = {}) {
  const { width, height, data } = source;
  if (output.data.length < data.length) throw new RangeError('Glitch output is too small.');
  const displacement = glitchDisplacement(motion, sign, resolutionScale);
  const intensity = displacement.intensity;
  const phase = Number.isFinite(timestamp) ? Math.floor(timestamp / GLITCH_CONFIG.sliceIntervalMs) : 0;
  const sliceAmplitude = intensity > 0.15 ? GLITCH_CONFIG.maxSliceOffset * intensity * resolutionScale : 0;
  const sliceHeight = Math.max(4, Math.round((6 + (1 - intensity) * 6) * resolutionScale));
  // Fractional channel sampling retains the quiet subpixel separation instead
  // of rounding it away or making small gestures jump by a whole pixel.
  const redX = Math.floor(displacement.x), redY = Math.floor(displacement.y);
  const redFX = displacement.x - redX, redFY = displacement.y - redY;
  const blueX = Math.floor(-displacement.x), blueY = Math.floor(-displacement.y);
  const blueFX = -displacement.x - blueX, blueFY = -displacement.y - blueY;
  for (let y = 0; y < height; y++) {
    const globalY = Math.floor(y + originY), slice = Math.floor(globalY / sliceHeight);
    // A deterministic, motion-gated slice pattern. At rest there is no moving
    // random noise; strong gestures produce short changes at a bounded cadence.
    const hash = ((slice * 17 + phase * 7) % 23 + 23) % 23;
    const shift = hash < 3 + Math.floor(intensity * 8) ? Math.round((hash / 11 - 1) * sliceAmplitude * sign) : 0;
    const scanline = globalY % 4 === 0 ? 1 - (0.018 + intensity * 0.025) : 1;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const gx = clamp(x + shift, 0, width - 1);
      output.data[p] = shiftedChannel(data, width, height, x + shift, y, redX, redY, redFX, redFY, 0) * scanline;
      output.data[p + 1] = data[(y * width + gx) * 4 + 1] * scanline;
      output.data[p + 2] = shiftedChannel(data, width, height, x + shift, y, blueX, blueY, blueFX, blueFY, 2) * scanline;
      output.data[p + 3] = 255;
    }
  }
  return output;
}

export class MotionGlitchEffect extends EffectSurface {
  constructor() {
    super();
    this.outputs = { A: new EffectOutput(), B: new EffectOutput(), frame: new EffectOutput() };
    this.reset();
  }

  reset() { this.startedAt = null; }

  process(source, frame, motion = ZERO_MOTION, timestamp = 0) {
    if (this.startedAt === null || motion.interrupted) this.startedAt = timestamp;
    // Include enough surrounding source pixels for the largest combined shift.
    const image = this.sample(source, frame.polygon, 25);
    const ids = frame.kind === 'bowtie' ? frame.regionIds : ['frame'];
    return ids.map((id, index) => {
      const output = this.outputs[id];
      const result = output.resize(image.width, image.height);
      motionGlitchPixels(image, result, {
        motion, sign: id === 'B' ? -1 : 1, timestamp: timestamp - this.startedAt,
        originY: this.bounds.y * this.scale, resolutionScale: this.scale,
      });
      return { canvas: output.commit(), bounds: this.bounds,
        regions: frame.kind === 'bowtie' ? [frame.regions[index]] : frame.regions, regionIds: [id] };
    });
  }
}
