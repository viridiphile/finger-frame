import { test, expect } from '@playwright/test';

const settings = (page) => page.getByRole('button', { name: 'Graphite settings', exact: true });
const about = (page) => page.getByRole('button', { name: 'About', exact: true });

async function pauseDemoClock(page) {
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-01-01T12:00:02Z'));
}
async function downloadedPNG(download) {
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('typical desktop screens fit the full workspace and preserve the processing canvas', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.intro, .eyebrow, .sketch-stamp, .guide, footer, .brand-detail')).toHaveCount(0);
  for (const size of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('#stage').getBoundingClientRect();
      const effects = document.querySelector('.effects-bar').getBoundingClientRect();
      return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
        stageHeight: stage.height, stageBottom: stage.bottom, effectsTop: effects.top,
        fit: getComputedStyle(document.querySelector('#output-canvas')).objectFit };
    });
    expect(layout.width).toBe(size.width);
    expect(layout.height).toBeLessThanOrEqual(size.height + 1);
    expect(layout.stageHeight).toBeGreaterThan(size.height * 0.6);
    expect(layout.effectsTop - layout.stageBottom).toBeLessThanOrEqual(1);
    expect(layout.fit).toBe('contain');
    for (const id of ['start-btn', 'stop-btn', 'demo-btn', 'capture-btn', 'effect-toggle', 'tracking-label', 'hands-count', 'geometry', 'fps']) {
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  }
  await page.evaluate(() => {
    window.canvasResizeCount = 0;
    new MutationObserver((changes) => { window.canvasResizeCount += changes.length; })
      .observe(document.querySelector('#output-canvas'), { attributes: true, attributeFilter: ['width', 'height'] });
  });
  await settings(page).click(); await page.locator('#lineIntensity').fill('50');
  await page.keyboard.press('Escape');
  await page.locator('[data-effect="solarize"]').click();
  await about(page).click(); await page.keyboard.press('Escape');
  await page.locator('label[for="effect-toggle"]').click();
  expect(await page.evaluate(() => window.canvasResizeCount)).toBe(0);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('label[for="effect-toggle"]').click();
  await page.locator('[data-effect="graphite"]').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/workspace-laptop.png' });
  expect(errors).toEqual([]);
});

test('small screens and zoom-sized viewports keep controls and the settings overlay reachable', async ({ page }) => {
  await page.goto('/');
  for (const size of [{ width: 375, height: 900 }, { width: 320, height: 568 }, { width: 700, height: 450 }, { width: 640, height: 360 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    for (const id of ['start-btn', 'stop-btn', 'demo-btn', 'capture-btn']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await settings(page).click();
    const box = await page.locator('#sketch-adjustments').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(before);
    for (const id of ['sensitivity', 'lineIntensity', 'shadingIntensity']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await page.keyboard.press('Escape');
  }
});

test('Graphite popover closes with its trigger, outside click, Escape and effect switching', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#sketch-adjustments');
  await expect(panel).toBeHidden();
  await settings(page).click();
  await expect(settings(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sensitivity')).toBeFocused();
  await page.locator('#sensitivity').fill('25');
  await settings(page).click(); await expect(panel).toBeHidden();
  await settings(page).click(); await page.locator('#stage').click({ position: { x: 20, y: 20 } });
  await expect(panel).toBeHidden();
  await settings(page).click(); await page.keyboard.press('Escape');
  await expect(panel).toBeHidden(); await expect(settings(page)).toBeFocused();
  await settings(page).click(); await page.locator('[data-effect="solarize"]').click();
  await expect(panel).toBeHidden(); await expect(settings(page)).toBeHidden();
  await page.locator('[data-effect="motion-glitch"]').click(); await expect(settings(page)).toBeHidden();
  await page.locator('[data-effect="graphite"]').click(); await expect(panel).toBeHidden();
  await settings(page).click(); await expect(page.locator('#sensitivity')).toHaveValue('25');
  await expect(page.locator('#lineIntensity')).toHaveValue('75');
  await expect(page.locator('#shadingIntensity')).toHaveValue('50');
});

test('About has matching safe repository links, accessible accordions and modal keyboard behavior', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'About FingerFrame' });
  await about(page).click(); await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close About' })).toBeFocused();
  await expect(dialog).toHaveAttribute('aria-describedby', 'about-intro');
  const links = page.locator('a[href="https://github.com/viridiphile/finger-frame"]');
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  const buttons = dialog.locator('.accordion-button'); await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) {
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = dialog.locator(`#${await button.getAttribute('aria-controls')}`);
    await expect(panel).toBeHidden();
    await button.click(); await expect(button).toHaveAttribute('aria-expanded', 'true'); await expect(panel).toBeVisible();
    await button.click(); await expect(panel).toBeHidden();
  }
  await page.locator('#start-btn').evaluate((element) => element.focus());
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(about(page)).toBeFocused();
  await expect(page.locator('html')).not.toHaveClass('modal-open');
  await about(page).click();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('.repository-link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close About' })).toBeFocused();
  for (const button of await buttons.all()) await button.click();
  await page.setViewportSize({ width: 375, height: 500 });
  const box = await dialog.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(500);
  expect(await page.locator('.about-content').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  await page.getByRole('button', { name: 'Close About' }).click();
  await expect(dialog).toBeHidden(); await expect(about(page)).toBeFocused();
  await about(page).click(); await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: 'test-results/workspace-about.png' });
});

test('countdown renders 3, 2, 1 and downloads the final canvas pixels without its DOM overlay', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await pauseDemoClock(page);
  const clickedFrame = await page.locator('#output-canvas').evaluate((canvas) => canvas.toDataURL());
  await page.evaluate(() => {
    const canvas = document.querySelector('#output-canvas');
    const encode = canvas.toBlob.bind(canvas);
    window.captureCalls = 0;
    canvas.toBlob = (...args) => {
      window.captureCalls++;
      window.capturedFrame = canvas.toDataURL();
      return encode(...args);
    };
  });
  await page.locator('#capture-btn').click();
  await expect(page.locator('#countdown-number')).toHaveText('3');
  await expect(page.locator('#capture-btn')).toBeDisabled();
  expect(await page.locator('#capture-countdown').evaluate((overlay) => overlay.parentElement.querySelector('canvas').contains(overlay))).toBe(false);
  await page.locator('#capture-btn').dispatchEvent('click');
  await page.clock.runFor(1000); await expect(page.locator('#countdown-number')).toHaveText('2');
  await page.clock.runFor(1000); await expect(page.locator('#countdown-number')).toHaveText('1');
  expect(await page.evaluate(() => window.captureCalls)).toBe(0);
  await page.screenshot({ path: 'test-results/workspace-countdown.png' });
  const downloaded = page.waitForEvent('download');
  await page.clock.runFor(1000);
  const png = await downloadedPNG(await downloaded);
  const exportedFrame = await page.evaluate(() => window.capturedFrame);
  expect(exportedFrame).not.toBe(clickedFrame);
  expect(png).toEqual(Buffer.from(exportedFrame.split(',')[1], 'base64'));
  expect(await page.evaluate(() => window.captureCalls)).toBe(1);
  await expect(page.locator('#capture-countdown')).toBeHidden(); await expect(page.locator('#capture-btn')).toBeEnabled();
  await page.clock.runFor(3000); expect(await page.evaluate(() => window.captureCalls)).toBe(1);
  expect(errors).toEqual([]);
});

test('stopping or replacing the demo cancels countdowns and pending encoding callbacks', async ({ page }) => {
  await pauseDemoClock(page);
  let downloads = 0; page.on('download', () => downloads++);
  await page.locator('#capture-btn').click(); await page.clock.runFor(1000);
  await page.locator('#stop-btn').click(); await page.clock.runFor(4000);
  await expect(page.locator('#capture-countdown')).toBeHidden();
  await expect(page.locator('#capture-btn')).toBeDisabled(); await expect(page.locator('#geometry')).toHaveText('Lost');
  expect(downloads).toBe(0);
  await page.locator('#demo-btn').click(); await page.locator('#capture-btn').click();
  await page.clock.runFor(1000); await page.locator('#demo-btn').click(); await page.clock.runFor(4000);
  await expect(page.locator('#capture-btn')).toBeEnabled(); expect(downloads).toBe(0);
  await page.evaluate(() => {
    const canvas = document.querySelector('#output-canvas');
    window.encodeCanvas = canvas.toBlob.bind(canvas);
    canvas.toBlob = (callback) => { window.pendingCapture = callback; };
  });
  await page.locator('#capture-btn').click(); await page.clock.runFor(3000);
  await expect(page.locator('#capture-btn')).toHaveText('Saving…'); await expect(page.locator('#capture-btn')).toBeDisabled();
  await page.locator('#demo-btn').click();
  await page.evaluate(() => {
    window.pendingCapture(new Blob(['stale image'], { type: 'image/png' }));
    document.querySelector('#output-canvas').toBlob = window.encodeCanvas;
  });
  await page.clock.runFor(1000); expect(downloads).toBe(0);
  await page.locator('#capture-btn').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(4000); expect(downloads).toBe(0);
  await expect(page.locator('#capture-countdown')).toBeHidden();
  await expect(page.locator('#message')).toContainText('Capture canceled');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const downloaded = page.waitForEvent('download');
  await page.locator('#capture-btn').click(); await page.clock.runFor(3000); await downloaded;
  expect(downloads).toBe(1);
});

test('empty or failed PNG encoding presents recovery guidance and can be retried', async ({ page }) => {
  await pauseDemoClock(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('#output-canvas'); window.encodeCanvas = canvas.toBlob.bind(canvas);
  });
  for (const fail of ['null', 'throw']) {
    await page.evaluate((fail) => {
      document.querySelector('#output-canvas').toBlob = (callback) => {
        if (fail === 'throw') throw new DOMException('Tainted capture', 'SecurityError');
        callback(null);
      };
    }, fail);
    await page.locator('#capture-btn').click(); await page.clock.runFor(3000);
    await expect(page.locator('#error-message')).toContainText('Could not capture this frame');
    await expect(page.locator('#capture-countdown')).toBeHidden(); await expect(page.locator('#capture-btn')).toBeEnabled();
  }
  await page.evaluate(() => { document.querySelector('#output-canvas').toBlob = window.encodeCanvas; });
  const downloaded = page.waitForEvent('download');
  await page.locator('#capture-btn').click(); await expect(page.locator('#error-message')).toBeHidden();
  await page.clock.runFor(3000); await downloaded;
});
