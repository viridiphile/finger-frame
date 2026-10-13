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

test('Scharr plus suppression produces one thin contour at a known step edge', () => {
  const input = image(32, 24, (x) => x < 16 ? [60, 60, 60] : [235, 235, 235]);
  pencilSketchPixels(input);
  const pixel = (x) => input.data[(12 * 32 + x) * 4];
  const dark = Array.from({ length: 8 }, (_, i) => i + 12).filter((x) => pixel(x) < 150);
  assert.equal(dark.length, 1);
  assert.ok([15, 16].includes(dark[0]));
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
      assert.ok([...buffers.magnitude].every(Number.isFinite));
      assert.ok(result.data[0] > 190);
    }
  }
});

test('higher edge sensitivity reveals a weak low-contrast contour', () => {
  const low = pencilSketchPixels(image(32, 24, (x) => x < 16 ? [220, 220, 220] : [230, 230, 230]), undefined,
    { sensitivity: 0, lineIntensity: 1, shadingIntensity: 0 });
  const high = pencilSketchPixels(image(32, 24, (x) => x < 16 ? [220, 220, 220] : [230, 230, 230]), undefined,
    { sensitivity: 1, lineIntensity: 1, shadingIntensity: 0 });
  assert.ok(Math.min(...high.data) < Math.min(...low.data) - 10);
});

test('line and shading controls independently adjust contour and flat tone', () => {
  const source = () => image(32, 24, (x) => x < 16 ? [60, 60, 60] : [235, 235, 235]);
  const paper = pencilSketchPixels(source(), undefined, { lineIntensity: 0, shadingIntensity: 0 });
  assert.ok(paper.data.every((value) => value === 255));
  const line = pencilSketchPixels(source(), undefined, { lineIntensity: 1, shadingIntensity: 0 });
  assert.ok(Math.min(...line.data) < 100);
  assert.equal(line.data[(12 * 32 + 5) * 4], 255);
  const tone = pencilSketchPixels(source(), undefined, { lineIntensity: 0, shadingIntensity: 1 });
  assert.ok(tone.data[(12 * 32 + 5) * 4] < 160);
});

test('capacity buffers safely reuse storage across changing region dimensions', () => {
  const buffers = createSketchBuffers(8, 8, 2048);
  const arrays = [buffers.gray, buffers.gx, buffers.thin];
  for (const [width, height] of [[4, 200], [32, 24], [45, 15], [8, 8]]) {
    const source = () => image(width, height, (x, y) => [x * 5 % 255, y * 7 % 255, 80]);
    assert.deepEqual(pencilSketchPixels(source(), buffers).data, pencilSketchPixels(source()).data);
  }
  assert.deepEqual([buffers.gray, buffers.gx, buffers.thin], arrays);
});

test('a one-pixel stroke remains localized without a broad blurred halo', () => {
  const source = image(48, 32, (x) => x === 24 ? [60, 60, 60] : [240, 240, 240]);
  const result = pencilSketchPixels(source);
  const dark = [];
  for (let x = 0; x < 48; x++) if (result.data[(16 * 48 + x) * 4] < 170) dark.push(x);
  assert.ok(dark.length >= 1 && dark.length <= 2);
  assert.ok(dark.every((x) => x >= 23 && x <= 25));
});
