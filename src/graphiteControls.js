// Percentages describe artistic control levels, not literal filter weights.
// Small floors retain a recognizable drawing even with all three at 0%.
export const GRAPHITE_LEVELS = Object.freeze([0, 25, 50, 75, 100]);
export const GRAPHITE_MAPPING = Object.freeze({
  sensitivity: Object.freeze([0.22, 0.40, 0.62, 0.80, 0.95]),
  lineIntensity: Object.freeze([0.24, 0.46, 0.66, 0.82, 0.96]),
  shadingIntensity: Object.freeze([0.12, 0.20, 0.28, 0.40, 0.54]),
});
export const GRAPHITE_DEFAULT_LEVELS = Object.freeze({ sensitivity: 50, lineIntensity: 75, shadingIntensity: 50 });

export function graphiteParameters(levels) {
  const result = {};
  for (const name of Object.keys(GRAPHITE_MAPPING)) {
    const index = GRAPHITE_LEVELS.indexOf(levels[name]);
    if (index === -1) throw new RangeError(`${name} must be 0, 25, 50, 75 or 100.`);
    result[name] = GRAPHITE_MAPPING[name][index];
  }
  return result;
}

export class GraphiteControls {
  constructor() {
    this.levels = { ...GRAPHITE_DEFAULT_LEVELS };
    this.parameters = graphiteParameters(this.levels);
  }

  set(name, level) {
    if (!(name in GRAPHITE_MAPPING) || !GRAPHITE_LEVELS.includes(level)) throw new RangeError('Invalid Graphite control level.');
    if (this.levels[name] === level) return false;
    this.levels[name] = level;
    this.parameters[name] = GRAPHITE_MAPPING[name][GRAPHITE_LEVELS.indexOf(level)];
    return true;
  }
}
