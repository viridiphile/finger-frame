// One camera-region sampling path shared by all effects. Ordinary regions use
// native video pixels; only unusually large crops are reduced to 1024px.
export class EffectSurface {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.scale = 1;
  }

  sample(source, polygon = null) {
    let left = 0, top = 0, right = source.width, bottom = source.height;
    if (polygon) {
      left = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p.x))) - 3);
      top = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p.y))) - 3);
      right = Math.min(source.width, Math.ceil(Math.max(...polygon.map((p) => p.x))) + 3);
      bottom = Math.min(source.height, Math.ceil(Math.max(...polygon.map((p) => p.y))) + 3);
    }
    Object.assign(this.bounds, { x: left, y: top, width: right - left, height: bottom - top });
    if (this.bounds.width <= 0 || this.bounds.height <= 0) throw new RangeError('Empty effect region.');
    this.scale = Math.min(1, 1024 / Math.max(this.bounds.width, this.bounds.height));
    const width = Math.max(1, Math.round(this.bounds.width * this.scale));
    const height = Math.max(1, Math.round(this.bounds.height * this.scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.context.drawImage(source, left, top, this.bounds.width, this.bounds.height, 0, 0, width, height);
    return this.context.getImageData(0, 0, width, height);
  }
}

// ImageData dimensions are immutable, but its large underlying byte buffer can
// be reused by capacity while inexpensive views adapt to a changing crop.
export class EffectOutput {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.bytes = null;
    this.image = null;
  }

  resize(width, height) {
    const count = width * height * 4;
    if (!this.bytes || this.bytes.length < count) this.bytes = new Uint8ClampedArray(Math.ceil(count / 262144) * 262144);
    if (!this.image || this.image.width !== width || this.image.height !== height || this.image.data.buffer !== this.bytes.buffer) {
      this.canvas.width = width; this.canvas.height = height;
      this.image = new ImageData(this.bytes.subarray(0, count), width, height);
    }
    return this.image;
  }

  commit() { this.context.putImageData(this.image, 0, 0); return this.canvas; }
}
