
import './style.css';
import { FrameStabilizer } from './frameGeometry.js';
import { HandIdentityTracker, extractHands, fingertipsFromHands } from './handAssociation.js';
import { HandTracker } from './handTracking.js';
import { Renderer } from './renderer.js';
import { drawDemoScene, drawDemoHands, demoHands, demoPhase } from './demo.js';
import { GraphiteControls } from './graphiteControls.js';
import { FrameMotion, ZERO_MOTION } from './frameMotion.js';
import { EFFECT_LABELS } from './effectPipeline.js';

import { workspaceView } from './workspaceView.js';
import { initializeWorkspaceUI } from './workspaceUI.js';

document.querySelector('#app').innerHTML = workspaceView;
const workspaceUI = initializeWorkspaceUI();

const $ = (selector) => document.querySelector(selector);
const ui = {
  video: $('#webcam'), canvas: $('#output-canvas'), start: $('#start-btn'), stop: $('#stop-btn'),
  demo: $('#demo-btn'), capture: $('#capture-btn'), effect: $('#effect-toggle'),
  message: $('#message'), error: $('#error-message'), overlay: $('#stage-overlay'),
  mode: $('#mode-label'), note: $('#stage-note'), tag: $('#stage-tag'), dot: $('#mode-dot'),
  tracking: $('#tracking-label'), pill: $('#tracking-pill'), hands: $('#hands-count'), fps: $('#fps'), geometry: $('#geometry'),
};
const renderer = new Renderer(ui.canvas);
const graphiteControls = new GraphiteControls();
renderer.sketch.setParameters(graphiteControls.parameters);
const stabilizer = new FrameStabilizer();
const identities = new HandIdentityTracker();
const tracker = new HandTracker();
const frameMotion = new FrameMotion();
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
let demoStartedAt = 0;
let demoTime = 0;

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}
function setMessage(message) { setText(ui.message, message); }
function clearError() { ui.error.hidden = true; ui.error.textContent = ''; }
function showError(message) { ui.error.textContent = message; ui.error.hidden = false; }

function refreshControls() {
  ui.start.disabled = starting || mode === 'camera';
  ui.start.querySelector('span').textContent = starting ? 'Starting…' : 'Start camera';
  ui.stop.disabled = !starting && mode === 'idle';
  ui.capture.disabled = mode === 'idle';
  ui.demo.setAttribute('aria-pressed', String(mode === 'demo' && !starting));
  ui.overlay.hidden = mode !== 'idle';
  ui.overlay.querySelector('strong').textContent = starting ? 'Waiting for your camera' : 'Ready when you are';
  ui.dot.dataset.mode = mode;
  setText(ui.mode, starting ? 'Starting camera…' : mode === 'demo' ? 'Demo scene' : mode === 'camera' ? 'Live camera' : 'Camera stopped');
  setText(ui.note, mode === 'demo' ? 'SIMULATED FINGERTIPS' : mode === 'camera' ? 'MIRRORED / LOCAL PROCESSING' : 'READY TO EXPLORE');
  setText(ui.tag, mode === 'demo' ? `DEMO / ${EFFECT_LABELS[renderer.effects.selected].toUpperCase()} / NORMAL FRAME`
    : mode === 'camera' ? `LIVE / ${EFFECT_LABELS[renderer.effects.selected].toUpperCase()}` : 'FINGERFRAME');
  ui.canvas.setAttribute('aria-label', mode === 'demo'
    ? `Animated demo with ${EFFECT_LABELS[renderer.effects.selected]} inside the simulated finger frame`
    : `Mirrored webcam with ${EFFECT_LABELS[renderer.effects.selected]} inside your four fingertip frame`);
}

function resetFrame() {
  stabilizer.reset();
  identities.reset();
  frameMotion.reset();
  renderer.effects.resetTemporal();
  tracker.resetVideo();
  trackingState = '';
  handCount = 0;
  lastRender = -Infinity;
  lastStats = performance.now();
  frameCount = 0;
  setText(ui.fps, '— fps');
  setText(ui.geometry, 'Lost');
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
  demoStartedAt = performance.now();
  renderer.resize(960, 600);
  resetFrame();
  refreshControls();
  setMessage('Demo: quad → bowtie → hand interchange. Start your camera to try it with your hands.');
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
  const state = mode === 'demo' ? `demo:${frame.kind}:${frame.state}:${frame.regions.length}` : !trackingReady ? trackerStatus : `${frame.state}:${frame.reason}:${frame.regions.length}`;
  if (state !== trackingState) {
    trackingState = state;
    ui.pill.dataset.state = frame.state;
    setText(ui.tracking, mode === 'demo' ? (frame.kind === 'bowtie' ? (frame.regions.length === 2 ? 'Simulated bowtie · both lobes' : 'Simulated bowtie · one visible lobe') : 'Simulated frame') : !trackingReady
      ? (trackerStatus === 'error' ? 'Tracker unavailable' : 'Loading hand tracker')
      : frame.state === 'tracked' ? (frame.kind === 'bowtie' ? 'Bowtie tracked' : 'Frame tracked')
        : frame.state === 'predicting' ? 'Briefly predicting hand motion' : frame.state === 'holding' ? 'Holding last frame' : frame.reason);
  }
  setText(ui.hands, mode === 'demo' ? '2 simulated hands' : `${handCount} / 2 hands`);
  setText(ui.geometry, frame.regions.length && frame.opacity > 0 ? (frame.kind === 'bowtie' ? 'Bowtie' : 'Quad') : 'Lost');
  if (mode === 'demo') setText(ui.tag, `DEMO / ${EFFECT_LABELS[renderer.effects.selected].toUpperCase()} / ${demoPhase(demoTime).toUpperCase()}`);
}

function render(timestamp) {
  animationId = null;
  if (mode === 'idle') return;
  if (!document.hidden && timestamp - lastRender >= 1000 / 30 - 1) {
    lastRender = timestamp;
    let hands = [];
    if (mode === 'demo') {
      demoTime = timestamp - demoStartedAt;
      drawDemoScene(renderer.sourceContext, ui.canvas.width, ui.canvas.height, demoTime);
      const simulated = demoHands(ui.canvas.width, ui.canvas.height, demoTime);
      drawDemoHands(renderer.sourceContext, simulated, ui.canvas.width, ui.canvas.height);
      identities.update(simulated, timestamp, ui.canvas.width, ui.canvas.height);
    } else if (ui.video.readyState >= 2) {
      renderer.drawCamera(ui.video);
      if (trackingReady) {
        try {
          const result = tracker.detect(ui.video, timestamp);
          if (result !== undefined) {
            handCount = result.landmarks.length;
            identities.update(extractHands(result, ui.canvas.width, ui.canvas.height), timestamp, ui.canvas.width, ui.canvas.height);
          }
        } catch (error) {
          console.error('Hand detection failed:', error);
          trackingReady = false;
          trackerStatus = 'error';
          stabilizer.reset();
          identities.reset();
          tracker.close();
          showError('Hand detection stopped. Stop and restart the camera to retry, or use Demo scene.');
        }
      }
    }
    hands = identities.snapshot(timestamp);
    stabilizer.update(fingertipsFromHands(hands), timestamp, ui.canvas.width, ui.canvas.height,
      { observedAt: hands.length === 2 ? Math.min(hands[0].lastSeen, hands[1].lastSeen) : -Infinity });
    const frame = stabilizer.snapshot(timestamp);
    const motion = renderer.effects.selected === 'motion-glitch' && ui.effect.checked ? frameMotion.update(frame, timestamp) : ZERO_MOTION;
    try {
      renderer.composite(frame, ui.effect.checked, true, hands, { motion, timestamp });
    } catch (error) {
      console.error('Effect rendering failed:', error);
      ui.effect.checked = false;
      renderer.composite(frame, false);
      showError('The selected effect could not process this image. Preview continues; try toggling the effect or choose Demo scene.');
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
for (const button of document.querySelectorAll('[data-effect]')) {
  button.addEventListener('click', () => {
    if (!renderer.effects.select(button.dataset.effect)) return;
    frameMotion.reset();
    for (const option of document.querySelectorAll('[data-effect]')) option.setAttribute('aria-pressed', String(option.dataset.effect === renderer.effects.selected));
    workspaceUI.setGraphiteSelected(renderer.effects.selected === 'graphite');
    refreshControls();
    setMessage(`${EFFECT_LABELS[renderer.effects.selected]} selected. ${renderer.effects.selected === 'graphite'
      ? 'Three independent five-position controls retain your choices.'
      : renderer.effects.selected === 'solarize' ? 'Anatomical bowtie lobes use warm and cool palettes.' : 'Move, rotate, or resize the frame to drive the distortion.'}`);
  });
}
for (const [name, value] of Object.entries(graphiteControls.levels)) {
  const input = $(`#${name}`);
  input.value = String(value);
  input.setAttribute('aria-valuetext', `${value}% control level`);
  input.addEventListener('input', () => {
    const numeric = Number(input.value);
    if (graphiteControls.set(name, numeric)) renderer.sketch.setParameters(graphiteControls.parameters);
    input.setAttribute('aria-valuetext', `${numeric}% control level`);
    setText($(`#${name}-value`), `${numeric}%`);
  });
}
ui.stop.addEventListener('click', () => stopCamera());
ui.demo.addEventListener('click', startDemo);
ui.effect.addEventListener('change', () => {
  frameMotion.reset();
  renderer.effects.resetTemporal();
  setMessage(ui.effect.checked ? `${EFFECT_LABELS[renderer.effects.selected]} on. Only the area inside the frame is processed.` : 'Effect off. The frame remains visible over the original image.');
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
  if (!document.hidden) {
    resetFrame();
    // Keep a tab return continuous rather than advancing through unseen phases.
    if (mode === 'demo') demoStartedAt = performance.now() - demoTime;
  }
});

startDemo();
