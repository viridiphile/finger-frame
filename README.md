# FingerFrame — V3

Make a window with both thumbs and index fingers, then apply **Graphite**, **Solarize** or **Motion Glitch** inside it. Anatomical bowties have two independently clipped lobes; original hand pixels remain in front. The existing Vite/vanilla JavaScript setup, illustrated demo, landing-page design, camera controls and PNG export are retained. No dependencies or models were added for V3.

## Install and run

Use Node.js 22.12+ or 24 and npm (verified with Node 24.15.0/npm 11.12.1).

```sh
cd "/Users/goverchuk/Desktop/Year 2 /multimedia/finger_track"
npm ci
npm run dev
```

Open Vite's printed **Local** URL, normally `http://localhost:5173`, in Chrome. Keep the terminal running. Camera access requires localhost or HTTPS. Opening `index.html` directly does not run the Vite module application correctly.

The local Hand Landmarker model is included. Before dev/build, a script verifies its checksum and copies the installed package's matching WASM files. If the model is missing/corrupted, restore it with internet access using `npm run setup:model`. Using the app requires no runtime CDN, paid API, backend or video upload.

## Use the application

1. The demo starts without permission. Watch its 32-second normal → bowtie → hand interchange → normal/return cycle. Every mode uses the same simulated pose and original illustration.
2. Select **Graphite**, **Solarize** or **Motion Glitch**. Graphite shows three independent sliders, each snapping to **0%, 25%, 50%, 75%, 100%**. Solarize and Motion Glitch hide them and add no controls. Switching modes retains your Graphite choices.
3. Graphite defaults are **50% Edge Sensitivity, 75% Line Intensity, 50% Shading Intensity**. Levels are calibrated rather than literal weights; even all-zero displayed levels retain delicate contours and tone. The [technical explanation](TECHNICAL_EXPLANATION.md) gives the exact mapping.
4. Solarize folds luminance into charcoal, scarlet/crimson, cyan/teal and neutral tones. Bowtie A stays warmer and B cooler through hand interchange.
5. Motion Glitch is calm at rest. Moving, rotating or resizing increases bounded channel/slice displacement. Bowtie lobes shift in opposite anatomical directions. The demo has periodic gestures to demonstrate this automatically.
6. **Start camera**, allow access and wait for the tracker. Spread each thumb/index into an open L to form a window. Rotate one hand into a bowtie, exchange positions and return. Keep fingertips visible; meaningful close tips and a single remaining lobe are supported. True collapse holds/fades rather than expanding artificially.
7. **Effect on** toggles processing for the currently selected mode. **Capture** downloads the displayed canvas as PNG with the outline; interface badges/controls are not included. **Stop** releases the camera; **Demo scene** also releases it and restarts the simulation.

Denied permission, absent/busy cameras, insecure pages and interrupted startup produce recovery guidance. On macOS, also check browser permission in System Settings → Privacy & Security → Camera. Stop/restart retries a failed tracker; the demo remains available.

## Checks and production preview

```sh
npm test
npm run build
npm run test:browser
npm run preview
```

- Node checks: **52 tests passed**, including all **125** Graphite combinations, motion features, palette mapping and geometry stability.
- Build: **successful**, with local model/WASM assets packaged in `dist/`.
- Chrome checks: **12 tests passed**, including all modes, discrete independent controls/settings retention, PNG output, anatomical lobe treatment, masking, native crop/buffer reuse, responsive layout, the demo cycle, permission failures/cancellation, mirroring and model inference on synthetic video.

Browser checks build first and start/stop their own dev and production servers on ports **4173/4174**; keep both free. On this Mac they use installed Google Chrome. Elsewhere run `npx playwright install chromium` first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Test captures are in ignored `test-results/`.

`npm run preview` serves the current production build. Open its printed Local URL; rebuild after source changes. The headless production Graphite demo reported 30fps after settling, which is a demo observation rather than a physical-camera benchmark.

## Verification limits

**Physical webcam hand tracking, real-face detail, mask accuracy and physical-camera throughput have not been visually verified.** Tests use simulated landmarks and `Canvas.captureStream()` synthetic video. CPU fallback, Safari/Firefox, device unplugging and presentation conditions still need manual checks.

Very ambiguous hand overlap, poor lighting and motion blur can interrupt identities. Landmark masks approximate skin and can produce narrow halos/leakage. Fully collapsed geometry is not expanded: it holds 80ms then fades for 180ms. Detection loss retains the 220ms hold/180ms fade; prediction is capped at 150ms. Processing is browser-local, capped at 30fps render/20Hz inference; these limits do not guarantee camera FPS.

## Files changed for V3

| File | Change |
| --- | --- |
| `src/frameGeometry.js` | Local area tolerance, per-lobe hysteresis, close-tip handling, stable lobe IDs and bounded collapse |
| `src/graphiteControls.js` (new) | Three five-level calibrated independent controls |
| `src/effectSurface.js` (new) | Shared cropped sampling and pooled color output buffers |
| `src/effects.js` | Retained fine Graphite algorithm using the shared sampler |
| `src/solarize.js` (new) | Smooth luminance fold and cached balanced/warm/cool palettes |
| `src/frameMotion.js` (new) | Normalized translation, unwrapped angular and scale velocities |
| `src/motionGlitch.js` (new) | Bounded gesture-controlled channel/slice displacement and scanlines |
| `src/effectPipeline.js` (new) | Three-mode processing dispatch and temporal reset |
| `src/renderer.js` | Shared layer clipping and foreground restoration for every mode |
| `src/main.js`, `src/style.css` | Mode selector, discrete sliders, visibility/state retention and pipeline integration |
| `src/demo.js` | Same artwork with periodic motion for gesture-driven processing |
| `tests/frameGeometry.test.js`, `tests/demo.test.js`, `tests/app.browser.spec.js` | Updated stability, controls and all-mode demo captures |
| `tests/graphiteControls.test.js`, `tests/solarize.test.js`, `tests/frameMotion.test.js`, `tests/motionGlitch.test.js`, `tests/v3.browser.spec.js` (new) | Mapping, 125 combinations, palette identity, gesture response and compositing |
| `README.md`, `TECHNICAL_EXPLANATION.md`, `MANUAL_TESTING.md`, `V3_SPECIFICATION.md` | Current V3 algorithms, corrected requirements and testing guidance |

`node_modules/`, `dist/`, generated WASM and test output remain excluded from Git. The corrected specification incorporates the user's three-slider amendment throughout Sections 3, 7, 8, 9 and 11 and related references. Work belongs to `feature/chromatic-effects-v3`; merge review remains with the user.
