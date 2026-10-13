# FingerFrame — Technical Specification V3
## Chromatic Effects, Gesture-Based Processing & UI Refinement

**Branch:** `feature/chromatic-effects-v3`

**Correction applied:** Three independent, calibrated five-position Graphite sliders.

**Project:** FingerFrame — Interactive Multimedia Experiment

**Technology:** JavaScript, Vite, MediaPipe, HTML5 Canvas

**Development goal:** Extend the working V2 application with two new real-time visual effects, simplify pencil-sketch configuration, and improve near-degenerate polygon stability.

---

## 1. Existing Application

FingerFrame currently supports:

- Real-time webcam input.
- Two-hand detection using MediaPipe.
- Anatomical thumb and index fingertip tracking.
- Quadrilateral and self-intersecting bowtie configurations.
- Hand interchange and bowtie transitions.
- Landmark smoothing and occlusion handling.
- Foreground masking.
- Fine pencil-sketch image processing.
- Three adjustable pencil parameters.
- Demo mode, screenshot capture, and a completed landing page.

The current V2 implementation performs significantly better than the original MVP.

### Known issues

**Issue 1 — Pencil configuration**

The existing sliders control edge sensitivity, line intensity, and shading intensity independently.

At low settings, the output may become almost completely white. Higher settings restore detail, but manually balancing the three parameters is inconvenient.

**Issue 2 — Near-degenerate geometry**

When fingertips become very close to one another, the polygon may disappear or break unexpectedly.

However, normal quadrilateral tracking, bowtie transitions, and hand interchange are already functioning correctly.

These successful behaviors must be preserved.

---

## 2. Git Requirements

Work exclusively on:

`feature/chromatic-effects-v3`

Before implementing:

1. Inspect the current repository.
2. Verify the correct branch and a clean working tree.
3. Confirm that the branch contains the completed V2 implementation.
4. Preserve the existing architecture and visual design.

Make meaningful commits throughout implementation.

Suggested commits:

- `fix: stabilize near-degenerate fingertip geometry`
- `refactor: add configurable effect pipeline`
- `feat: add independent discrete graphite controls`
- `feat: add chromatic solarization`
- `feat: add gesture-driven chromatic glitch`
- `test: cover effect behavior and geometry stability`
- `docs: document V3 image processing algorithms`

Run automated tests and build verification.

Push the completed feature branch, but do not merge it into `main`.

---

## 3. Feature A — Three Independent Graphite Controls

**Priority: High**

### Objective

Preserve the fine-detail V2 Graphite algorithm and all three existing independent sliders:

1. **Edge Sensitivity**
2. **Line Intensity**
3. **Shading Intensity**

Each slider supports exactly five selectable positions:

`0% → 25% → 50% → 75% → 100%`

The percentages are calibrated artistic control levels, not literal algorithm weights. Each parameter changes independently. Store the mappings centrally and retain all three selections when switching effects.

### Calibrated mapping

| Displayed level | Edge sensitivity | Line intensity | Shading intensity |
| --- | --- | --- | --- |
| 0% | 0.22 | 0.24 | 0.12 |
| 25% | 0.40 | 0.46 | 0.20 |
| 50% | 0.62 | 0.66 | 0.28 |
| 75% | 0.80 | 0.82 | 0.40 |
| 100% | 0.95 | 0.96 | 0.54 |

Balanced defaults: **Edge Sensitivity 50%, Line Intensity 75%, Shading Intensity 50%**. These map to 0.62, 0.82 and 0.28 internally and retain the V2 fine-contour character.

### Requirements

- Preserve all three sliders in the existing interface, with native discrete snapping and five visible level labels.
- Minimum levels contribute restrained sensitivity, fine contours and subtle tone. Setting any component to 0% must not disable the entire image; all three at 0% must remain a recognizable drawing for normal photographic input.
- Preserve grayscale, light noise reduction, Scharr/Sobel gradients, edge thinning, adaptive thresholds and tonal shading from V2.
- Avoid thick, blurred or overprocessed contours.
- Validate all 125 combinations for stable image processing and component independence.
- Avoid recalculating mappings when a selected level does not change.
- Show the three controls only for Graphite. Solarize and Motion Glitch have no additional controls.
- Preserve the minimalist design and retain the user's selections across effect changes.

---

## 4. Feature B — Chromatic Solarization

**Priority: High**

### Objective

Implement a distinctive artistic solarization effect based on luminance processing and selective color remapping.

This must not be a simple RGB inversion.

The intended result is an experimental photographic negative with a sophisticated red, cyan, and charcoal color palette.

### Processing pipeline

**Step 1 — Luminance analysis**

Compute luminance from the source RGB image:

`Y = 0.2126R + 0.7152G + 0.0722B`

**Step 2 — Nonlinear solarization**

Apply a threshold-dependent luminance transformation.

Below a selected threshold, preserve or contrast-adjust tonal values.

Above the threshold, progressively reverse tonal relationships using a smooth nonlinear curve.

Avoid a harsh discontinuity at the threshold.

**Step 3 — Custom palette mapping**

Map processed tonal values into a predetermined palette with:

- Deep charcoal and dark tones
- Crimson / scarlet accents
- Cyan / teal contrasts
- Restrained neutral highlights

Use continuous interpolation between palette stops rather than abrupt banding.

Preserve enough local contrast for recognizable facial features and objects.

**Step 4 — Detail enhancement**

Optionally use subtle edge-aware contrast enhancement to emphasize important facial and object boundaries.

Do not convert the effect into simple edge detection.

### Normal polygon behavior

Apply a balanced red/cyan solarization palette to the entire frame interior.

Keep the original camera feed unchanged outside the polygon.

### Bowtie behavior

When the frame becomes a bowtie, process the two triangular lobes independently:

- Triangle A: warmer palette bias, emphasizing crimson.
- Triangle B: cooler palette bias, emphasizing cyan.

Both triangles should remain part of the same artistic effect and retain comparable luminance contrast.

The warm/cool assignments must remain consistent with stable anatomical lobe identities. Do not switch colors merely because triangles exchange screen positions.

At the intersection, use the existing bowtie geometry to produce clean clipping without visible seams.

### Configuration

Do not expose effect-specific sliders.

Hardcode carefully selected artistic defaults, with constants organized for later modification.

The effect should look attractive immediately upon selection.

---

## 5. Feature C — Gesture-Driven Chromatic Glitch

**Priority: High**

### Objective

Implement an original glitch effect where visual distortion is controlled by the movement and geometry of the user's finger frame.

Unlike ordinary randomized glitch filters, this effect must respond to real tracking information.

### Tracking inputs

Calculate the following from the stabilized fingertip positions:

**A. Translation velocity**

Measure the movement speed of the frame center.

Use the average of the four anatomical fingertip positions for a stable center, including bowtie configurations.

Normalize velocity by frame dimensions and elapsed time.

**B. Rotation velocity**

Estimate the frame's orientation using a consistent anatomical axis.

Calculate angular velocity with angle unwrapping to prevent discontinuities around ±180 degrees.

**C. Scale-change velocity**

Estimate expansion and contraction from a stable measure of frame dimensions or fingertip spread.

Do not rely exclusively on polygon area because signed area may approach zero during bowtie transitions.

**D. Geometry state**

Determine whether the current frame consists of:

- Regular quadrilateral
- Bowtie
- Temporarily degenerate geometry

### Visual processing

Implement a combination of:

**RGB channel displacement**

Shift red, green, and blue components by small directional offsets.

**Slice displacement**

Divide the processed image into thin horizontal or angle-dependent regions and displace selected slices.

**Temporal feedback**

Optionally blend a small amount of a previous processed frame into the current frame to produce a short motion echo.

Avoid accumulating feedback indefinitely.

**Scanline texture**

Introduce restrained digital scanlines to support the visual style.

### Gesture-response mapping

**When hands remain still:**

- Almost no displacement.
- Subtle chromatic separation.
- Calm, stable image.

**When hands move rapidly:**

- Increase RGB channel separation.
- Increase slice displacement amplitude.
- Introduce short distortion bursts.

**When the frame rotates:**

- Change displacement direction according to frame orientation.
- Increase distortion slightly with angular velocity.

**When the frame expands or contracts:**

- Modulate distortion intensity using scale-change velocity.

### Bowtie-specific behavior

Apply opposite displacement directions to the two triangular regions.

For example:

- Triangle A: positive horizontal or local-axis displacement.
- Triangle B: negative displacement.

As the user's hands move and rotate, the distortion directions should update continuously.

Do not reverse directions unpredictably when hand positions interchange.

### Stability requirements

Tracking jitter must not create constant excessive glitching.

Implement:

- Velocity smoothing.
- Dead zones for insignificant movement.
- Bounded maximum displacement.
- Smooth intensity decay.
- Delta-time-aware calculations.
- Safe handling of sudden tracking loss.

Reset or damp temporal feedback after significant tracking interruptions or effect switches.

Avoid aggressive full-screen flashing or extreme brightness changes.

### Configuration

No glitch-specific sliders.

The filter must be self-configuring based on gesture motion.

Choose sensible minimum and maximum intensities so that users can comfortably demonstrate the effect.

---

## 6. Feature D — Near-Degenerate Polygon Stability

**Priority: Critical**

### Problem

V2 correctly handles quadrilateral, bowtie, and hand-interchange configurations.

However, when fingertips approach one another, the polygon may become unstable or disappear prematurely.

### Required improvements

Inspect the existing geometry validation and rendering logic.

Identify whether failures originate from:

- Minimum edge-length checks
- Area thresholds
- Segment intersection calculations
- Landmark smoothing
- Occlusion recovery
- Canvas clipping behavior

Do not assume the cause without inspecting the implementation.

### Proposed handling

Introduce or refine:

1. Scale-aware geometric tolerance values.
2. Minimum area checks applied appropriately to valid shapes and individual bowtie lobes.
3. Hysteresis for transitions into and out of degenerate geometry.
4. Brief retention of the last valid geometry where appropriate.
5. Smooth recovery when a valid configuration returns.
6. Protection against NaN, Infinity, and unstable intersection calculations.

Do not artificially expand a genuinely collapsed shape.

Do not freeze the polygon indefinitely.

Do not interpret every low-area bowtie as an invalid quadrilateral.

When a triangular lobe becomes extremely small, handle it gracefully without disabling the other valid lobe.

### Acceptance criteria

- Fingertips may approach closely without unnecessary flickering.
- The outline follows the points as long as a meaningful frame can be constructed.
- The polygon can gracefully collapse when truly degenerate.
- Moving fingertips apart restores normal rendering quickly.
- Existing quadrilateral-to-bowtie transitions remain correct.
- Hand interchange remains stable.

---

## 7. Feature E — Effect Selection and UI

**Priority: High**

Introduce a minimal effect selector containing exactly three modes:

1. Graphite
2. Solarize
3. Motion Glitch

Use compact segmented controls, tabs, or a similarly unobtrusive selector consistent with the existing design.

Do not redesign the landing page.

### UI behavior

**Graphite selected**

Show Edge Sensitivity, Line Intensity and Shading Intensity. Each independent slider snaps to 0%, 25%, 50%, 75% or 100%, and all three selections persist across effect switches.

**Solarize selected**

Hide all three Graphite sliders. Display Solarize using predefined artistic settings without additional controls.

**Motion Glitch selected**

Hide all three Graphite sliders. Use automatic gesture-driven Motion Glitch processing without additional controls.

### Existing effect toggle

Preserve the existing effect on/off functionality.

When switched off, show the original camera image regardless of the selected effect.

When switched back on, restore the selected effect.

### Screenshot capture

Capture the currently rendered visual effect with the existing polygon and overlay behavior.

Ensure screenshot output matches what is visible in the application.

### Demo mode

Every effect must work in demo mode.

For Motion Glitch, use the simulated frame's motion to drive distortion.

Solarization must also apply correctly to the simulated scene.

Keep the existing demo artwork and overall presentation.

---

## 8. Rendering Architecture

**Priority: High**

Avoid implementing three unrelated rendering systems.

Refactor the existing effect pipeline only where necessary to support multiple processing modes.

Suggested interface:

`processEffect(sourceFrame, effectType, effectContext)`

Where the effect context includes:

- Three independently selected discrete Graphite control levels and their calibrated internal values
- Current polygon or bowtie regions
- Frame motion measurements
- Geometry state
- Timestamp and frame delta
- Previous-frame data where required

Prefer separating:

1. MediaPipe tracking
2. Hand identity and geometry
3. Motion feature extraction
4. Effect processing
5. Masking and compositing
6. UI controls

Preserve the existing hand foreground mask for all three effects.

Keep all processing client-side.

Use Canvas 2D where practical and avoid introducing large dependencies unnecessarily.

For performance:

- Reuse processing buffers.
- Avoid allocating large arrays every animation frame.
- Use suitable processing resolutions.
- Cache lookup tables for palette mapping.
- Reduce expensive computations when the effect is disabled.
- Keep webcam preview and tracking responsive.

---

## 9. Automated Tests

Add or update tests for:

**Graphite controls**
- Exactly three independent sliders, each with exactly five selectable positions.
- Correct calibrated mapping for every level.
- Stable processing for all 125 valid combinations.
- Minimum levels retain recognizability and tone for normal photographic input.
- Balanced defaults retain detailed pencil contours.
- Effect switching preserves all three selected values.
- Solarize and Motion Glitch hide the Graphite controls.

**Solarization**
- Deterministic color mapping.
- Correct threshold transitions.
- Valid RGB output range.
- Distinct warm/cool bowtie palettes.
- Stable palette identity during hand interchange.

**Glitch**
- Zero or near-zero velocity produces minimal distortion.
- Increased velocity produces increased distortion up to a safe maximum.
- Correct time normalization.
- No discontinuous angular spikes.
- Opposite displacement behavior for bowtie lobes.
- Stable handling of lost tracking.

**Geometry**
- Standard quadrilateral.
- Self-intersecting bowtie.
- Reversed anatomical orientations.
- Nearly coincident fingertips.
- Very small triangular lobes.
- Recovery from degenerate shapes.

**Application**
- Effect switching.
- Effect on/off toggle.
- Demo compatibility.
- Screenshot capture.
- Production build.

Run all available existing tests as well.

Do not claim that real webcam behavior has been verified unless tested with an actual camera.

---

## 10. Documentation

Update the project documentation with a V3 section explaining:

**Graphite**
- Five-position mapping for each of the three independent Graphite sliders.
- Image processing pipeline.
- Why calibrated minimum contributions retain recognizable detail and shading even with all three controls at 0%.

**Solarization**
- Luminance computation.
- Nonlinear solarization.
- Palette interpolation.
- Warm/cool bowtie behavior.

**Motion Glitch**
- Frame motion feature extraction.
- Translation and angular velocity.
- Gesture-to-intensity mapping.
- RGB displacement.
- Temporal processing.
- Opposing bowtie distortion.

**Geometry**
- Near-degenerate polygon handling.
- Hysteresis and tolerance selection.

Explain why the effects represent distinct multimedia-processing techniques.

Keep documentation concise enough for university presentation preparation.

---

## 11. Definition of Done

V3 is complete when:

- The original website's design is preserved.
- Graphite preserves three independent calibrated sliders, each snapping to 0%, 25%, 50%, 75% or 100%, with balanced defaults and settings retained across effect changes.
- Chromatic Solarization works with its predefined palette.
- Solarization displays distinct warm/cool bowtie lobes.
- Motion Glitch responds naturally to hand movement.
- Bowtie triangles exhibit opposite glitch directions.
- Existing V2 tracking functionality is preserved.
- Near-degenerate geometry is more stable.
- All three effects work in demo mode.
- Existing screenshot and effect-toggle functions work.
- Automated tests pass.
- `npm run build` succeeds.
- Documentation is updated.
- Changes are committed and pushed to the feature branch.

**Do not merge into main.**

Provide a final summary describing implementation changes, completed tests, known limitations, and instructions for manual verification.

### Implementation order

1. Inspect and stabilize near-degenerate polygon behavior.
2. Refactor the effect pipeline for multiple modes.
3. Implement and calibrate the three independent five-position Graphite sliders.
4. Implement Chromatic Solarization.
5. Implement Gesture-Driven Glitch.
6. Integrate effect selection and demo behavior.
7. Test, document, commit, and push.

Preserve the stable V2 features throughout development. Prioritize correct geometry and smooth visual processing over additional UI polish.