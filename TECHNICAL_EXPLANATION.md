# FingerFrame — technical explanation

## Personalized study-space demo

`demo.js` keeps the existing `drawDemoScene(ctx, width, height, timestamp)` interface and delegates background artwork to `demoScene.js`. The simulated hands, fingertips, phase labels, 32-second cycle and hand silhouettes remain identical to the merged workspace version. Main-loop, webcam, screenshot, tracking, geometry, masking and effect modules are unchanged.

The artwork uses Canvas paths, rounded shapes, ellipses, restrained gradients and a few perspective cues. The user's photos inform the long lamp/pen-cup base, dark laptop, cone-hat/striped-outfit/candle collectibles, white sculptural flower lamp, honey-colored desk, steep layered ridges and apartment-window framing. Three figurines form a small collection; a succulent and botanical window-shadow print balance the left side. The notebook sits forward of the laptop deck. Details are stylized and rearranged for the landscape Canvas rather than reproducing the photographs literally. The paper/notes screen contains no real application content; no photographic or product assets are embedded.

A `WeakMap` associates each source context with one cached artwork Canvas at its current dimensions. The first call, or a size change, rasterizes the illustration in 960×600 design coordinates scaled to the requested size. Subsequent calls draw that cached opaque image; old sizes are replaced, and discarded contexts can be garbage collected. Lamp glow and scenery remain static. Existing simulated hand gestures alone drive movement and Motion Glitch, keeping the effect as the main attraction.

Three new browser tests verify opacity at full/half size, reuse across timestamps and size changes, clipping and toggle restoration on the actual scene in all three effects through four poses, and camera-free production throughput. Twelve effect previews and two source previews are saved under ignored `test-results/personalized-demo/`. Settled FPS samples were 30/30/30 for each effect on this Mac's headless Chrome, consistent with the previous 30fps demo result. This is not a physical-camera or mobile-device benchmark. Visual review compared the original scene and filtered output against the supplied references; user review of composition and device/browser performance remains recommended.

## Compact workspace frontend

`workspaceView.js` owns static presentation and a single repository URL confirmed against Git origin. `workspaceUI.js` handles the Graphite overlay, native modal dialog and five accessible accordion buttons. The calibrated `GraphiteControls` object and processors are reused; the popover changes visibility only. It closes on its button, outside pointer/focus, Escape, effect switching or viewport resizing. On opening it chooses available space above/below the button and scrolls internally when needed.

The workspace uses a `100dvh` grid with a flexible `minmax(0, 1fr)` preview row. Canvas uses `object-fit: contain` to preserve the source aspect ratio. Small widths and short heights allow page scrolling with a usable minimum preview; controls are never clipped to enforce a single screen. UI interactions leave intrinsic Canvas dimensions unchanged. Existing rendering runs at its usual cadence; telemetry changes text only when values change and reports Quad, Bowtie or Lost.

About uses `dialog.showModal()` for browser-managed background inertness and keyboard focus containment. Close/Escape restores trigger focus; the root scroll is locked while open. The heading/close control remain visible while expanded content scrolls internally. Accordion buttons expose `aria-expanded` and `aria-controls`.

`CaptureCountdown` shows 3 immediately, 2 after one second, 1 after two seconds, then invokes Canvas `toBlob` after three seconds. The countdown is a DOM sibling of Canvas, so it cannot enter exported pixels. Rendering continues throughout and only the final rendered frame is encoded. Capture remains active/disabled during asynchronous encoding, preventing overlapping timers or downloads. A generation token invalidates canceled callbacks, so a late encoded image cannot download or end a newer countdown. Stop, source reset/replacement, page departure and tab hiding clear the timer and invalidate the token. Null images or encoding exceptions restore the control and show retry guidance. Download still uses a temporary object URL and anchor, with URL cleanup.

No MediaPipe, hand association, smoothing, geometry, masking, image-processing, renderer or demo modules were modified by the frontend iteration. Five countdown lifecycle tests supplement the existing 52 processing tests. Seven new browser acceptance checks supplement the existing 12, including exact PNG byte equality with the final Canvas export, final-frame change, viewport fitting, focus containment, overlay bounds, cancellation and failure recovery. The production synthetic-camera test also captures a 640×360 PNG and cancels a webcam countdown on Stop. Physical-camera and cross-browser verification remain manual.

## V3: shared architecture

V3 preserves V2 hand tracking, anatomical bowties, foreground masking, camera controls and Canvas PNG capture. It adds Graphite control calibration, Chromatic Solarization, Motion Glitch and more tolerant near-degenerate geometry. No dependencies or models were added. The subsequent frontend iteration replaces the landing page with the compact workspace described above.

```text
unmirrored camera → MediaPipe → mirrored 21-point hands → persistent A/B slots
 → smoothed/predicted fingertips → anatomical regions and lobe identities
 → optional motion features
mirrored original → shared cropped sampling → selected effect → region clipping
 → original pixels through foreground hand mask → outline → display / PNG
```

`effectSurface.js` provides the same source-coordinate crop for all effects. Most regions retain native video pixels; unusually large crops have a 1024px longest-side limit. `effectPipeline.js` selects exactly one processor. Its layers identify their canvas, source bounds and clipped regions. `renderer.js` handles compositing for every mode, including the shared hand restoration.

Graphite processes both lobes in one pass and one compound clip. Solarize shares luminance computation but emits different palette layers. Motion Glitch uses two signed displacement layers in a bowtie. Their separate clips meet at the same computed intersection. No effect changes pixels outside the region apart from the existing outline/markers.

Canvas readback still allocates `ImageData`. Graphite numeric arrays grow by capacity, and colored-effect output byte buffers are pooled while small views adapt to changing crop dimensions. Solarization lookup tables are built once. Processing is skipped when the effect is off; tracking continues. Motion feature extraction runs only for enabled Motion Glitch.

## V3 Graphite: three discrete independent controls

The V2 fine-detail algorithm remains: weighted grayscale, very light noise reduction, Scharr gradients, local adaptive thresholds, non-maximum suppression, fine graphite contours, tone and faint deterministic hatching.

Each of the existing three sliders has `min=0`, `max=100`, `step=25`. The displayed percentages are artistic levels, not raw filter weights. `graphiteControls.js` centrally maps them:

| Displayed level | Edge Sensitivity | Line Intensity | Shading Intensity |
| --- | --- | --- | --- |
| 0% | 0.22 | 0.24 | 0.12 |
| 25% | 0.40 | 0.46 | 0.20 |
| 50% | 0.62 | 0.66 | 0.28 |
| 75% | 0.80 | 0.82 | 0.40 |
| 100% | 0.95 | 0.96 | 0.54 |

Defaults are **50% sensitivity, 75% line intensity, 50% shading**, internally **0.62, 0.82, 0.28**. These retain V2's balanced tone and fine contours. Each selection changes only its own parameter. Re-selecting an unchanged level does not rebuild its mapping. Switching effects hides the controls but preserves the selected values and the Graphite processor.

Minimum levels are calibrated floors. Sensitivity 0% suppresses weaker edges while preserving strong contours; line 0% gives delicate lines; shading 0% retains faint tone. Combining all three minimum levels still gives a drawing for a nonuniform photographic source. Literal zero algorithm weights would remove both line and tone, which is why the UI does not map percentages directly to fractions.

The pixel pipeline is:

1. Luminance `0.299R + 0.587G + 0.114B`.
2. Blend 82% original luminance with 18% of a small cross-kernel average.
3. Scharr gradients normalized by 32 and their magnitude.
4. Per-32×32-tile mean/deviation thresholds, multiplied by `1.6 − 1.2 × sensitivity`.
5. Non-maximum suppression along four gradient directions, with a strict tie on one side to thin plateaus.
6. Apply independently weighted contour darkness and luminance shading, with restrained hatching/grain.

Source-coordinate cropping preserves more facial detail than V1's 480px full-frame resize. The controls are tested on all **125** combinations, including all-zero displayed levels. A photographic test fixture also checks that default eye contours remain dark and localized. These fixtures do not replace visual testing on real faces.

## V3 Chromatic Solarization

`solarize.js` computes `Y = (0.2126R + 0.7152G + 0.0722B) / 255`. Its nonlinear tone curve uses threshold `T=0.56`:

```text
Y ≤ T: tone = 0.94 × sin((Y/T) × π/2)
Y > T: t = (Y−T)/(1−T)
       tone = 0.94 × (1 − 0.86 × t²(3−2t))
```

Both branches meet at the same value with zero slope. Dark-to-middle tones rise, while tones above the threshold progressively reverse. This is a luminance fold, not independent RGB inversion.

Processed tone is continuously interpolated through charcoal, crimson/scarlet, cyan/teal and restrained neutral highlights. Three cached 4096-entry RGB tables provide balanced, warm and cool treatments; adjacent table entries are interpolated during processing. Palette endpoints are chosen to keep warm/cool tonal contrast comparable. Artistic constants are centralized, with no sliders.

A quadrilateral uses the balanced palette. Bowtie lobe **A** contains `A.index` and uses warm bias; lobe **B** contains `B.thumb` and uses cool bias. IDs remain anatomical as lobes exchange screen positions or winding reverses. If only B remains meaningful, it remains cool even though it becomes array entry zero. The two outputs share the luminance/tone calculation and retain the original source registration.

## V3 Motion Glitch

`frameMotion.js` reads stabilized anatomical fingertips, independent of MediaPipe array order:

- **Center:** average of all four vertices, valid even for a bowtie.
- **Spread:** RMS distance from that center. Signed polygon area is not used for scale.
- **Orientation:** the anatomical `A.thumb → A.index` axis, preserving direction through hand interchange. If that axis becomes too short, its previous angle is retained.

Translation is measured in frame-diameters per second; scale rate is `log(newSpread/oldSpread)/dt`. Angular differences use `atan2(sin(delta),cos(delta))`, avoiding spikes at ±π. The dead zones are 0.08 frame-diameters/s, 0.12 rad/s and 0.06 log-scale/s. Velocities are bounded and smoothed with an elapsed-time-aware 110ms EMA.

Intensity combines translation, absolute angular rate and absolute scale rate. Its envelope rises over approximately 70ms and decays over 240ms, bounded to [0,1]. Near-degenerate geometry damps the target to 35%. Predicted/held/lost tracking decays motion over 160ms and clears the previous measurement. A gap over 250ms begins a fresh baseline rather than generating a catch-up burst.

`motionGlitch.js` applies:

1. Small opposing red/blue channel samples along the current anatomical axis; green follows the slice sample.
2. Thin horizontal slices displaced by a deterministic pattern, gated by motion intensity and updated at a 90ms cadence.
3. Restrained scanlines: approximately 1.8–4.3% darkening on selected rows.

At rest, channel separation is 0.35 source pixels with bilinear sampling, preserving a subtle contribution without a whole-pixel jump or moving slice noise. Rapid gestures increase separation to at most about 9.35px and slices to at most 14px. Crops include a 25px margin so samples have neighboring source pixels; sampling clamps at image borders.

In a bowtie, A uses positive displacement and B negative displacement along the same anatomical axis. Signs depend on lobe IDs, not screen x. Motion, phase and intensity reset on effect/source changes, effect toggling and significant tracking interruption. There is **no accumulated pixel feedback**: temporal response comes from bounded velocity smoothing and the intensity/burst envelope. This avoids unbounded echoes and stale crop-alignment artifacts.

## V3 near-degenerate geometry

Inspection found two causes of premature disappearance in V2: a 2%-of-image minimum applied to every fingertip pair, and a lobe-area condition that invalidated the entire bowtie when either lobe became small.

V3 retains the exact anatomical cycle:

```text
A.index → B.index → B.thumb → A.thumb → A.index
```

It never sorts these vertices by x, centroid angle or convex hull. Robust nonadjacent segment intersections split crossings into `[a,X,d]`/`[b,c,X]` or `[a,b,X]`/`[c,d,X]`. With vectors `r=B−A`, `s=D−C`, `q=C−A`, parameters are `t=cross(q,s)/cross(r,s)` and `u=cross(q,r)/cross(r,s)`. Near-parallel determinants use length-relative tolerance; collinear segments use projected intervals. Finite coordinates are required. A unique endpoint touch can retain its meaningful triangle; overlapping edges remain invalid.

Instead of rejecting all close pairs, meaningful area depends on local fingertip spread:

```text
spreadSquared = average squared distance from the four-point center
baseArea = max(1.5 source pixels², 0.0015 × spreadSquared)
entry threshold = 1.25 × baseArea
retention threshold = 0.65 × baseArea
```

Hysteresis applies independently to existing lobes. A tiny lobe is omitted without disabling its meaningful partner. Normal/concave regions with enough actual area can remain visible despite nearby tips. Geometry is marked stable, near-degenerate, degenerate or lost for motion handling. Nothing expands a truly collapsed shape.

True collapse briefly holds the last usable region for 80ms and fades for 180ms. Missing detection keeps V2's 220ms hold and 180ms fade. Repeated invalid samples and predicted poses do not refresh observation time, so geometry cannot freeze indefinitely. Reopening the fingers accepts meaningful geometry immediately, with the usual fade-in on fresh acquisition.

## Retained V2 tracking, masking and camera behavior

MediaPipe Hand Landmarker (`@mediapipe/tasks-vision` 1.1.0, local float16 version 1 model) runs in `VIDEO` mode for two hands. Detection uses an unmirrored image up to 640px long side, capped at 20Hz and once per decoded frame. The preview is mirrored in Canvas; all 21 landmark coordinates are mirrored once with `x=(1−normalizedX)×width`. Handedness classification scores are used; unavailable per-landmark confidence fields are not assumed.

Persistent slots use reliable handedness (score ≥0.8), predicted wrist/palm distances and thumb/index continuity. Array swaps and hand interchange preserve A/B connections. Motion-adaptive landmark EMA ranges from 90ms to 28ms; implausible palm/tip jumps are rejected. Translation prediction is damped and capped at 150ms, and identities expire after 900ms without observation. Ambiguous complete overlap can still lose identity.

Foreground masks approximate a palm hull and five chains of tapered segments/round joints. A 1.2px feather softens the alpha boundary. `destination-in` restores actual original pixels over processed hands, followed by the outline. Stale silhouettes fade between 80 and 150ms. Landmark masks approximate skin boundaries and can leak sketch or restore a narrow background halo during foreshortening, joint errors or fast motion. No additional segmentation model is used.

Camera session tokens prevent late permission from reactivating a canceled stream. Stop, Demo and page departure release tracks; departure also closes the model. Effects/settings remain client-side. Local model/WASM assets are verified and served from the application origin. All three modes share the existing 32-second demo scene and simulated A/B hands; smooth periodic translation, rotation and breathing now make Motion Glitch visible without changing the pose when a mode switches.

## Verification and limits

The suite includes all V2 checks plus all 125 Graphite combinations, thin/weak contours, independent control mapping, nearby fingertips, single-lobe survival, hysteresis, continuous solarization/palette identities, normalized velocities, angle unwrapping, dead zones, bounded/opposing glitch, tracking-loss decay and buffer reuse. Chrome checks cover the three-mode UI, retained settings, screenshots, clipping/toggle restoration, hand restoration in every mode, demo transitions, mobile layout and real local model inference on synthetic video in the production build.

Physical webcam tracking, real-face detail, occlusion-mask quality, physical-camera FPS, CPU fallback, Safari/Firefox and hardware unplugging remain unverified. All effects and synchronous inference still run on the main thread. These are explicit manual checks, not claims established by synthetic fixtures. See [MANUAL_TESTING.md](MANUAL_TESTING.md) and [README.md](README.md).

The corrected [V3_SPECIFICATION.md](V3_SPECIFICATION.md) applies the user's three-slider correction throughout Sections 3, 7, 8, 9 and 11, plus related documentation/implementation references. The attachment is retained as the original input; the corrected specification is versioned with the project.

## References and attribution

Both professor references were inspected before V2 geometry work: [Sophia Yang's demo](https://sophiamyang.github.io/finger-frame-effect/) and [main.js](https://github.com/sophiamyang/finger-frame-effect/blob/main/main.js), and [aithink001/finger-frame-effect-ai](https://github.com/aithink001/finger-frame-effect-ai/tree/main) and [src/app.js](https://github.com/aithink001/finger-frame-effect-ai/blob/main/src/app.js). Mirrored fingertip conversion, anatomical connections, smoothing, dropout handling, area gates and Canvas clipping informed the implementation. Screen-position/angle sorting was not adopted for the anatomical frame.

No application source or media was copied from either reference. Algorithms, tests and demo artwork were implemented for this project. See the [MediaPipe Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Canvas clipping](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip), [composite operations](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation), and [local dependency/model provenance](public/mediapipe/README.md).
