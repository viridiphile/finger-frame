import { EffectSurface, EffectOutput } from './effectSurface.js';

export const SOLAR_CONFIG = Object.freeze({ threshold: 0.56, reversal: 0.86, lookupSize: 4096 });
const POSITIONS = [0, 0.18, 0.42, 0.66, 0.84, 1];
export const SOLAR_PALETTES = Object.freeze({
  balanced: [[18,23,28],[72,25,39],[202,52,66],[38,182,191],[197,204,191],[245,237,218]],
  warm: [[23,20,26],[79,28,33],[227,46,57],[213,134,115],[207,199,185],[247,236,219]],
  cool: [[14,24,31],[22,44,57],[29,102,114],[22,187,205],[184,208,205],[229,241,238]],
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function solarizedTone(luminance) {
  const y = clamp(luminance, 0, 1), threshold = SOLAR_CONFIG.threshold;
  if (y <= threshold) return 0.94 * Math.sin(y / threshold * Math.PI / 2);
  const t = (y - threshold) / (1 - threshold);
  // Both branches meet at the same value and zero slope. Bright tones reverse
  // progressively, rather than jumping into a simple RGB negative.
  return 0.94 * (1 - SOLAR_CONFIG.reversal * t * t * (3 - 2 * t));
}

export function paletteColor(tone, palette = 'balanced') {
  const colors = SOLAR_PALETTES[palette];
  if (!colors) throw new RangeError('Unknown solarization palette.');
  const t = clamp(tone, 0, 1);
  let stop = 0;
  while (stop < POSITIONS.length - 2 && t > POSITIONS[stop + 1]) stop++;
  const weight = (t - POSITIONS[stop]) / (POSITIONS[stop + 1] - POSITIONS[stop]);
  return colors[stop].map((value, channel) => value + (colors[stop + 1][channel] - value) * weight);
}

// Cache palette interpolation once. Interpolate adjacent entries for continuous
// output without rebuilding a palette or allocating colors per video pixel.
export const SOLAR_LOOKUPS = Object.fromEntries(Object.keys(SOLAR_PALETTES).map((name) => {
  const table = new Float32Array(SOLAR_CONFIG.lookupSize * 3);
  for (let i = 0; i < SOLAR_CONFIG.lookupSize; i++) table.set(paletteColor(i / (SOLAR_CONFIG.lookupSize - 1), name), i * 3);
  return [name, table];
}));

export function solarizePixels(source, outputs) {
  const { width, height, data } = source;
  for (const { image, palette } of outputs) {
    if (!SOLAR_LOOKUPS[palette] || image.data.length < width * height * 4) throw new RangeError('Invalid solarization output.');
  }
  for (let p = 0; p < width * height * 4; p += 4) {
    const y = (data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722) / 255;
    const index = solarizedTone(y) * (SOLAR_CONFIG.lookupSize - 1);
    const low = Math.floor(index), high = Math.min(SOLAR_CONFIG.lookupSize - 1, low + 1), fraction = index - low;
    // Shared luminance/curve pass, including when two lobes need different colors.
    for (const { image, palette } of outputs) {
      const table = SOLAR_LOOKUPS[palette];
      for (let channel = 0; channel < 3; channel++) image.data[p + channel] = table[low * 3 + channel]
        + (table[high * 3 + channel] - table[low * 3 + channel]) * fraction;
      image.data[p + 3] = 255;
    }
  }
}

export class SolarizeEffect extends EffectSurface {
  constructor() {
    super();
    this.outputs = { balanced: new EffectOutput(), warm: new EffectOutput(), cool: new EffectOutput() };
  }

  process(source, frame) {
    const image = this.sample(source, frame.polygon);
    const palettes = frame.kind === 'bowtie' ? frame.regionIds.map((id) => id === 'A' ? 'warm' : 'cool') : ['balanced'];
    const outputs = palettes.map((palette) => ({ palette, image: this.outputs[palette].resize(image.width, image.height) }));
    solarizePixels(image, outputs);
    return outputs.map(({ palette }, index) => ({
      canvas: this.outputs[palette].commit(), bounds: this.bounds,
      regions: frame.kind === 'bowtie' ? [frame.regions[index]] : frame.regions,
      regionIds: frame.kind === 'bowtie' ? [frame.regionIds[index]] : ['frame'],
    }));
  }
}
