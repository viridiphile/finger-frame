import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const artifact = async (name, dataURL) => {
  await mkdir('test-results/personalized-demo', { recursive: true });
  await writeFile(`test-results/personalized-demo/${name}.png`, Buffer.from(dataURL.split(',')[1], 'base64'));
};

test('personalized scenery stays opaque, scales and reuses its static artwork between frames', async ({ page }) => {
  await page.goto('/'); await page.locator('#stop-btn').click();
  const result = await page.evaluate(async () => {
    const { drawDemoScene } = await import('/src/demo.js');
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    const sources = [], draw = ctx.drawImage.bind(ctx);
    ctx.drawImage = (source, ...args) => { sources.push(source); draw(source, ...args); };
    drawDemoScene(ctx, 960, 600, 0);
    const original = canvas.toDataURL();
    const pixels = ctx.getImageData(0, 0, 960, 600).data;
    let transparent = 0, darkest = 255, lightest = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 255) transparent++;
      const tone = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      darkest = Math.min(darkest, tone); lightest = Math.max(lightest, tone);
    }
    drawDemoScene(ctx, 960, 600, 17000);
    const staticArtwork = canvas.toDataURL() === original;
    const reused = sources[0] === sources[1];
    canvas.width = 480; canvas.height = 300;
    drawDemoScene(ctx, 480, 300, 24000);
    const resized = sources[2] !== sources[1] && sources[2].width === 480 && sources[2].height === 300;
    const smallPixels = ctx.getImageData(0, 0, 480, 300).data;
    const smallOpaque = smallPixels.every((value, i) => i % 4 !== 3 || value === 255);
    drawDemoScene(ctx, 480, 300, 25000);
    return { original, scaled: canvas.toDataURL(), transparent, darkest, lightest, staticArtwork, reused, resized, smallOpaque, reusedAfterResize: sources[3] === sources[2] };
  });
  expect(result.transparent).toBe(0); expect(result.smallOpaque).toBe(true);
  expect(result.lightest - result.darkest).toBeGreaterThan(180);
  expect(result.staticArtwork).toBe(true); expect(result.reused).toBe(true);
  expect(result.resized).toBe(true); expect(result.reusedAfterResize).toBe(true);
  await artifact('original-study-scene', result.original);
  await artifact('scaled-study-scene', result.scaled);
});

test('all three effects process the personalized scene through normal, bowtie and interchange poses', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/'); await page.locator('#stop-btn').click();
  const records = await page.evaluate(async () => {
    const { drawDemoScene, drawDemoHands, demoHands, demoFingertips } = await import('/src/demo.js');
    const { validateFrame } = await import('/src/frameGeometry.js');
    const { Renderer } = await import('/src/renderer.js');
    const renderer = new Renderer(document.createElement('canvas'));
    const records = [];
    for (const [pose, time] of [['normal', 2000], ['bowtie', 10000], ['interchange', 17000], ['reversed-normal', 24000]]) {
      drawDemoScene(renderer.sourceContext, 960, 600, time);
      drawDemoHands(renderer.sourceContext, demoHands(960, 600, time), 960, 600);
      const frame = { ...validateFrame(demoFingertips(960, 600, time), 960, 600), opacity: 1, state: 'tracked' };
      const original = renderer.sourceContext.getImageData(0, 0, 960, 600).data;
      const paths = frame.regions.map((region) => {
        const path = new Path2D(); path.moveTo(region[0].x, region[0].y);
        for (const p of region.slice(1)) path.lineTo(p.x, p.y);
        path.closePath(); return path;
      });
      for (const type of ['graphite', 'solarize', 'motion-glitch']) {
        renderer.effects.select(type);
        renderer.composite(frame, true, false, [], { motion: { intensity: 0.7, angle: 0.45, interrupted: false }, timestamp: time });
        const output = renderer.context.getImageData(0, 0, 960, 600).data;
        let changedOutside = 0; const changedLobes = frame.regions.map(() => 0);
        // Sample well inside/outside the compound region; exclude antialiased edges.
        for (let y = 4; y < 600; y += 8) for (let x = 4; x < 960; x += 8) {
          const p = (y * 960 + x) * 4;
          const changed = [0, 1, 2].some((c) => output[p + c] !== original[p + c]);
          const region = paths.findIndex((path) => renderer.context.isPointInPath(path, x, y));
          if (region !== -1 && changed) changedLobes[region]++;
          if (region === -1 && changed) {
            const nearEdge = frame.regions.some((points) => points.some((a, i) => {
              const b = points[(i + 1) % points.length];
              const dx = b.x - a.x, dy = b.y - a.y;
              const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
              return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 2;
            }));
            if (!nearEdge) changedOutside++;
          }
        }
        renderer.composite(frame, false, false);
        const restored = renderer.context.getImageData(0, 0, 960, 600).data.every((value, i) => value === original[i]);
        renderer.composite(frame, true, true, demoHands(960, 600, time), { motion: { intensity: 0.7, angle: 0.45, interrupted: false }, timestamp: time });
        records.push({ pose, type, kind: frame.kind, changedOutside, changedLobes, restored, image: renderer.canvas.toDataURL() });
      }
    }
    return records;
  });
  expect(records).toHaveLength(12);
  for (const record of records) {
    expect(record.kind).toBe(record.pose.includes('normal') ? 'quadrilateral' : 'bowtie');
    expect(record.changedOutside).toBe(0); expect(record.restored).toBe(true);
    for (const changed of record.changedLobes) expect(changed).toBeGreaterThan(20);
    await artifact(`${record.pose}-${record.type}`, record.image);
  }
  expect(errors).toEqual([]);
});

test('the live personalized demo remains smooth in each effect without camera or external assets', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4174') && !request.url().startsWith('blob:')) external.push(request.url());
  });
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => { throw new Error('Demo requested a camera'); }; });
  await page.goto('http://127.0.0.1:4174/');
  for (const type of ['graphite', 'solarize', 'motion-glitch']) {
    await page.locator(`[data-effect="${type}"]`).click();
    const samples = [];
    await expect(page.locator('#fps')).toHaveText(/\d+ fps/);
    await page.waitForTimeout(1200);
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1000);
      samples.push(parseInt(await page.locator('#fps').textContent(), 10));
    }
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    console.log(`Personalized ${type} demo FPS: ${samples.join(', ')} (headless synthetic demo).`);
    expect(average).toBeGreaterThanOrEqual(25);
    await expect(page.locator('#mode-label')).toHaveText('Demo scene');
    await expect(page.locator('#error-message')).toBeHidden();
  }
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
