import { test, expect } from '@playwright/test';

test('demo animates, toggles the sketch, captures a PNG, and fits a mobile screen', async ({ page }) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('blob:')) externalRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#tracking-label')).toHaveText('Simulated frame');
  await expect(page.locator('#fps')).toHaveText(/\d+ fps/);
  const first = await page.locator('canvas').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(250);
  const second = await page.locator('canvas').evaluate((canvas) => canvas.toDataURL());
  expect(second).not.toBe(first);
  const hasGrayCenter = () => page.locator('canvas').evaluate((canvas) => {
    const pixel = canvas.getContext('2d').getImageData(480, 312, 1, 1).data;
    return pixel[0] === pixel[1] && pixel[1] === pixel[2];
  });
  await expect.poll(hasGrayCenter).toBe(true);
  await page.locator('label[for="effect-toggle"]').click();
  await expect.poll(hasGrayCenter).toBe(false);
  await page.locator('label[for="effect-toggle"]').click();
  await expect.poll(hasGrayCenter).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#capture-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fingerframe-.*\.png$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(960);
  expect(png.readUInt32BE(20)).toBe(600);
  await page.screenshot({ path: 'test-results/demo-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await expect(page.locator('#start-btn')).toBeVisible();
  await expect(page.locator('#capture-btn')).toBeVisible();
  await page.screenshot({ path: 'test-results/demo-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('compositing changes only pixels inside a rotated polygon and clears when disabled', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(200, 200);
    const gradient = renderer.sourceContext.createLinearGradient(0, 0, 200, 200);
    gradient.addColorStop(0, '#bc4826');
    gradient.addColorStop(1, '#398795');
    renderer.sourceContext.fillStyle = gradient;
    renderer.sourceContext.fillRect(0, 0, 200, 200);
    const frame = { polygon: [{ x: 100, y: 25 }, { x: 175, y: 100 }, { x: 100, y: 175 }, { x: 25, y: 100 }], opacity: 1, state: 'tracked' };
    const original = renderer.sourceContext.getImageData(0, 0, 200, 200).data;
    renderer.composite(frame, true, false);
    const output = renderer.context.getImageData(0, 0, 200, 200).data;
    let changedOutside = 0, changedInside = 0, coloredInside = 0;
    for (let y = 0; y < 200; y++) {
      for (let x = 0; x < 200; x++) {
        const p = (y * 200 + x) * 4;
        const radius = Math.abs(x + 0.5 - 100) + Math.abs(y + 0.5 - 100);
        const changed = [0, 1, 2].some((channel) => original[p + channel] !== output[p + channel]);
        if (radius > 77 && changed) changedOutside++;
        if (radius < 73) {
          if (changed) changedInside++;
          if (output[p] !== output[p + 1] || output[p] !== output[p + 2]) coloredInside++;
        }
      }
    }
    renderer.composite(frame, false, false);
    const disabled = renderer.context.getImageData(0, 0, 200, 200).data;
    return { changedOutside, changedInside, coloredInside, restored: disabled.every((value, i) => value === original[i]) };
  });
  expect(result.changedOutside).toBe(0);
  expect(result.changedInside).toBeGreaterThan(9000);
  expect(result.coloredInside).toBe(0);
  expect(result.restored).toBe(true);
});

test('a bowtie filters both lobes once, preserving the unframed side regions', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { Renderer } = await import('/src/renderer.js');
    const { validateFrame } = await import('/src/frameGeometry.js');
    const canvas = document.createElement('canvas');
    const renderer = new Renderer(canvas);
    renderer.resize(200, 200);
    renderer.sourceContext.fillStyle = '#bd4932';
    renderer.sourceContext.fillRect(0, 0, 200, 200);
    const geometry = validateFrame([
      { x: 180, y: 180, hand: 0, finger: 0 }, { x: 20, y: 20, hand: 0, finger: 1 },
      { x: 20, y: 180, hand: 1, finger: 0 }, { x: 180, y: 20, hand: 1, finger: 1 },
    ], 200, 200);
    let processingCalls = 0;
    const process = renderer.sketch.process.bind(renderer.sketch);
    renderer.sketch.process = (...args) => { processingCalls++; return process(...args); };
    renderer.composite({ ...geometry, opacity: 1, state: 'tracked' }, true, false);
    const pixel = (x, y) => [...renderer.context.getImageData(x, y, 1, 1).data];
    return { kind: geometry.kind, processingCalls, top: pixel(100, 50), bottom: pixel(100, 150), left: pixel(50, 100), right: pixel(150, 100) };
  });
  expect(result.kind).toBe('bowtie');
  expect(result.processingCalls).toBe(1);
  for (const pixel of [result.top, result.bottom]) {
    expect(pixel[0]).toBe(pixel[1]);
    expect(pixel[1]).toBe(pixel[2]);
  }
  expect(result.left).toEqual([189, 73, 50, 255]);
  expect(result.right).toEqual([189, 73, 50, 255]);
});

test('denied camera permission gives a useful error and the demo remains usable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test permission denial', 'NotAllowedError'); };
  });
  await page.goto('/');
  await page.locator('#start-btn').click();
  await expect(page.locator('#error-message')).toContainText('Camera permission was denied');
  await expect(page.locator('#start-btn')).toBeEnabled();
  await expect(page.locator('#mode-label')).toHaveText('Demo scene');
  await page.locator('#demo-btn').click();
  await expect(page.locator('#error-message')).toBeHidden();
});

async function mockCamera(page, { delayed = false } = {}) {
  await page.addInitScript(({ delayed }) => {
    window.testStreams = [];
    window.testIntervals = [];
    navigator.mediaDevices.getUserMedia = () => {
      const createStream = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        const draw = () => {
          ctx.fillStyle = '#ef3520';
          ctx.fillRect(0, 0, 320, 360);
          ctx.fillStyle = '#215bea';
          ctx.fillRect(320, 0, 320, 360);
        };
        draw();
        window.testIntervals.push(setInterval(draw, 33));
        const stream = canvas.captureStream(30);
        window.testStreams.push(stream);
        return stream;
      };
      return delayed ? new Promise((resolve) => { window.resolveTestCamera = () => resolve(createStream()); }) : Promise.resolve(createStream());
    };
  }, { delayed });
}

test('late camera permission cannot reactivate a canceled camera', async ({ page }) => {
  await mockCamera(page, { delayed: true });
  await page.goto('/');
  await page.locator('#start-btn').click();
  await expect(page.locator('#stop-btn')).toBeEnabled();
  await page.locator('#stop-btn').click();
  await page.evaluate(() => window.resolveTestCamera());
  await expect.poll(() => page.evaluate(() => window.testStreams[0]?.getTracks()[0].readyState)).toBe('ended');
  await expect(page.locator('#mode-label')).toHaveText('Camera stopped');
  expect(await page.locator('#webcam').evaluate((video) => video.srcObject)).toBeNull();
  await expect(page.locator('#capture-btn')).toBeDisabled();
});

test('production build runs the real local model on synthetic video, mirrors, and releases tracks', async ({ page }) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4174') && !request.url().startsWith('blob:')) externalRequests.push(request.url());
  });
  await mockCamera(page);
  const response = await page.goto('http://127.0.0.1:4174/');
  expect(response.status()).toBe(200);
  await expect(page.locator('#fps')).toHaveText(/\d+ fps/);
  // Let the demo settle without screenshot or pixel readback overhead.
  await page.waitForTimeout(2000);
  console.log(`Observed headless production demo: ${await page.locator('#fps').textContent()} (not a physical-camera benchmark).`);
  await page.locator('#start-btn').click();
  await expect(page.locator('#mode-label')).toHaveText('Live camera');
  await expect(page.locator('#tracking-label')).toHaveText('Show both hands', { timeout: 60_000 });
  await expect(page.locator('#error-message')).toBeHidden();
  await expect(page.locator('#hands-count')).toHaveText('0 / 2 hands');
  const pixels = await page.locator('#output-canvas').evaluate((canvas) => {
    const ctx = canvas.getContext('2d');
    return { width: canvas.width, height: canvas.height, left: [...ctx.getImageData(10, 180, 1, 1).data], right: [...ctx.getImageData(630, 180, 1, 1).data] };
  });
  expect(pixels.width).toBe(640);
  expect(pixels.height).toBe(360);
  expect(pixels.left[2]).toBeGreaterThan(pixels.left[0]);
  expect(pixels.right[0]).toBeGreaterThan(pixels.right[2]);
  await page.locator('#stop-btn').click();
  await expect(page.locator('#mode-label')).toHaveText('Camera stopped');
  expect(await page.evaluate(() => window.testStreams[0].getTracks()[0].readyState)).toBe('ended');
  await page.locator('#start-btn').click();
  await expect(page.locator('#tracking-label')).toHaveText('Show both hands', { timeout: 60_000 });
  await page.locator('#demo-btn').click();
  await expect(page.locator('#mode-label')).toHaveText('Demo scene');
  expect(await page.evaluate(() => window.testStreams[1].getTracks()[0].readyState)).toBe('ended');
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
