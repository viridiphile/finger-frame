import { GRAPHITE_DEFAULT_LEVELS, GRAPHITE_LEVELS } from './graphiteControls.js';

// Confirmed against origin; both repository links use this one destination.
export const REPOSITORY_URL = 'https://github.com/viridiphile/finger-frame';

const icon = (content) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const cameraIcon = icon('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>');
const captureIcon = icon('<path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/>');
const frameIcon = icon('<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><path d="m9 15 6-6"/>');
const settingsIcon = icon('<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>');
const aboutIcon = icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>');
const githubIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>`;
const closeIcon = icon('<path d="m6 6 12 12M6 18 18 6"/>');
const sections = [
  ['Hand Tracking', 'MediaPipe Hand Landmarker detects 21 landmarks per hand. Thumb and index fingertips supply the four corners of the frame; camera and landmarks are mirrored together.'],
  ['Adaptive Geometry', 'Connections follow the anatomy of persistent hands A and B. A normal quadrilateral becomes two clipped bowtie lobes when its edges cross, keeping the same connections as hands interchange.'],
  ['Tracking Stabilization & Occlusion', 'Motion-adaptive smoothing reduces jitter. Brief losses use bounded prediction, holding and fading. Landmark-based foreground masks restore original hand pixels over the effect.'],
  ['Image Processing', 'Graphite draws fine pencil contours and shading. Chromatic Solarization folds luminance into a continuous color palette, with warm and cool bowtie lobes. Motion Glitch responds to translation, rotation and scale with bounded channel and slice displacement.'],
  ['Rendering Pipeline', 'The original video or demo supplies a cropped effect pass. Canvas clips processed layers to the anatomical frame, restores foreground hands, then adds the outline. Capture exports this final composite.'],
];

const slider = (name, label, value = GRAPHITE_DEFAULT_LEVELS[name]) => `<label for="${name}">${label}<output id="${name}-value" for="${name}">${value}%</output><input id="${name}" type="range" min="0" max="100" step="25" value="${value}"><span class="range-levels" aria-hidden="true">${GRAPHITE_LEVELS.map((level) => `<span>${level}%</span>`).join('')}</span></label>`;

export const workspaceView = `
  <main class="studio">
    <header class="header">
      <a class="brand" href="./" aria-label="FingerFrame home"><span class="brand-mark">${frameIcon}</span>FingerFrame</a>
      <nav class="header-actions" aria-label="Project information">
        <a class="icon-button" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer" aria-label="FingerFrame on GitHub (opens in a new tab)" title="GitHub">${githubIcon}</a>
        <button class="button about-button" id="about-btn" type="button" aria-haspopup="dialog">${aboutIcon}<span>About</span></button>
      </nav>
    </header>
    <section class="workspace" aria-label="Finger frame studio">
      <div class="stage-toolbar"><span class="stage-title"><span class="status-dot" id="mode-dot"></span><span id="mode-label">Demo scene</span></span><span class="stage-note" id="stage-note">SIMULATED FINGERTIPS</span></div>
      <div class="stage" id="stage">
        <canvas id="output-canvas" width="960" height="600" role="img" aria-label="Animated demo with a pencil sketch inside the simulated finger frame"></canvas>
        <video id="webcam" autoplay playsinline muted hidden aria-hidden="true"></video>
        <div class="stage-overlay" id="stage-overlay" hidden><span class="overlay-icon">${frameIcon}</span><strong>Ready when you are</strong><p>Start your camera or explore the demo scene.</p></div>
        <div class="capture-countdown" id="capture-countdown" role="status" aria-live="assertive" aria-atomic="true" hidden><span id="countdown-number"></span><span class="sr-only"> seconds until capture</span></div>
        <span class="stage-tag" id="stage-tag">DEMO / GRAPHITE</span>
      </div>
      <div class="effects-bar">
        <div class="effect-selector" role="group" aria-label="Visual effect">
          <button type="button" data-effect="graphite" aria-pressed="true">Graphite</button>
          <button type="button" data-effect="solarize" aria-pressed="false">Solarize</button>
          <button type="button" data-effect="motion-glitch" aria-pressed="false">Motion Glitch</button>
        </div>
        <div class="settings-anchor" id="settings-anchor">
          <button class="icon-button" id="settings-btn" type="button" aria-label="Graphite settings" title="Graphite settings" aria-expanded="false" aria-controls="sketch-adjustments">${settingsIcon}</button>
          <section class="sketch-adjustments" id="sketch-adjustments" aria-labelledby="graphite-title" hidden>
            <h2 id="graphite-title">Graphite settings</h2>
            <div class="adjustment-grid">${slider('sensitivity', 'Edge Sensitivity')}${slider('lineIntensity', 'Line Intensity')}${slider('shadingIntensity', 'Shading Intensity')}</div>
          </section>
        </div>
      </div>
      <div class="telemetry">
        <span id="tracking-pill" class="tracking-pill" data-state="tracked"><span></span><span id="tracking-label">Simulated frame</span></span>
        <span class="metrics"><span id="hands-count">2 simulated hands</span><span class="metric-divider">/</span><span id="geometry" aria-label="Frame geometry">Quad</span><span class="metric-divider">/</span><span id="fps">— fps</span></span>
      </div>
      <div class="controls">
        <div class="source-controls"><button class="button primary" id="start-btn" type="button">${cameraIcon}<span>Start camera</span></button><button class="button stop-button" id="stop-btn" type="button" disabled><span class="stop-icon" aria-hidden="true"></span>Stop</button><button class="button demo-button" id="demo-btn" type="button" aria-pressed="true">Demo scene</button></div>
        <div class="effect-controls"><label class="effect-switch" for="effect-toggle"><input type="checkbox" id="effect-toggle" checked><span class="switch-track" aria-hidden="true"></span><span>Effect on</span></label><span class="control-divider"></span><button class="button capture-button" id="capture-btn" type="button">${captureIcon}<span>Capture</span></button></div>
      </div>
      <div class="messages"><div class="message" id="message" role="status" aria-live="polite"></div><div class="error-message" id="error-message" role="alert" hidden></div></div>
    </section>
  </main>
  <dialog class="about-dialog" id="about-dialog" aria-labelledby="about-title" aria-describedby="about-intro">
    <div class="dialog-heading"><h1 id="about-title">About FingerFrame</h1><button class="icon-button" id="about-close" type="button" aria-label="Close About" autofocus>${closeIcon}</button></div>
    <div class="about-content">
      <p id="about-intro">FingerFrame is an interactive multimedia experiment that uses hand tracking to transform a live video scene inside a frame created by your fingers.</p>
      <div class="about-accordion">${sections.map(([title, text], index) => `<section><h2><button type="button" class="accordion-button" aria-expanded="false" aria-controls="about-section-${index}"><span class="section-number">0${index + 1}</span><span>${title}</span><span class="accordion-indicator" aria-hidden="true">+</span></button></h2><div id="about-section-${index}" class="accordion-panel" hidden><p>${text}</p></div></section>`).join('')}</div>
      <p class="technologies"><strong>Built with</strong><br>Vite · JavaScript · MediaPipe · Canvas<br>Camera and effects are processed on your device.</p>
      <a class="repository-link" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer">View FingerFrame on GitHub ↗</a>
      <p class="attribution">A multimedia coursework experiment, informed by the finger-frame references of Sophia Yang and aithink001.</p>
    </div>
  </dialog>
`;
