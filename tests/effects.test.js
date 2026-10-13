import test from 'node:test';
import assert from 'node:assert/strict';
import { pencilSketchPixels, createSketchBuffers } from '../src/effects.js';

function image(width, height, colorAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([...colorAt(x, y), 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

test('the filter produces opaque grayscale from colored input', () => {
  const input = image(12, 10, (x, y) => [x * 20, y * 25, 60]);
  const output = pencilSketchPixels(input);
  for (let p = 0; p < output.data.length; p += 4) {
    assert.equal(output.data[p], output.data[p + 1]);
    assert.equal(output.data[p], output.data[p + 2]);
    assert.equal(output.data[p + 3], 255);
  }
});

test('Sobel produces a dark contour at a known step edge', () => {
  const input = image(32, 24, (x) => x < 16 ? [60, 60, 60] : [235, 235, 235]);
  pencilSketchPixels(input);
  const pixel = (x) => input.data[(12 * 32 + x) * 4];
  assert.ok(pixel(15) < pixel(5) - 35);
  assert.ok(pixel(16) < pixel(26) - 35);
});

test('reused working buffers do not retain pixels from a previous frame', () => {
  const buffers = createSketchBuffers(16, 12);
  pencilSketchPixels(image(16, 12, (x) => x % 3 ? [0, 0, 0] : [255, 255, 255]), buffers);
  const reused = pencilSketchPixels(image(16, 12, () => [120, 140, 100]), buffers);
  const fresh = pencilSketchPixels(image(16, 12, () => [120, 140, 100]));
  assert.deepEqual(reused.data, fresh.data);
});

test('black, white, tiny and narrow images handle blur borders without invalid values', () => {
  for (const [width, height] of [[1, 1], [1, 10], [10, 1], [3, 3]]) {
    for (const value of [0, 128, 255]) {
      const buffers = createSketchBuffers(width, height);
      const result = pencilSketchPixels(image(width, height, () => [value, value, value]), buffers);
      assert.ok([...buffers.blur].every(Number.isFinite));
      assert.ok(result.data[0] > 190);
    }
  }
});
