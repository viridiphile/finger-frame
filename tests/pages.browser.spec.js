import { test, expect } from '@playwright/test';

test('Pages-path production preview loads assets, effects, capture and the real local tracker', async ({ page }) => {
  const origin = process.env.PAGES_PREVIEW_ORIGIN || 'http://127.0.0.1:4174';
  const prefix = '/finger-frame/';
  const errors = [], paths = [], external = [], failures = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().startsWith('blob:') || request.url().startsWith('data:')) return;
    const url = new URL(request.url());
    if (url.origin === origin) paths.push(url.pathname);
    else external.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    window.pagesCameraCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      window.pagesCameraCalls++;
      const source = document.createElement('canvas'); source.width = 640; source.height = 360;
      const ctx = source.getContext('2d');
      const draw = () => {
        ctx.fillStyle = '#ef3520'; ctx.fillRect(0, 0, 320, 360);
        ctx.fillStyle = '#215bea'; ctx.fillRect(320, 0, 320, 360);
      };
      draw(); setInterval(draw, 33);
      window.pagesCameraStream = source.captureStream(30);
      return window.pagesCameraStream;
    };
  });

  const response = await page.goto(`${origin}${prefix}`);
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(`${origin}${prefix}`);
  await expect(page.locator('#tracking-label')).toHaveText('Simulated frame');
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toBe(`${prefix}favicon.svg`);
  for (const selector of ['script[type="module"][src]', 'link[rel="stylesheet"][href]']) {
    const path = await page.locator(selector).evaluate((element) => new URL(element.src || element.href).pathname);
    expect(path.startsWith(`${prefix}assets/`)).toBe(true);
  }

  await page.locator('#settings-btn').click(); await page.locator('#sensitivity').fill('25');
  for (const type of ['solarize', 'motion-glitch', 'graphite']) {
    await page.locator(`[data-effect="${type}"]`).click();
    await expect(page.locator(`[data-effect="${type}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('#settings-btn').click(); await expect(page.locator('#sensitivity')).toHaveValue('25');
  await page.keyboard.press('Escape');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#capture-btn').click();
  const download = await downloadPromise, chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(960); expect(png.readUInt32BE(20)).toBe(600);

  expect(await page.evaluate(() => window.isSecureContext)).toBe(true); // Trusted localhost, not a live HTTPS test.
  await page.locator('#start-btn').click();
  await expect(page.locator('#tracking-label')).toHaveText('Show both hands', { timeout: 60_000 });
  await expect(page.locator('#hands-count')).toHaveText('0 / 2 hands');
  await expect(page.locator('#error-message')).toBeHidden();
  expect(await page.evaluate(() => window.pagesCameraCalls)).toBe(1);
  await page.locator('#stop-btn').click();
  expect(await page.evaluate(() => window.pagesCameraStream.getTracks()[0].readyState)).toBe('ended');
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied in test', 'NotAllowedError'); };
  });
  await page.locator('#start-btn').click();
  await expect(page.locator('#error-message')).toContainText('Camera permission was denied');
  await page.locator('#demo-btn').click(); await expect(page.locator('#mode-label')).toHaveText('Demo scene');

  expect(paths.some((path) => path === `${prefix}mediapipe/hand_landmarker.task`)).toBe(true);
  expect(paths.some((path) => path.startsWith(`${prefix}mediapipe/wasm/`) && path.endsWith('.js'))).toBe(true);
  expect(paths.some((path) => path.startsWith(`${prefix}mediapipe/wasm/`) && path.endsWith('.wasm'))).toBe(true);
  expect(paths.every((path) => path.startsWith(prefix))).toBe(true);
  expect(external).toEqual([]); expect(failures).toEqual([]); expect(errors).toEqual([]);
});
