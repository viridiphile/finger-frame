export function createSketchBuffers(width, height) {
  const count = width * height;
  return {
    gray: new Float32Array(count),
    soft: new Float32Array(count),
    blur: new Float32Array(count),
    scratch: new Float32Array(count),
  };
}

// Separable box blur: sliding sums make the work linear in pixel count.
// Border samples repeat the nearest pixel, avoiding a dark image border.
function boxBlur(source, target, scratch, width, height, radius) {
  const diameter = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += source[row + Math.max(0, Math.min(width - 1, k))];
    for (let x = 0; x < width; x++) {
      scratch[row + x] = sum / diameter;
      sum += source[row + Math.min(width - 1, x + radius + 1)] - source[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += scratch[Math.max(0, Math.min(height - 1, k)) * width + x];
    for (let y = 0; y < height; y++) {
      target[y * width + x] = sum / diameter;
      sum += scratch[Math.min(height - 1, y + radius + 1) * width + x] - scratch[Math.max(0, y - radius) * width + x];
    }
  }
}

// Mutates an ImageData-like object. Keeping this independent of the DOM makes
// the actual pixel algorithm testable with small, known input images.
export function pencilSketchPixels(image, buffers = createSketchBuffers(image.width, image.height)) {
  const { width, height, data } = image;
  const { gray, soft, blur, scratch } = buffers;
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
  }
  boxBlur(gray, soft, scratch, width, height, 1);
  boxBlur(soft, blur, scratch, width, height, 4);
  for (let y = 0; y < height; y++) {
    const above = Math.max(0, y - 1) * width, below = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, left = Math.max(0, x - 1), right = Math.min(width - 1, x + 1);
      const gx = -soft[above + left] + soft[above + right]
        - 2 * soft[y * width + left] + 2 * soft[y * width + right]
        - soft[below + left] + soft[below + right];
      const gy = -soft[above + left] - 2 * soft[above + x] - soft[above + right]
        + soft[below + left] + 2 * soft[below + x] + soft[below + right];
      const edge = Math.max(0, Math.hypot(gx, gy) / 4 - 8);
      // Color dodge of grayscale and its blurred inverse simplifies to this
      // division. Sobel adds contour lines; faint hatching shades dark areas.
      const dodge = blur[i] < 1 ? 255 : Math.min(255, soft[i] * 255 / (blur[i] + 1));
      const darkness = (255 - soft[i]) / 255;
      const hatch = (x + y) % 6 === 0 ? darkness * 16 : 0;
      const grain = ((x * 17 + y * 31) % 7 - 3) * 0.45;
      const value = Math.max(0, Math.min(255, dodge * 0.8 + 51 - edge * 1.15 - darkness * 26 - hatch + grain));
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
  }

  process(source) {
    // Full-frame processing keeps the sketch aligned with the live image even
    // while the polygon rotates. Only the final compositing step is clipped.
    const scale = Math.min(1, 480 / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    if (this.canvas.width !== width || this.canvas.height !== height || !this.buffers) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.buffers = createSketchBuffers(width, height);
    }
    this.context.drawImage(source, 0, 0, width, height);
    const image = this.context.getImageData(0, 0, width, height);
    pencilSketchPixels(image, this.buffers);
    this.context.putImageData(image, 0, 0);
    return this.canvas;
  }
}
