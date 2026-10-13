# FingerFrame

A browser multimedia project: make a window with the thumbs and index fingers of both hands, and a live pencil drawing appears inside it. The rest of the mirrored camera image stays in color. An animated demo is available immediately, without a camera or model initialization.

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

1. The **Demo scene** starts automatically. Four simulated fingertips move, rotate, and resize a frame over an animated illustration.
2. Click **Start camera**, allow browser access, and wait for the hand tracker to load. The demo continues while permission is pending; **Stop** can cancel startup.
3. Hold both hands in front of the camera, palms facing it. Spread the thumb and index finger of each hand into an open L. Together, the four tips should surround a clear, convex window. Keep all fingertips visible and a little apart; they do not have to touch.
4. Move and rotate the window. Look for **Frame tracked**, a green outline, and four corner markers. Amber/dashed means the last frame is briefly held during uncertain detection.
5. **Pencil effect** turns the image processing on/off while keeping the outline visible. **Capture** downloads the displayed canvas as a PNG, including its outline. UI badges are outside the exported canvas.
6. **Stop** releases the camera and clears the preview. **Demo scene** also releases the camera and returns to the simulation. Starting again reuses an already loaded model.

Camera failures show specific recovery messages for denied permission, no camera, a busy device, an insecure page, or interrupted startup. On macOS, also check System Settings → Privacy & Security → Camera for your browser if permission is blocked. To retry a tracker failure, stop and restart; the demo remains available.

## Build and checks

```sh
npm test
npm run build
npm run test:browser
```

- `npm test`: Node's built-in runner; 14 tests for mirrored coordinates, validation, rotation, hand-order swaps, smoothing, dropout timing, jump rejection, demo motion, and the actual sketch pixel algorithm.
- `npm run build`: produces a static application in `dist/`, including the local model and WASM runtime.
- `npm run test:browser`: builds first, then runs five Playwright checks in headless Chrome/Chromium. It starts and stops development and production-preview servers on ports 4173 and 4174; keep both free. The production check verifies packaged model/WASM loading and camera behavior. On this Mac it uses installed Google Chrome. On other systems, run `npx playwright install chromium` first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a Chromium executable.

To view the production build:

```sh
npm run preview
```

Open the Local URL printed by Vite. `preview` serves an existing `dist/`; rebuild after source changes.

## Verification and limitations

The build, all 14 algorithm tests, and all five browser checks passed during implementation. Browser checks covered an animated demo, exact pixel preservation outside a rotated clipping polygon, effect toggling, PNG signature/dimensions, a 375px mobile viewport, permission denial, late permission cancellation, mirrored synthetic video, real local model initialization/inference from the production build, camera restart, and track release. The production demo reported 30fps after settling in headless Chrome; this is a demo observation, not a physical-camera benchmark.

**Physical webcam two-hand tracking has not been tested.** The browser camera tests use a generated `Canvas.captureStream()` video; they do not establish accuracy on real hands or frame rate on the physical camera. Safari, Firefox, CPU fallback, hardware unplugging, and a classroom presentation still need manual verification. See [MANUAL_TESTING.md](MANUAL_TESTING.md).

Crossed/overlapping fingers, very small frames, poor lighting, occlusion, and fast motion can interrupt tracking. The effect holds for 220ms, fades for 160ms, then disappears. It reacquires automatically once a valid gesture returns. Processing aims at an interactive rate, with a 30fps render cap, inference capped at 20Hz, and reduced resolution; these are scheduling limits, not a guarantee of measured frame rate.

## Files

| File | Purpose |
| --- | --- |
| `src/main.js` (modified) | UI, camera lifecycle, application state, render scheduling, screenshot download |
| `src/style.css` (modified) | Responsive studio layout and controls |
| `src/handTracking.js` (new) | Lazy MediaPipe loading, GPU/CPU initialization, reduced-size inference |
| `src/frameGeometry.js` (new) | Fingertip conversion, convex quadrilateral validation, matching, EMA and loss handling |
| `src/effects.js` (new) | Grayscale, blur, color dodge, Sobel contours and pencil shading |
| `src/renderer.js` (new) | Mirrored source canvas, polygon clipping, sketch composition, outline |
| `src/demo.js` (new) | Animated illustration and simulated fingertip coordinates |
| `index.html`, `public/favicon.svg` (modified) | App metadata and frame icon |
| `package.json`, `package-lock.json` (modified) | MediaPipe/Playwright dependencies and run/check scripts |
| `.gitignore` (modified) | Generated runtime assets and test output exclusions |
| `scripts/model-info.mjs` (new) | Pinned model URL, local path and checksum |
| `scripts/prepare-assets.mjs` (new) | Model verification and matching local WASM copying |
| `scripts/download-model.mjs` (new) | Optional verified model recovery download |
| `public/mediapipe/hand_landmarker.task` (new) | Google Hand Landmarker model, served locally |
| `public/mediapipe/wasm/*` (generated) | Six package-matched WASM/JS files; generated before dev/build |
| `tests/frameGeometry.test.js`, `tests/effects.test.js` (new) | Algorithm regression tests |
| `tests/app.browser.spec.js`, `playwright.config.js` (new) | Browser checks and test server configuration |
| `README.md`, `TECHNICAL_EXPLANATION.md`, `MANUAL_TESTING.md`, `public/mediapipe/README.md` (new) | Running, algorithms, verification checklist and asset provenance |

Unused original starter assets were retained. Screenshots generated by browser checks are in the ignored `test-results/` directory.

## References

Both professor-provided references were inspected before implementation: [Sophia Yang's Finger Frame demo](https://sophiamyang.github.io/finger-frame-effect/) and [aithink001/finger-frame-effect-ai](https://github.com/aithink001/finger-frame-effect-ai/tree/main). Fingertip selection, smoothing, detection-loss holds, reduced processing resolution, and clipping informed this project's design. Application code and demo artwork were written for this project; no source code, videos, images, or generated media were copied from either reference. See [TECHNICAL_EXPLANATION.md](TECHNICAL_EXPLANATION.md) for the exact adaptations and implementation details.
