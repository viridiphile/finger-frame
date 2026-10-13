export const SKETCH_DEFAULTS = Object.freeze({ sensitivity: 0.62, lineIntensity: 0.78, shadingIntensity: 0.28 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const TILE = 32;

export function createSketchBuffers(width, height, capacity = width * height) {
  const tiles = Math.ceil(width / TILE) * Math.ceil(height / TILE);
  return {
    capacity,
    gray: new Float32Array(capacity), soft: new Float32Array(capacity),
    gx: new Float32Array(capacity), gy: new Float32Array(capacity),
    magnitude: new Float32Array(capacity), thin: new Float32Array(capacity),
    tileSum: new Float32Array(tiles), tileSquares: new Float32Array(tiles),
    thresholds: new Float32Array(tiles),
  };
}

// Mutates ImageData-like RGBA bytes. No DOM dependency, so the real algorithm
// can be tested on exact images, including weak edges and narrow contours.
export function pencilSketchPixels(image, buffers = createSketchBuffers(image.width, image.height), parameters = SKETCH_DEFAULTS) {
  const { width, height, data } = image;
  const count = width * height;
  if (buffers.capacity < count) throw new RangeError('Sketch buffers are too small for the image.');
  const sensitivity = clamp(parameters.sensitivity ?? SKETCH_DEFAULTS.sensitivity, 0, 1);
  const lineIntensity = clamp(parameters.lineIntensity ?? SKETCH_DEFAULTS.lineIntensity, 0, 1);
  const shadingIntensity = clamp(parameters.shadingIntensity ?? SKETCH_DEFAULTS.shadingIntensity, 0, 1);
  const { gray, soft, gx, gy, magnitude, thin } = buffers;
  const columns = Math.ceil(width / TILE), rows = Math.ceil(height / TILE), tileCount = columns * rows;
  if (buffers.thresholds.length < tileCount) {
    buffers.tileSum = new Float32Array(tileCount);
    buffers.tileSquares = new Float32Array(tileCount);
    buffers.thresholds = new Float32Array(tileCount);
  }
  const { tileSum, tileSquares, thresholds } = buffers;
  tileSum.fill(0, 0, tileCount);
  tileSquares.fill(0, 0, tileCount);
  thin.fill(0, 0, count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
  }
  // Only 18% of a small cross-kernel blur: fine eyes/hair are not blurred away.
  for (let y = 0; y < height; y++) {
    const above = Math.max(0, y - 1) * width, below = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const neighborhood = (gray[i] * 4 + gray[above + x] + gray[below + x]
        + gray[y * width + Math.max(0, x - 1)] + gray[y * width + Math.min(width - 1, x + 1)]) / 8;
      soft[i] = gray[i] * 0.82 + neighborhood * 0.18;
    }
  }
  // Scharr gradients preserve diagonal detail. Scale by 32 to put magnitude
  // in approximately the same units as a one-pixel luminance change.
  for (let y = 0; y < height; y++) {
    const above = Math.max(0, y - 1) * width, below = Math.min(height - 1, y + 1) * width;
    const tileRow = Math.floor(y / TILE) * columns;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, left = Math.max(0, x - 1), right = Math.min(width - 1, x + 1);
      gx[i] = (3 * (soft[above + right] - soft[above + left])
        + 10 * (soft[y * width + right] - soft[y * width + left])
        + 3 * (soft[below + right] - soft[below + left])) / 32;
      gy[i] = (3 * (soft[below + left] - soft[above + left])
        + 10 * (soft[below + x] - soft[above + x])
        + 3 * (soft[below + right] - soft[above + right])) / 32;
      const m = magnitude[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
      const tile = tileRow + Math.floor(x / TILE);
      tileSum[tile] += m;
      tileSquares[tile] += m * m;
    }
  }
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < columns; tx++) {
      const tile = ty * columns + tx;
      const pixels = Math.min(TILE, width - tx * TILE) * Math.min(TILE, height - ty * TILE);
      const mean = tileSum[tile] / pixels;
      const deviation = Math.sqrt(Math.max(0, tileSquares[tile] / pixels - mean * mean));
      // Local statistics retain weak facial contours in low-contrast areas.
      thresholds[tile] = clamp(2.5 + mean * 0.1 + deviation * 0.14, 3, 18) * (1.6 - sensitivity * 1.2);
    }
  }
  // Non-maximum suppression along four quantized gradient directions. A
  // strict tie on one side keeps a flat two-pixel ridge only one pixel wide.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x, m = magnitude[i];
      const threshold = thresholds[Math.floor(y / TILE) * columns + Math.floor(x / TILE)];
      if (m < threshold) continue;
      const ax = Math.abs(gx[i]), ay = Math.abs(gy[i]);
      let step;
      if (ay <= ax * 0.41421356) step = 1;
      else if (ay >= ax * 2.41421356) step = width;
      else step = gx[i] * gy[i] >= 0 ? width + 1 : width - 1;
      if (m >= magnitude[i - step] && m > magnitude[i + step]) thin[i] = m;
    }
  }
  const originX = parameters.originX ?? 0, originY = parameters.originY ?? 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const threshold = thresholds[Math.floor(y / TILE) * columns + Math.floor(x / TILE)];
      const line = thin[i] ? clamp((thin[i] - threshold) / (threshold * 1.5 + 8), 0, 1) : 0;
      const darkness = (255 - gray[i]) / 255;
      const px = Math.floor(x + originX), py = Math.floor(y + originY);
      const hatch = (px + py) % 9 === 0 ? darkness * shadingIntensity * 8 : 0;
      const grain = ((px * 17 + py * 31) % 7 - 3) * darkness * shadingIntensity * 0.35;
      const value = clamp(255 - darkness * shadingIntensity * 166 - line * lineIntensity * 205 - hatch + grain, 0, 255);
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
  }
  return image;
}

export class PencilSketch {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.buffers = null;
    this.parameters = { ...SKETCH_DEFAULTS, originX: 0, originY: 0 };
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  setParameters(parameters) {
    for (const name of ['sensitivity', 'lineIntensity', 'shadingIntensity']) {
      if (Number.isFinite(parameters[name])) this.parameters[name] = clamp(parameters[name], 0, 1);
    }
  }

  process(source, polygon = null) {
    let left = 0, top = 0, right = source.width, bottom = source.height;
    if (polygon) {
      // The 3-pixel border supports noise/gradient/NMS neighborhoods. Native
      // region sampling preserves much more face detail than shrinking a whole
      // camera frame to 480px. Both bowtie lobes share this single region.
      left = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p.x))) - 3);
      top = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p.y))) - 3);
      right = Math.min(source.width, Math.ceil(Math.max(...polygon.map((p) => p.x))) + 3);
      bottom = Math.min(source.height, Math.ceil(Math.max(...polygon.map((p) => p.y))) + 3);
    }
    this.bounds.x = left;
    this.bounds.y = top;
    this.bounds.width = right - left;
    this.bounds.height = bottom - top;
    // Only unusually large regions are scaled; ordinary finger frames retain
    // their source resolution. Float buffers grow by capacity, not per resize.
    const scale = Math.min(1, 1024 / Math.max(this.bounds.width, this.bounds.height));
    const width = Math.max(1, Math.round(this.bounds.width * scale));
    const height = Math.max(1, Math.round(this.bounds.height * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.buffers || this.buffers.capacity < width * height) {
      const capacity = Math.ceil(width * height / 65536) * 65536;
      this.buffers = createSketchBuffers(width, height, capacity);
    }
    this.parameters.originX = left * scale;
    this.parameters.originY = top * scale;
    this.context.drawImage(source, left, top, this.bounds.width, this.bounds.height, 0, 0, width, height);
    const image = this.context.getImageData(0, 0, width, height);
    pencilSketchPixels(image, this.buffers, this.parameters);
    this.context.putImageData(image, 0, 0);
    return this.canvas;
  }
}
