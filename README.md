# FingerFrame — iteration 2

A browser multimedia project: make a window with the thumbs and index fingers of both hands, and a live graphite drawing appears inside it. Turn a hand to create a bowtie with two filtered lobes, or interchange the hands while preserving their anatomical connections. Original hand pixels stay in front of the sketch. An animated demo is available immediately, without camera permission or model initialization.

The original Vite + vanilla JavaScript project is retained. No backend, paid API, image generator, or video upload is used. Camera pixels and hand inference stay on your device.

## Install and run

Use Node.js 22.12+ or 24 and npm. Development and builds were checked with Node 24.15.0 and npm 11.12.1.

```sh
cd "/Users/goverchuk/Desktop/Year 2 /multimedia/finger_track"
npm ci
npm run dev
```

Open the **Local** URL Vite prints (normally `http://localhost:5173`) in Chrome. Keep that terminal running. Opening `index.html` directly will not run the ES module app correctly. Webcam access requires localhost or HTTPS.

The version 1 Hand Landmarker model is included in `public/mediapipe/hand_landmarker.task`. Before dev/build, a script verifies its SHA-256 and copies WASM files from the installed MediaPipe package. No external CDN or model download is needed while using the app.

If the model is missing or corrupted, restore it with internet access:

```sh
npm run setup:model
```

## Use the application

1. The **Demo scene** starts automatically. Its 32-second loop shows a normal frame, a bowtie with both lobes filtered, hand interchange, a normal frame with A now on the right, and a return. The existing illustration remains behind simulated hands labeled A/B.
2. Click **Start camera**, allow browser access, and wait for the hand tracker to load. The demo continues while permission is pending; **Stop** can cancel startup.
3. Hold both hands in front of the camera, palms facing it. Spread the thumb and index finger of each hand into an open L. Start with a clear window and four separated tips. Keep all fingertips visible; they do not have to touch.
4. Move, rotate and resize the window. Then rotate one hand so the anatomical connections cross: look for **Bowtie tracked** and two filtered triangles. Interchange hand positions and return to the normal pose. Amber/dashed indicates brief prediction or holding during uncertain detection.
5. **Pencil effect** turns the image processing on/off while keeping the outline visible. **Capture** downloads the displayed canvas as a PNG, including its outline. UI badges are outside the exported canvas.
6. **Stop** releases the camera and clears the preview. **Demo scene** also releases the camera and returns to the simulation. Starting again reuses an already loaded model.
7. Open **Fine-tune the pencil** to adjust edge sensitivity (62% default), line intensity (78%), and shading intensity (28%). Fine contours, tonal shading and faint hatching are separate from the original hand restoration.

Camera failures show specific recovery messages for denied permission, no camera, a busy device, an insecure page, or interrupted startup. On macOS, also check System Settings → Privacy & Security → Camera for your browser if permission is blocked. To retry a tracker failure, stop and restart; the demo remains available.

## Build and checks

```sh
npm test
npm run build
npm run test:browser
```

- `npm test`: Node's built-in runner; 32 tests for hand association, anatomical/bowtie geometry, occlusion prediction, hand silhouettes, demo motion and the actual sketch pixel algorithm.
- `npm run build`: produces a static application in `dist/`, including the local model and WASM runtime.
- `npm run test:browser`: builds first, then runs nine Playwright checks in headless Chrome/Chromium, including the real-time bowtie/interchange demo cycle. It starts and stops development and production-preview servers on ports 4173 and 4174; keep both free. The production check verifies packaged model/WASM loading and synthetic camera behavior. On this Mac it uses installed Google Chrome. On other systems, run `npx playwright install chromium` first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a Chromium executable.

To view the production build:

```sh
npm run preview
```

Open the Local URL printed by Vite. `preview` serves an existing `dist/`; rebuild after source changes.

## Verification and limitations

The build, all 32 algorithm tests, and all nine browser checks passed during implementation. The browser checks covered both filtered bowtie lobes with one processing call, exact outside-polygon pixels, native cropped processing, adjustment controls, feathered foreground restoration and its expiration, the actual demo interchange/return, effect toggling, PNG bytes/dimensions, a 375px mobile layout, permission denial/cancellation, mirrored synthetic video, real local model inference in the production build, restart, and track release. Desktop, mobile, bowtie and interchanged demo screenshots were inspected. The production demo reported 30fps after settling in headless Chrome; this is a demo observation, not a physical-camera benchmark.

**Physical webcam two-hand tracking and visual mask quality have not been tested.** Tests use simulated landmarks and a generated `Canvas.captureStream()` video; they do not establish real-hand identity accuracy, true skin-boundary masks, facial detail quality or physical-camera frame rate. Safari, Firefox, CPU fallback, hardware unplugging, and a classroom presentation still need manual verification. See [MANUAL_TESTING.md](MANUAL_TESTING.md).

Anatomical crossings are supported. Entirely collapsed frames, ambiguous complete hand overlap, poor lighting and fast motion can still interrupt tracking. Translation prediction is capped at 150ms; the frame holds until 220ms and fades for 180ms, then disappears. Stale silhouettes fade sooner to avoid restoring background. Processing aims at an interactive rate, with a 30fps render cap, inference capped at 20Hz, and native cropped sketch processing with a 1024px maximum; these are scheduling limits, not guarantees of camera throughput.

## Files changed in iteration 2

| File | Purpose |
| --- | --- |
| `src/handAssociation.js` (new) | Persistent A/B identity, wrist/palm/handedness association, adaptive EMA and capped prediction |
| `src/handMask.js` (new) | Palm/finger silhouettes, feathering and original-pixel restoration |
| `src/frameGeometry.js` (modified) | Anatomical ordering, robust segment intersections, bowtie lobes and observation-based expiry |
| `src/effects.js` (modified) | Native cropped graphite processing, Scharr, edge thinning and adaptive thresholds |
| `src/renderer.js` (modified) | Single compound clip/draw and foreground restoration before the outline |
| `src/demo.js` (modified) | Existing scene plus simulated 21-point hands, bowtie and interchange cycle |
| `src/main.js`, `src/style.css` (modified) | Pipeline integration, phase/status text and three sketch controls, preserving the landing-page design |
| `tests/handAssociation.test.js`, `tests/handMask.test.js`, `tests/demo.test.js` (new) | Identity, masking and full-cycle regression tests |
| `tests/frameGeometry.test.js`, `tests/effects.test.js`, `tests/app.browser.spec.js` (modified) | Geometry, graphite and browser regressions |
| `README.md`, `TECHNICAL_EXPLANATION.md`, `MANUAL_TESTING.md` (modified) | Running, algorithms, references, verification and presentation checklist |

The existing camera adapter, Vite setup, dependencies, local model/WASM preparation, favicon and starter assets are retained. No dependencies were added. Generated screenshots are in ignored `test-results/`; `dist/`, `node_modules/` and generated WASM files remain excluded from Git.

## References

Both professor-provided references were inspected before implementation: [Sophia Yang's Finger Frame demo](https://sophiamyang.github.io/finger-frame-effect/) and [aithink001/finger-frame-effect-ai](https://github.com/aithink001/finger-frame-effect-ai/tree/main). Fingertip selection, smoothing, detection-loss holds, reduced processing resolution, and clipping informed this project's design. Application code and demo artwork were written for this project; no source code, videos, images, or generated media were copied from either reference. See [TECHNICAL_EXPLANATION.md](TECHNICAL_EXPLANATION.md) for the exact adaptations and implementation details.
