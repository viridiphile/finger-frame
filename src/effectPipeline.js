import { PencilSketch } from './effects.js';
import { SolarizeEffect } from './solarize.js';
import { MotionGlitchEffect } from './motionGlitch.js';
import { ZERO_MOTION } from './frameMotion.js';

export const EFFECT_TYPES = Object.freeze(['graphite', 'solarize', 'motion-glitch']);
export const EFFECT_LABELS = Object.freeze({ graphite: 'Graphite', solarize: 'Solarize', 'motion-glitch': 'Motion Glitch' });

export class EffectPipeline {
  constructor() {
    this.graphite = new PencilSketch();
    this.solarize = new SolarizeEffect();
    this.glitch = new MotionGlitchEffect();
    this.selected = 'graphite';
  }

  select(type) {
    if (!EFFECT_TYPES.includes(type)) throw new RangeError('Unknown visual effect.');
    if (type === this.selected) return false;
    this.selected = type;
    this.resetTemporal();
    return true;
  }

  resetTemporal() { this.glitch.reset(); }

  process(sourceFrame, { frame, motion = ZERO_MOTION, timestamp = 0 }) {
    // Small compatibility normalization also supports standalone renderer
    // fixtures. Camera/demo geometry already supplies anatomical region ids.
    const regions = frame.regions ?? [frame.polygon];
    const geometry = { ...frame, regions, regionIds: frame.regionIds ?? ['frame'] };
    if (this.selected === 'solarize') return this.solarize.process(sourceFrame, geometry);
    if (this.selected === 'motion-glitch') return this.glitch.process(sourceFrame, geometry, motion, timestamp);
    const canvas = this.graphite.process(sourceFrame, frame.polygon);
    return [{ canvas, bounds: this.graphite.bounds, regions, regionIds: geometry.regionIds }];
  }
}
