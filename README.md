# FingerFrame — compact workspace

Make a window with both thumbs and index fingers, then apply **Graphite**, **Solarize** or **Motion Glitch** inside it. Anatomical bowties have two independently clipped lobes; original hand pixels remain in front. The compact interface puts the aspect-preserving preview, effects and camera controls on one screen. The V3 tracking, geometry, masking and processing algorithms remain unchanged. No dependencies or models were added for this frontend iteration.

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

1. The demo starts without permission. Watch its 32-second normal → bowtie → hand interchange → normal/return cycle. Every mode uses the same simulated pose and personalized study-space illustration.
2. Select **Graphite**, **Solarize** or **Motion Glitch**. For Graphite, open the sliders icon beside the selector to see three independent sliders, each snapping to **0%, 25%, 50%, 75%, 100%**. The settings panel overlays the preview; close it with its icon, outside click or Escape. Solarize and Motion Glitch hide the icon and add no controls. Switching modes retains your Graphite choices.
3. Graphite defaults are **50% Edge Sensitivity, 75% Line Intensity, 50% Shading Intensity**. Levels are calibrated rather than literal weights; even all-zero displayed levels retain delicate contours and tone. The [technical explanation](TECHNICAL_EXPLANATION.md) gives the exact mapping.
4. Solarize folds luminance into charcoal, scarlet/crimson, cyan/teal and neutral tones. Bowtie A stays warmer and B cooler through hand interchange.
5. Motion Glitch is calm at rest. Moving, rotating or resizing increases bounded channel/slice displacement. Bowtie lobes shift in opposite anatomical directions. The demo has periodic gestures to demonstrate this automatically.
6. **Start camera**, allow access and wait for the tracker. Spread each thumb/index into an open L to form a window. Rotate one hand into a bowtie, exchange positions and return. Keep fingertips visible; meaningful close tips and a single remaining lobe are supported. True collapse holds/fades rather than expanding artificially.
7. **Effect on** toggles processing for the currently selected mode. **Capture** counts down **3 → 2 → 1**, then downloads the current rendered canvas as PNG with the outline. The countdown, interface badges and controls are excluded. Capture remains disabled until encoding finishes. **Stop** stops either source and releases the camera; **Demo scene** also releases it and restarts the simulation. Source changes, Stop, tab hiding and page departure cancel pending captures.
8. The header has the [actual project repository](https://github.com/viridiphile/finger-frame) and **About**. About contains five expandable technical explanations, technologies and attribution. Escape or Close dismisses it and restores focus; the background is inert while it is open. Telemetry shows hand count, FPS and **Quad / Bowtie / Lost** geometry.

Denied permission, absent/busy cameras, insecure pages and interrupted startup produce recovery guidance. On macOS, also check browser permission in System Settings → Privacy & Security → Camera. Stop/restart retries a failed tracker; the demo remains available.

## Personalized demo scene

The demo is an original Canvas illustration based on the supplied desk and apartment-view photos: a honey-toned wooden desk, central dark laptop, long bar lamp with a pen cup, and a grouped collection of three Hirono-inspired figures. The cone hat, striped top-hat outfit and pale candle figure retain distinctive details from the reference collection. A casement window frames steep green mountain layers between simplified apartment buildings.

The composition also includes a small succulent, a folded white flower-shaped lamp, a notebook fully in front of the laptop, and an original green botanical sun-shadow wall print inspired by the later art reference. Warm off-white surfaces and muted green accents keep the effects readable. Dense forest/balcony detail and collectible costumes are simplified into clean silhouettes; loose cables, packaging and screenshot overlays are not reproduced.

`src/demoScene.js` draws the scenery once per source context/size and caches the resulting Canvas. Each subsequent frame uses one image draw for the background. Scenery stays still, including the subtle lamp light; the existing hands, motion, bowtie/interchange sequence and 32-second timing animate unchanged. There are no scene image downloads, new dependencies or changes to webcam, capture or effect algorithms.

The scene work is isolated on `feature/personalized-demo-scene`. Modified files: `src/demo.js`, new `src/demoScene.js`, new `tests/demoScene.browser.spec.js`, and the three usage/technical/manual-testing documents. Browser checks save the original scene and twelve normal/bowtie/interchange effect previews in ignored `test-results/personalized-demo/` for visual review.

## Checks and production preview

```sh
npm test
npm run build
npm run test:browser
npm run preview
```

- Node checks: **57 tests passed**, including all **125** Graphite combinations, motion features, palette mapping, geometry stability and countdown/cancellation/encoding recovery.
- Build: **successful**, with local model/WASM assets packaged in `dist/`.
- Previous full Chrome checks: **22 tests passed**, including all modes, discrete independent controls/settings retention, PNG output, anatomical lobe treatment, masking, native crop/buffer reuse, responsive layout, the demo cycle, permission failures/cancellation, mirroring and model inference on synthetic video. New workspace checks cover four desktop and four small viewports, anchored popover dismissal, native modal focus/inertness, all five accordions, countdown timing, exact final-canvas PNG bytes, cancellation during encoding, capture recovery and webcam-mode capture. Three scene checks add opaque/scaled artwork and cache reuse, all effects through normal/bowtie/interchange/reversed poses, and production demo performance without a webcam or external assets. For this deployment change, one focused Pages-path production check passed: prefixed JavaScript/CSS/favicon/model/WASM requests, all modes, retained settings, PNG export, real model inference on synthetic video, stream cleanup and permission-denial recovery. The full Chrome suite was not rerun to completion for this deployment task.

Browser checks build first and start/stop their own dev and production servers on ports **4173/4174**; keep both free. On this Mac they use installed Google Chrome. Elsewhere run `npx playwright install chromium` first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Test captures are in ignored `test-results/`.

`npm run preview` serves the current production build. Open its printed Local URL; rebuild after source changes. The personalized production demo reported **30, 30, 30fps** in each of Graphite, Solarize and Motion Glitch after settling, matching the earlier 30fps demo observation. These are headless demo measurements rather than physical-camera or cross-browser benchmarks.

## GitHub Pages deployment

**Expected project URL:** [https://viridiphile.github.io/finger-frame/](https://viridiphile.github.io/finger-frame/). This is the intended URL, not confirmation of a live deployment. The repository is `viridiphile/finger-frame`; its advertised default branch is `main`.

`vite.config.js` uses `/` for `npm run dev` and `/finger-frame/` for production builds and `npm run preview`. Vite rewrites the JavaScript, CSS and favicon paths. The existing hand tracker uses `import.meta.env.BASE_URL`, so its bundled model and WASM files load from `/finger-frame/mediapipe/` without tracking-code changes. The illustrated scene is code-drawn and uses no image/video downloads.

To validate the same subpath locally:

```sh
npm ci
npm test
npm run build
npm run preview
```

Open the preview server's printed URL ending in **`/finger-frame/`**, normally `http://localhost:4173/finger-frame/`. Local development still uses `npm run dev` at the origin root. To run the dedicated production-path browser check, keep ports 4173/4174 free and run `npm run test:browser -- tests/pages.browser.spec.js`; the full suite also includes it. That check uses synthetic camera input with the real local tracker; it does not verify physical-camera behavior or live GitHub HTTPS hosting.

### One-time GitHub setup (repository owner)

1. Open [repository Settings → Pages](https://github.com/viridiphile/finger-frame/settings/pages). Under **Build and deployment → Source**, select **GitHub Actions**. This is an Actions artifact deployment; no `gh-pages` branch or `docs` directory is needed.
2. Ensure GitHub Actions is enabled in **Settings → Actions → General** and that the official `actions/*` used by this workflow are allowed. If the `github-pages` environment has deployment branch restrictions, allow `main`; complete any required environment review in the Actions UI.
3. After reviewing the local changes, commit and push them to `main` yourself. Every subsequent push to `main` triggers `.github/workflows/deploy.yml`. To deploy manually, choose **Actions → Deploy FingerFrame to GitHub Pages → Run workflow**, selecting **main**. Manual runs on other branches are skipped.
4. Wait for both **build** and **deploy** to succeed. Use the deployment URL shown by the workflow/environment, then confirm the public URL opens on another computer. GitHub's standard `github.io` site uses HTTPS; keep **Enforce HTTPS** enabled where that setting is available.
5. On the live site, test demo/effects/settings, then **Start camera**, allow browser/OS camera permission, check tracking, Stop/Demo cleanup and Capture. In the browser Network panel, confirm the model, WASM and built assets return successfully under `/finger-frame/`. Demo works without camera permission; localhost and HTTPS provide the secure context required by the camera.

The workflow uses Node.js 24, `npm ci`, unit tests and `npm run build`, whose prebuild step verifies the tracked model checksum and copies matching WASM from the locked dependency. It uploads only `dist` and deploys it through the official Pages actions, pinned to commit SHAs. Builds have read-only repository permissions; the deployment job gets `pages: write` and `id-token: write` and reports its URL in the `github-pages` environment. No personal access token or additional repository secret is required.

For free Pages hosting, the repository must be public unless your existing GitHub plan already supports Pages for private repositories. If Pages is unavailable for a private repository on GitHub Free, repository visibility needs a separate owner decision; this change does not change visibility or configure a paid host. GitHub account/Pages settings and the actual deployment have **not** been changed or executed locally. No push or merge was performed for this deployment task.

If the repository name/default branch changes, update the production base and workflow branch filter/guard together. A custom domain or a user site at the origin root would need a `/` production base instead.

References: [Vite's Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub's Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), and [Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Verification limits

**Physical webcam hand tracking, real-face detail, mask accuracy and physical-camera throughput have not been visually verified.** Tests use simulated landmarks and `Canvas.captureStream()` synthetic video. CPU fallback, Safari/Firefox, device unplugging and presentation conditions still need manual checks.

Very ambiguous hand overlap, poor lighting and motion blur can interrupt identities. Landmark masks approximate skin and can produce narrow halos/leakage. Fully collapsed geometry is not expanded: it holds 80ms then fades for 180ms. Detection loss retains the 220ms hold/180ms fade; prediction is capped at 150ms. Processing is browser-local, capped at 30fps render/20Hz inference; these limits do not guarantee camera FPS.

## Files changed for the compact workspace

| File | Change |
| --- | --- |
| `src/workspaceView.js` | Compact markup, one repository URL, three controls and About content |
| `src/workspaceUI.js` | Anchored settings visibility, viewport fitting, modal and accordion interactions |
| `src/captureCountdown.js` | Three-second countdown, duplicate guard and cancellation through PNG encoding |
| `src/main.js` | UI integration, source lifecycle cancellation and geometry telemetry |
| `src/style.css` | Viewport grid, aspect-preserving preview, overlay settings and responsive modal |
| `tests/captureCountdown.test.js`, `tests/workspace.browser.spec.js` | Countdown lifecycle and frontend acceptance checks |
| `tests/app.browser.spec.js`, `tests/v3.browser.spec.js` | Popover interactions, geometry telemetry and synthetic webcam capture |
| `README.md`, `TECHNICAL_EXPLANATION.md`, `MANUAL_TESTING.md` | Current workspace usage, implementation and manual review guidance |

The normal desktop workspace fits 1280×720, 1366×768, 1440×900 and 1920×1080 without page scrolling. Smaller/zoom-sized viewports allow scrolling so controls remain reachable. Processing canvas dimensions change only with the source, not with layout, effect selection, settings or About.

## Retained V3 processing changes

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

`node_modules/`, `dist/`, generated WASM and test output remain excluded from Git. The corrected specification incorporates the user's three-slider amendment throughout Sections 3, 7, 8, 9 and 11 and related references. The compact workspace was reviewed/merged separately. The scene redesign was subsequently merged into `main`. The GitHub Pages configuration is prepared locally for review; no push, merge or release tag is part of this deployment task.
