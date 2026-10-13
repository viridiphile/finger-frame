
import './style.css';
import { FrameStabilizer, extractFingertips } from './frameGeometry.js';
import { HandTracker } from './handTracking.js';
import { Renderer } from './renderer.js';
import { drawDemoScene, demoFingertips } from './demo.js';

const icon = (content) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const cameraIcon = icon('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>');
const captureIcon = icon('<path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/>');
const frameIcon = icon('<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><path d="m9 15 6-6"/>');

document.querySelector('#app').innerHTML = `
  <main class="studio">
    <header class="header">
      <a class="brand" href="./" aria-label="FingerFrame home"><span class="brand-mark">${frameIcon}</span>FingerFrame<span class="brand-detail">/ a study in perception</span></a>
      <span class="privacy"><span class="privacy-dot"></span>Processed on your device</span>
    </header>
    <section class="intro" aria-labelledby="title">
      <div><p class="eyebrow">INTERACTIVE MULTIMEDIA · EXPERIMENT 01</p><h1 id="title">Your hands. A different perspective.</h1>
      <p class="intro-copy">Make a frame with your thumbs and index fingers. Turn the world inside it into a pencil drawing.</p></div>
      <div class="sketch-stamp" aria-hidden="true">four points.<br><span>one little world.</span></div>
    </section>
    <section class="workspace" aria-label="Finger frame studio">
      <div class="stage-toolbar"><span class="stage-title"><span class="status-dot" id="mode-dot"></span><span id="mode-label">Demo scene</span></span><span class="stage-note" id="stage-note">SIMULATED FINGERTIPS</span></div>
      <div class="stage" id="stage">
        <canvas id="output-canvas" width="960" height="600" role="img" aria-label="Animated demo with a pencil sketch inside the simulated finger frame"></canvas>
        <video id="webcam" autoplay playsinline muted hidden aria-hidden="true"></video>
        <div class="stage-overlay" id="stage-overlay" hidden><span class="overlay-icon">${frameIcon}</span><strong>Ready when you are</strong><p>Start your camera or explore the demo scene.</p></div>
        <span class="stage-tag" id="stage-tag">DEMO / PENCIL STUDY</span>
      </div>
      <div class="telemetry"><span id="tracking-pill" class="tracking-pill" data-state="tracked"><span></span><span id="tracking-label">Simulated frame</span></span><span class="metrics"><span id="hands-count">4 simulated fingertips</span><span class="metric-divider">/</span><span id="fps">— fps</span></span></div>
      <div class="controls">
        <div class="source-controls"><button class="button primary" id="start-btn" type="button">${cameraIcon}<span>Start camera</span></button><button class="button stop-button" id="stop-btn" type="button" disabled><span class="stop-icon" aria-hidden="true"></span>Stop</button><button class="button demo-button" id="demo-btn" type="button" aria-pressed="true">Demo scene</button></div>
        <div class="effect-controls"><label class="effect-switch" for="effect-toggle"><input type="checkbox" id="effect-toggle" checked><span class="switch-track" aria-hidden="true"></span><span>Pencil effect</span></label><span class="control-divider"></span><button class="button capture-button" id="capture-btn" type="button">${captureIcon}<span>Capture</span></button></div>
      </div>
    </section>
    <div class="message" id="message" role="status" aria-live="polite">Demo running. The frame gently moves, rotates, and resizes. Start your camera to try it with your hands.</div>
    <div class="error-message" id="error-message" role="alert" hidden></div>
    <section class="guide" aria-label="How to use FingerFrame">
      <div class="guide-item"><span class="step-number">01</span><div><h2>Bring both hands into view</h2><p>Use even lighting and face your palms toward the camera.</p></div></div>
      <div class="guide-item"><span class="step-number">02</span><div><h2>Make a window</h2><p>Spread each thumb and index finger to form four corners.</p></div></div>
      <div class="guide-item"><span class="step-number">03</span><div><h2>Move your perspective</h2><p>Rotate, resize, and explore. Capture a moment as a PNG.</p></div></div>
    </section>
    <footer><span>A small experiment at the intersection of gesture & image.</span><span>VANILLA JS · MEDIAPIPE · CANVAS</span></footer>
  </main>
`;

const $ = (selector) => document.querySelector(selector);
const ui = {
  video: $('#webcam'), canvas: $('#output-canvas'), start: $('#start-btn'), stop: $('#stop-btn'),
  demo: $('#demo-btn'), capture: $('#capture-btn'), effect: $('#effect-toggle'),
  message: $('#message'), error: $('#error-message'), overlay: $('#stage-overlay'),
  mode: $('#mode-label'), note: $('#stage-note'), tag: $('#stage-tag'), dot: $('#mode-dot'),
  tracking: $('#tracking-label'), pill: $('#tracking-pill'), hands: $('#hands-count'), fps: $('#fps'),
};
const renderer = new Renderer(ui.canvas);
const stabilizer = new FrameStabilizer();
const tracker = new HandTracker();
let mode = 'idle';
let stream = null;
let sessionId = 0;
let starting = false;
let trackingReady = false;
let trackerStatus = 'loading';
let animationId = null;
let lastRender = -Infinity;
let lastStats = 0;
let frameCount = 0;
let handCount = 0;
let trackingState = '';

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}
function setMessage(message) { setText(ui.message, message); }
function clearError() { ui.error.hidden = true; ui.error.textContent = ''; }
function showError(message) { ui.error.textContent = message; ui.error.hidden = false; }

function refreshControls() {
  ui.start.disabled = starting || mode === 'camera';
  ui.start.querySelector('span').textContent = starting ? 'Starting…' : 'Start camera';
  ui.stop.disabled = !starting && mode !== 'camera';
  ui.capture.disabled = mode === 'idle';
  ui.demo.setAttribute('aria-pressed', String(mode === 'demo' && !starting));
  ui.overlay.hidden = mode !== 'idle';
  ui.dot.dataset.mode = mode;
  setText(ui.mode, mode === 'demo' ? 'Demo scene' : mode === 'camera' ? 'Live camera' : 'Camera stopped');
  setText(ui.note, mode === 'demo' ? 'SIMULATED FINGERTIPS' : mode === 'camera' ? 'MIRRORED / LOCAL PROCESSING' : 'READY TO EXPLORE');
  setText(ui.tag, mode === 'demo' ? 'DEMO / PENCIL STUDY' : mode === 'camera' ? 'LIVE / PENCIL STUDY' : 'FINGERFRAME');
  ui.canvas.setAttribute('aria-label', mode === 'demo'
    ? 'Animated demo with a pencil sketch inside the simulated finger frame'
    : 'Mirrored webcam with a pencil sketch inside your four fingertip frame');
}

function resetFrame() {
  stabilizer.reset();
  tracker.resetVideo();
  trackingState = '';
  handCount = 0;
  lastRender = -Infinity;
  lastStats = performance.now();
  frameCount = 0;
  setText(ui.fps, '— fps');
}

function releaseCamera() {
  // Incrementing the token also cancels a pending permission/play operation.
  sessionId++;
  starting = false;
  trackingReady = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  ui.video.pause();
  ui.video.srcObject = null;
}

function startLoop() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(render);
}

function startDemo() {
  releaseCamera();
  clearError();
  mode = 'demo';
  renderer.resize(960, 600);
  resetFrame();
  refreshControls();
  setMessage('Demo running. The frame gently moves, rotates, and resizes. Start your camera to try it with your hands.');
  startLoop();
}

function stopCamera(message = 'Camera stopped. Start it again or explore the demo scene.') {
  releaseCamera();
  mode = 'idle';
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  resetFrame();
  renderer.context.fillStyle = '#eee9de';
  renderer.context.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
  setText(ui.tracking, 'Camera stopped');
  ui.pill.dataset.state = 'searching';
  setText(ui.hands, '0 / 2 hands');
  clearError();
  setMessage(message);
  refreshControls();
}

function cameraErrorMessage(error) {
  switch (error.name) {
    case 'NotAllowedError': case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in your browser’s site settings, then press Start camera. You can also use Demo scene.';
    case 'NotFoundError': case 'DevicesNotFoundError':
      return 'No camera was found. Connect or enable a camera, or choose Demo scene.';
    case 'NotReadableError': case 'TrackStartError':
      return 'The camera could not start. Close other apps or tabs using it and try again, or choose Demo scene.';
    case 'OverconstrainedError':
      return 'This camera does not support the requested settings. Try another camera, or choose Demo scene.';
    case 'SecurityError':
      return 'Camera access is blocked. Open the app on localhost or HTTPS and check your browser’s camera permissions.';
    case 'AbortError':
      return 'Camera startup was interrupted. Press Start camera to try again, or choose Demo scene.';
    default:
      return `Unable to start the camera. ${error.message || 'Check browser permissions and try again.'} Demo scene works without a webcam.`;
  }
}

async function startCamera() {
  if (starting || mode === 'camera') return;
  clearError();
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError('Camera access requires localhost or HTTPS and a browser with webcam support. The demo is still available.');
    return;
  }
  const requestId = ++sessionId;
  starting = true;
  refreshControls();
  setMessage('Waiting for camera permission. Allow access in the browser prompt; Stop cancels startup.');
  try {
    const requestedStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' },
      audio: false,
    });
    if (requestId !== sessionId) {
      requestedStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = requestedStream;
    ui.video.srcObject = stream;
    await ui.video.play();
    if (requestId !== sessionId) return;
    if (!ui.video.videoWidth || !ui.video.videoHeight) throw new Error('The camera did not deliver a video frame.');
    const scale = Math.min(1, 1280 / Math.max(ui.video.videoWidth, ui.video.videoHeight));
    renderer.resize(Math.round(ui.video.videoWidth * scale), Math.round(ui.video.videoHeight * scale));
    mode = 'camera';
    starting = false;
    trackerStatus = 'loading';
    resetFrame();
    refreshControls();
    setMessage('Camera active. Loading the local hand tracker…');
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (requestId === sessionId) {
          stopCamera('Camera disconnected. Reconnect it and press Start camera, or choose Demo scene.');
          showError('The camera stream ended.');
        }
      }, { once: true });
    }
    startLoop();
    try {
      await tracker.initialize();
      if (requestId !== sessionId) return;
      trackingReady = true;
      trackerStatus = 'ready';
      setMessage('Show both hands and spread your thumbs and index fingers into a window. Keep all four fingertips visible.');
    } catch (error) {
      if (requestId !== sessionId) return;
      trackerStatus = 'error';
      console.error('Hand tracker initialization failed:', error);
      showError('The hand tracker could not load. Camera preview is available. Stop and restart to retry; check that the local model and WASM files are present, or use Demo scene.');
      setMessage('Camera active; hand tracking unavailable.');
    }
  } catch (error) {
    if (requestId !== sessionId) return;
    releaseCamera();
    refreshControls();
    showError(cameraErrorMessage(error));
    setMessage(mode === 'demo' ? 'Demo continues while camera access is unavailable.' : 'Camera unavailable. Demo scene works without a webcam.');
  }
}

function updateTrackingStatus(frame) {
  const state = mode === 'demo' ? 'demo' : !trackingReady ? trackerStatus : `${frame.state}:${frame.reason}`;
  if (state !== trackingState) {
    trackingState = state;
    ui.pill.dataset.state = mode === 'demo' ? 'tracked' : frame.state;
    setText(ui.tracking, mode === 'demo' ? 'Simulated frame' : !trackingReady
      ? (trackerStatus === 'error' ? 'Tracker unavailable' : 'Loading hand tracker')
      : frame.state === 'tracked' ? 'Frame tracked' : frame.state === 'holding' ? 'Holding last frame' : frame.reason);
  }
  setText(ui.hands, mode === 'demo' ? '4 simulated fingertips' : `${handCount} / 2 hands`);
}

function render(timestamp) {
  animationId = null;
  if (mode === 'idle') return;
  if (!document.hidden && timestamp - lastRender >= 1000 / 30 - 1) {
    lastRender = timestamp;
    if (mode === 'demo') {
      drawDemoScene(renderer.sourceContext, ui.canvas.width, ui.canvas.height, timestamp);
      stabilizer.update(demoFingertips(ui.canvas.width, ui.canvas.height, timestamp), timestamp, ui.canvas.width, ui.canvas.height);
    } else if (ui.video.readyState >= 2) {
      renderer.drawCamera(ui.video);
      if (trackingReady) {
        try {
          const result = tracker.detect(ui.video, timestamp);
          if (result !== undefined) {
            handCount = result.landmarks.length;
            stabilizer.update(extractFingertips(result, ui.canvas.width, ui.canvas.height), timestamp, ui.canvas.width, ui.canvas.height);
          }
        } catch (error) {
          console.error('Hand detection failed:', error);
          trackingReady = false;
          trackerStatus = 'error';
          stabilizer.reset();
          tracker.close();
          showError('Hand detection stopped. Stop and restart the camera to retry, or use Demo scene.');
        }
      }
    }
    const frame = stabilizer.snapshot(timestamp);
    try {
      renderer.composite(frame, ui.effect.checked);
    } catch (error) {
      console.error('Sketch rendering failed:', error);
      ui.effect.checked = false;
      renderer.composite(frame, false);
      showError('The sketch filter could not process this image. Camera preview continues; try restarting or choose Demo scene.');
    }
    updateTrackingStatus(frame);
    frameCount++;
    if (timestamp - lastStats >= 1000) {
      setText(ui.fps, `${Math.round(frameCount * 1000 / (timestamp - lastStats))} fps`);
      lastStats = timestamp;
      frameCount = 0;
    }
  }
  animationId = requestAnimationFrame(render);
}

ui.start.addEventListener('click', startCamera);
ui.stop.addEventListener('click', () => stopCamera());
ui.demo.addEventListener('click', startDemo);
ui.effect.addEventListener('change', () => {
  setMessage(ui.effect.checked ? 'Pencil effect on. Only the area inside the frame is processed.' : 'Pencil effect off. The frame remains visible over the original image.');
});
ui.capture.addEventListener('click', () => {
  ui.canvas.toBlob((blob) => {
    if (!blob) {
      showError('Could not capture this frame. Try again after the preview appears.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fingerframe-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('PNG download started, including the frame outline.');
  }, 'image/png');
});

window.addEventListener('pagehide', () => {
  stopCamera();
  tracker.close();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resetFrame();
});

startDemo();
