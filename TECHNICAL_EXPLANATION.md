# Technical explanation — FingerFrame

## Technologies and model

The application uses JavaScript ES modules in the existing Vite project, browser `getUserMedia`, MediaPipe Hand Landmarker (`@mediapipe/tasks-vision` pinned to 1.1.0), and HTML5 Canvas 2D. Vite bundles the modules into a static application. There is no backend or external inference API.

The local model is Google's **Hand Landmarker float16, version 1** task bundle. It includes palm detection and hand landmark estimation; the output has 21 normalized landmarks per detected hand. Landmark **4** is the thumb tip and **8** is the index fingertip. The task runs in `VIDEO` mode with `numHands: 2` and detection/presence/tracking confidence thresholds of 0.55. GPU initialization is attempted first; CPU is the fallback. The official [Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) describes the API, normalized coordinates, confidence settings, and synchronous inference behavior.

The MediaPipe JavaScript library is imported lazily when a user starts the camera. Before dev/build, `prepare-assets.mjs` copies all six available JS/WASM runtime variants from the pinned installed package into `public/mediapipe/wasm/`. The library chooses the appropriate runtime. The bundled model's checksum is verified. Assets use Vite's `BASE_URL`, so model/WASM requests work with a configured base path. Camera images are never uploaded; all runtime requests are to the local application origin. Downloading npm dependencies or restoring the model requires internet only during setup.

## Module boundaries

```text
main.js          application state + camera + requestAnimationFrame + controls
  handTracking.js       image → MediaPipe result
  frameGeometry.js      result → validated, stabilized polygon + opacity
  demo.js               animated source + simulated fingertips
  renderer.js           source + polygon → displayed canvas
    effects.js          reduced source pixels → pencil sketch
style.css         layout and presentation
```

For someone new to JavaScript: `import` connects modules; classes hold persistent state; `async`/`await` sequence operations that take time; `requestAnimationFrame` schedules drawing around browser repaints. Typed arrays such as `Float32Array` are compact numeric working buffers, comparable to a fixed-size NumPy array. `getImageData()` returns flat RGBA bytes: pixel `(x, y)` starts at `(y * width + x) * 4`.

## Camera and render loop

The default state is the demo. Camera permission is requested only after **Start camera**. The constraints prefer 1280×720, a front camera and 30fps; audio is disabled. They are preferences rather than mandatory width/height requirements. After video playback starts, the output retains the actual camera aspect ratio, with its longest side capped at 1280 pixels.

The camera is drawn to an offscreen source canvas using `translate(width, 0)` and `scale(-1, 1)`. Canvas mirroring ensures the preview and downloaded screenshots agree. Detection receives an **unmirrored** input, reduced to at most 640 pixels on its longest side. Landmark conversion mirrors the x coordinate once:

```text
canvasX = (1 − landmarkX) × canvasWidth
canvasY = landmarkY × canvasHeight
```

No CSS mirror is applied to the output. There is no crop or letterbox transform inside the canvas, so this coordinate conversion matches the displayed source exactly.

Rendering is capped at 30fps. Detection is capped at 20Hz and runs only on a new `video.currentTime`. An `undefined` result means no inference sample was taken; a result containing zero hands means detection ran and found no hands. This distinction prevents treating a throttled frame as detection failure. Geometry expires according to timestamps even if the stream stalls. Rendering/inference are skipped while the document is hidden, and stabilization resets on returning to the tab.

An incrementing session token cancels stale asynchronous camera results. If permission resolves after Stop/Demo, every newly returned track is immediately stopped. Stop, Demo and page departure stop existing tracks, pause/detach the video and clear geometry. A stopped camera can reuse the loaded model. Leaving the page also closes the model; a model that finishes initialization after closure is released. A device `ended` event produces a recovery message.

## Frame geometry and gesture validation

Each fingertip has coordinates, a hand slot (0/1), and a finger identity (thumb/index). Exactly two detected hands are required. Normalized results are converted to mirrored canvas coordinates before geometric processing.

The four points form a convex hull using the monotone-chain algorithm and signed cross products. The hull orders its boundary without crossing edges. It must contain all four points. Three-point hulls (one finger inside the other three), coincident points, and collinear shapes are rejected. This works throughout rotation; sorting hands by their screen x coordinate would swap identities when the frame rotates.

The validator also requires:

- Finite coordinates inside the canvas and one thumb/index per hand.
- Polygon area at least **1.2%** of the canvas area, computed by the shoelace formula.
- Every boundary edge at least **4.5%** of the shorter canvas dimension.
- Normalized corner cross product at least **0.12**, rejecting nearly straight, unstable corners.
- Each hand's thumb/index pair adjacent on the hull. Pairs on diagonals are treated as crossing/overlap.

The app recognizes a sufficiently open, convex four-tip window. It does not use a separate gesture classifier or confirm extended fingers from all joint angles. This is a deliberate, explainable geometric approximation; some unrelated hand poses can form a valid window too. Concave gestures are rejected rather than rendered ambiguously.

## Stabilization

MediaPipe's hand array can change order between detections. The stabilizer compares the summed squared fingertip distances for the two possible hand assignments, keeping thumb/index identities within each pair. It selects the closest assignment. Smoothing is applied by **finger identity**, before ordering the resulting hull. This avoids interpolating unrelated corners across ordering changes.

For every coordinate:

```text
alpha = 1 − exp(−dt / 75ms)
smoothed = previous + alpha × (measurement − previous)
```

This time-based exponential moving average reduces jitter without tying its time constant to display frame rate. `dt` is clamped to 1–100ms to limit jumps after short gaps. The smoothed points are validated again before being accepted, because interpolation can temporarily create bad geometry too.

A sample moving any fingertip more than **23% of the canvas diagonal** is treated as an uncertain jump. The previous geometry holds and fades; if the new position persists, old identities expire and the new valid frame reacquires with a 100ms fade-in. This trades a short recovery delay for protection against large occlusion-induced jumps.

When a valid frame is lost:

1. Hold its last position for **220ms**, continuing to process the current image there.
2. Fade the sketch and outline over **160ms**.
3. Remove the frame and show gesture guidance.

Loss uses elapsed time rather than a count of missed display frames. A held frame has an amber dashed outline. Reacquisition resumes automatically, without camera restart. The hold means the effect can briefly remain at a previous position while fingers are hidden; this is expected behavior.

## Pencil processing and compositing

Every output starts from the untouched mirrored source. When a polygon exists and the toggle is on, a reduced copy of the full source is processed at a maximum **480 pixels on the longest side**. Full-frame sampling keeps pixel registration fixed as the frame rotates/resizes, and avoids changing texture coordinates with the polygon bounding box.

The processing pipeline is:

1. **Grayscale:** `G = 0.299R + 0.587G + 0.114B` (the middle G on the right means the green channel).
2. **Noise reduction:** separable radius-1 box blur.
3. **Soft local tone:** separable radius-4 blur of the denoised grayscale.
4. **Color dodge:** combining grayscale with its blurred inverse simplifies to `255 × gray / (blurredGray + 1)`, clamped to 255. Flat black regions have an explicit division guard. This creates a light paper base and local line detail.
5. **Sobel contours:** convolve the denoised grayscale with the 3×3 Sobel kernels, then compute `sqrt(gx² + gy²) / 4`. A small threshold reduces noise; larger magnitudes darken the output.
6. **Pencil shading:** retain a little luminance shading and add faint diagonal hatching with deterministic, low-amplitude grain. Fixed pixel patterns avoid randomly flickering paper texture.
7. **Output:** write equal R/G/B values and opaque alpha into `ImageData`.

The Sobel kernels are:

```text
gx:  -1  0  1       gy:  -1 -2 -1
     -2  0  2             0  0  0
     -1  0  1             1  2  1
```

The box blur uses running horizontal and vertical sums, making work linear in pixel count. Borders repeat the nearest pixel. Four floating-point arrays are reused between frames and reallocated only when processing dimensions change. Canvas readback still allocates `ImageData`; avoiding all allocations would require a more complex pipeline.

The renderer builds a polygon path, calls `save()` and `clip()`, draws the processed canvas back at the **full source coordinates**, and restores the context. A bounding box alone is not used as the mask. Fade opacity blends only inside that clipped polygon. Pixels outside the polygon remain the original source; the intentionally visible outline/markers overlay the boundary. Turning the toggle off skips processing and redraws the original source, leaving no stale effect. The outline is drawn after compositing.

## Demo and capture

The original demo illustration contains drifting clouds, plant sway, steam, books and a cup. It is drawn entirely with Canvas paths, gradients and shapes. Simulated pairs of thumb/index points undergo translation, rotation and resizing, with the same identities and validation as live tracking. Demo mode needs neither permission nor the MediaPipe runtime.

Capture uses `canvas.toBlob('image/png')`, downloads an object URL, then revokes it. The captured canvas includes the effect and corner outline at its intrinsic resolution; surrounding interface elements are not included.

## Verification, challenges and limitations

The Node tests exercise the actual geometry and pixel algorithms. A two-minute simulated motion test checks every 50ms of geometry. Browser tests verify real Canvas clipping against source pixels, toggle restoration, animation, PNG bytes/dimensions, mobile layout, permission error handling, asynchronous cancellation, mirroring and camera-track release. The production build initializes the actual local MediaPipe runtime/model and runs inference on a generated video stream; it contains no real hands. The production demo reported 30fps after settling in headless Chrome, without concurrent screenshot/readback work; physical-camera throughput was not measured.

**Real webcam hand detection/accuracy remains unverified.** CPU fallback, Safari/Firefox behavior, hardware removal and real-camera performance were not established by those tests. The pure pixel filter measured approximately 6.3ms per 480×300 frame in a local Node microbenchmark; that excludes Canvas readback/upload, video drawing, inference and UI, so it is not an application FPS claim.

Important constraints are occlusion, motion blur, uneven lighting, small hands/finger frames, uncertain hand identity under overlap, and the fixed geometry thresholds. The hold/fade handles loss gracefully but cannot recover unavailable landmarks. Both inference and the filter run on the main thread. Reduced resolution and throttling control cost for this understandable MVP; an inference worker and adaptive resolution would be reasonable future improvements if physical-camera profiling shows UI stalls. No worker is necessary for demonstrating the current architecture.

Bundling all WASM variants and the model adds roughly 47MB of static assets. Only the runtime selected by MediaPipe is loaded. GPU behavior depends on the browser/device. The UI's FPS is observed render throughput, and the 30fps/20Hz limits are targets rather than guarantees.

## Professor's references and attribution

Both references were inspected before implementation:

- [Sophia Yang — Finger Frame demo](https://sophiamyang.github.io/finger-frame-effect/), with [its source](https://github.com/sophiamyang/finger-frame-effect/blob/main/main.js). Useful techniques were landmarks 4/8, matching mirrored coordinates, identity-aware corner handling, EMA, dropout holds, jump protection, reduced pixel resolution and clipped effects. This implementation uses strict convex validation and time-based hold/fade rather than accepting crossed bowtie shapes or counting lost display frames.
- [aithink001 — finger-frame-effect-ai repository](https://github.com/aithink001/finger-frame-effect-ai/tree/main), especially [src/app.js](https://github.com/aithink001/finger-frame-effect-ai/blob/main/src/app.js). Its area/edge validation, corner smoothing and Canvas save/clip/draw/restore pipeline informed this design. This application processes the same live image into a pencil sketch; it does not use that repository's second-video portal or external generation workflow.

The techniques above were adapted conceptually. **No application source code or media was copied from either reference.** All application modules, tests and demo artwork are original to this implementation. Standard Sobel, shoelace, convex hull and EMA algorithms are implemented directly. Third-party dependency and model provenance is recorded in [public/mediapipe/README.md](public/mediapipe/README.md).
