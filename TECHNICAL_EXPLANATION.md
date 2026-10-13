# FingerFrame — iteration 2 technical explanation

## What changed

The original Vite/vanilla JavaScript application, scene, landing page, camera controls and screenshot export are retained. Iteration 2 introduces persistent hand identities, anatomical bowtie geometry, short occlusion prediction, foreground hand restoration and a finer graphite filter. No dependencies or models were added.

The pipeline is now:

```text
unmirrored camera → MediaPipe Hand Landmarker → mirrored 21-point observations
                   → identity association + smoothing + bounded prediction
                   → anatomical frame → quadrilateral OR two bowtie triangles
mirrored original → cropped graphite processing → compound polygon clip
                  → original pixels through foreground hand mask → outline
```

## Modules and technologies

`main.js` manages camera lifecycle, controls and scheduling. `handTracking.js` loads the pinned `@mediapipe/tasks-vision` 1.1.0 library and Google's Hand Landmarker float16 version 1 task bundle. It requests at most two hands in `VIDEO` mode, uses detection/presence/tracking thresholds of 0.55, tries GPU initialization, and falls back to CPU. Inference runs on an unmirrored input with a longest side of at most 640 pixels, at most 20 times per second and once per decoded video frame.

`handAssociation.js` associates and smooths observations; `frameGeometry.js` builds the frame and controls its lifetime. `effects.js` processes pixels; `handMask.js` approximates foreground hands; `renderer.js` composites the canvases. `demo.js` supplies an original animated illustration plus simulated 21-point hands.

All processing runs in the browser. Model/WASM files are served from the application origin, with a verified model checksum and package-matched runtime files. Camera images are not uploaded. See the [official MediaPipe Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) and [local asset provenance](public/mediapipe/README.md).

## Hand observations and identity matching

MediaPipe returns 21 normalized landmarks and a handedness category with a classification score for each detected hand. The implementation uses that category score; it does **not** assume per-landmark confidence fields exist.

Detection receives the original video orientation. The source preview is mirrored with a Canvas transform, and observations are converted once:

```text
x = (1 − normalizedX) × canvasWidth
y = normalizedY × canvasHeight
```

Hand A is slot 0 and hand B is slot 1. They are persistent identities, not the hands currently on the left/right of the screen. Handedness labels remain association hints; mirroring display coordinates does not change their labels or reorder vertices.

On first acquisition, distinct labels with scores of at least 0.8 seed the two slots. Otherwise, acquisition uses result order. Subsequent matching considers both possible two-hand assignments, or each possible slot for a single observation. Its cost combines:

- Predicted wrist distance (55%).
- Predicted palm-center distance (35%), averaging landmarks 0, 5, 9, 13 and 17.
- Predicted thumb/index distances (5% each).
- A bounded mismatch penalty when a reliable handedness label disagrees with an established label.

Distances are squared and normalized by the canvas diagonal squared. Wrist/palm motion dominates fingertip articulation. Array order can change without breaking identity. A label initially missing needs three consistent high-score observations to become established; an established label does not flip with one classification error. There is no screen-x reassignment after acquisition.

Observations with implausible palm residuals or large thumb/index jumps are rejected as a whole. Limits scale with image size, hand size and elapsed time. Rejecting the whole pose prevents a false tip from refreshing the polygon's observation time while the palm keeps moving. Identities remain available for 900ms, then expire and can reacquire. No algorithm can guarantee identity through prolonged complete overlap and ambiguous/unreliable labels; that remains a practical limitation.

## Motion smoothing and occlusion

All 21 coordinates are smoothed, giving the frame and hand silhouette the same motion model. The exponential moving average is:

```text
alpha = 1 − exp(−dt / smoothingTime)
newPosition = predictedPrevious + alpha × (measurement − predictedPrevious)
```

The smoothing time adapts from 90ms during small motion toward 28ms during deliberate motion. Elapsed smoothing time is capped at 100ms, balancing jitter reduction with responsiveness after a gap.

Palm velocity is estimated from successive real observations, low-pass filtered and capped at one canvas diagonal per second. During a missing observation, every landmark receives the same damped translation:

```text
offset = velocity × 90ms × (1 − exp(−min(age, 150ms) / 90ms))
```

Prediction stops advancing at 150ms. Finger rotations and individual joint extrapolation are deliberately avoided. The recovered measurement is blended from the predicted pose, reducing a snap back after a short occlusion.

The frame uses the older of the two real observation timestamps. Prediction and repeated rendering never refresh that timestamp. A valid frame holds for 220ms from the last usable paired observation, fades over the next 180ms, then disappears. Geometry that becomes degenerate briefly also holds/fades rather than producing unstable intersections. A returning valid frame fades in over 100ms. The UI distinguishes tracking, brief prediction and holding.

Foreground silhouettes fade between 80 and 150ms of missing-hand age. They expire sooner than the frame to avoid restoring an old piece of background as though a vanished hand were still there.

## Anatomical polygon and intersections

The required cycle is always:

```text
A.index(8) → B.index(8) → B.thumb(4) → A.thumb(4) → A.index
```

The vertices are looked up by identity. They are **never sorted by screen position, centroid angle or convex hull**. Reversing the hands' horizontal positions preserves the same connections, even when winding reverses or edges cross. A convex hull is used only for the separate palm mask.

The geometry checks the two pairs of nonadjacent edges: AB/CD and BC/DA. For segments P→Q and R→S, define `r = Q−P`, `s = S−R`, and `q = R−P`. The scalar 2D cross product is `cross(a,b) = ax×by − ay×bx`:

```text
determinant = cross(r,s)
t = cross(q,s) / determinant
u = cross(q,r) / determinant
intersection = P + t×r
```

A proper crossing requires t and u strictly inside [0,1], allowing a small numerical tolerance. Near-parallel determinants are tested relative to segment lengths. Collinear segments use projected intervals to distinguish disjoint, touching and overlapping cases. Endpoint touches, overlapping edges, duplicate points and zero-length segments are rejected rather than divided by a tiny value.

For a four-vertex cycle `[a,b,c,d]`:

- If a→b crosses c→d at X, the lobes are `[a,X,d]` and `[b,c,X]`.
- If b→c crosses d→a at X, the lobes are `[a,b,X]` and `[c,d,X]`.
- Without a proper crossing, the region is the original four-sided polygon, including valid concave configurations.

The shoelace formula computes each region's absolute area. It cannot validate a bowtie using the self-intersecting cycle alone: opposite signed lobes can cancel to zero. Bowties require each triangle to exceed 0.1% of image area, and their total to exceed 0.8%. Normal frames also require 0.8%. All tip pairs must remain at least 2% of the shorter canvas dimension apart, and nearly straight corners in a simple polygon are rejected. Coordinates must be finite and inside the canvas.

The renderer appends both lobe triangles to one compound Canvas path, applies `clip('evenodd')`, and draws one processed image at its source coordinates. Both lobes therefore use identical processing, opacity and alignment. There is no duplicate filtering, bounding-box-only mask, separate texture mapping or painted dividing line at the crossing. The outline follows the original anatomical path and marks the four actual fingertips.

## Foreground hand mask

The mask uses the existing 21 landmarks, without a segmentation model:

1. Approximate the palm by the hull of landmarks 0, 1, 2, 5, 9, 13 and 17.
2. Trace thumb 1–4, index 5–8, middle 9–12, ring 13–16 and pinky 17–20.
3. Give each connected segment a tapered quadrilateral and round joint/tip discs. Radius depends on palm width/length, finger identity and progress toward the tip, with conservative image-relative limits.
4. Union these regions in one nonzero path fill per hand. Skip implausibly long finger chains rather than drawing a broad strip across the background.
5. Blur the alpha mask by 1.2 source pixels for slight feathering.
6. Draw the original mirrored source into a restoration canvas, then apply the mask with `destination-in`.

Compositing order is original video, filtered region, original hand pixels through the feathered mask, then frame outline/markers. Restoration remains inside the same polygon clip, so no pixels outside the effect are changed by feathering.

This is a geometric approximation. It cannot identify the true skin boundary, clothing, shadows or which overlapping finger is closest. Foreshortening, joint errors, hand size variation, fast motion and smoothing lag can reveal sketch on a finger or restore a thin background halo. Narrow silhouettes retain a small blended border due to feathering. No forearm mask is added. Physical-camera testing is required to tune the width estimates further.

## Fine graphite processing

The previous 480px full-frame resize and broad blurred color-dodge contours were replaced. The filter crops the polygon's bounding region with a 3px neighborhood margin. Most frames retain native source pixels, preserving considerably more eye/hair/glasses detail. Only unusually large regions are scaled to a 1024px longest side. A bowtie uses one shared crop for both triangles.

The pipeline is:

1. Grayscale luminance: `0.299R + 0.587G + 0.114B`.
2. Very light noise reduction: mix only 18% of a radius-1 cross-kernel average with 82% original luminance.
3. Scharr gradients, normalized by 32, and their magnitude. Scharr improves directional consistency for diagonal details.
4. Compute a local edge threshold for every 32×32 tile from mean and standard deviation of gradient magnitudes, with bounded thresholds adjusted by sensitivity.
5. Non-maximum suppression along four quantized gradient directions. Retain a magnitude only if it is a local maximum across the edge normal. A strict comparison on one side resolves equal plateaus into one thin ridge.
6. Convert retained magnitudes into fine graphite line darkness. Independently add mild luminance shading, faint diagonal hatching and deterministic grain.
7. Write equal RGB values and opaque alpha, then composite inside the frame.

The Scharr kernels are:

```text
gx:  -3  0  3       gy:  -3 -10 -3
    -10  0 10             0   0  0
     -3  0  3             3  10  3
```

The disclosure **Fine-tune the pencil** exposes three 0–100% controls: edge sensitivity (default 62%), line intensity (78%), and shading intensity (28%). Sensitivity lowers the adaptive edge threshold as it increases. The other controls independently change contour darkness and tonal shading. Zero line and shading intensity produces white paper inside the region.

Six floating-point image buffers and small tile statistics arrays are reused by capacity. A changing crop does not allocate fresh full-size arrays every frame. Canvas/ImageData readback and small landmark/path objects still allocate; the implementation does not claim allocation-free rendering. A local Node measurement was about 5ms for the pure 640×360 filter, excluding video, Canvas, masks and inference. Physical-camera FPS is unverified.

## Demo, controls and reliability

The existing illustrated scene remains behind two procedural hands labeled A/B. They feed the same identity, smoothing, geometry, sketch and mask pipeline as the camera. Its 32-second loop shows normal geometry, one-hand orientation change into a bowtie, two visible lobes, hand interchange, reversed normal geometry and a continuous return. Phase descriptions appear in the existing canvas badge. Demo requires no camera permission, model initialization or external request.

Camera start/stop, error messages, effect toggle and PNG capture remain available. Session tokens prevent a late permission result from restarting a canceled camera. Stop/Demo/page departure release tracks. Leaving also releases the model. Rendering is capped at 30fps, inference at 20Hz; actual throughput depends on the device. Hidden tabs skip rendering and return with fresh stabilization.

## Verification and remaining limits

The automated suite covers mirrored observations, array swaps, reliable and unlabeled hand crossings, outliers, adaptive smoothing, prediction limits, loss expiry, anatomical ordering, both crossing edge pairs, reversed winding, parallel/collinear intersections, tiny lobes, demo transitions/loop continuity, thin/weak edges, independent sketch controls, reused buffers and conservative silhouettes.

Browser tests check exact outside-polygon pixels, both filtered bowtie lobes with one processing call, native region resolution, sliders, feathered hand restoration/expiry, the actual animated demo cycle, responsive layout, PNG capture, permission denial/cancellation, mirroring, restart/track release and real model inference on synthetic video in the production build.

**Physical webcam hand tracking and visual occlusion quality have not been verified.** Synthetic landmarks/video establish pipeline behavior, not real-hand accuracy. CPU fallback, Safari/Firefox and hardware disconnection still need manual checks. Extremely ambiguous overlap can lose identity; entirely collapsed geometry is held/faded until a usable frame returns. Canvas processing and synchronous inference remain on the main thread; a worker or adaptive workload would be a future response to measured camera stalls, rather than an added dependency now.

See [MANUAL_TESTING.md](MANUAL_TESTING.md) and [README.md](README.md) for execution instructions and final recorded test results.

## References and attribution

Both professor-provided projects were inspected before changing tracking/geometry:

- [Sophia Yang's demo](https://sophiamyang.github.io/finger-frame-effect/) and [main.js](https://github.com/sophiamyang/finger-frame-effect/blob/main/main.js): informed mirrored tip conversion, the anatomical connection cycle, smoothing, dropout handling and clipped effects. This implementation replaces screen-position hand ordering with persistent identity matching and explicitly constructs triangle lobes.
- [aithink001/finger-frame-effect-ai](https://github.com/aithink001/finger-frame-effect-ai/tree/main) and [src/app.js](https://github.com/aithink001/finger-frame-effect-ai/blob/main/src/app.js): informed area/edge gates, adaptive smoothing and Canvas compositing. Its angular point sorting was not adopted because it removes the required crossing.
- [Canvas clip documentation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip) and [composite operations](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation): describe the clipping and mask operations used here.

No source code, videos or images were copied from either professor reference. Application algorithms, tests and artwork were implemented for this project. Third-party library/model provenance remains in `public/mediapipe/README.md`.
