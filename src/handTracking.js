// Loaded only when the camera starts; the demo never needs the model or WASM.
export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.initializing = null;
    this.delegate = null;
    this.generation = 0;
    this.lastVideoTime = -1;
    this.lastDetection = -Infinity;
    this.input = document.createElement('canvas');
    this.context = this.input.getContext('2d');
  }

  async initialize() {
    if (this.landmarker) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.createLandmarker();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async createLandmarker() {
    const generation = this.generation;
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const base = import.meta.env.BASE_URL;
    const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const options = {
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };
    let landmarker;
    let delegate;
    try {
      landmarker = await HandLandmarker.createFromOptions(vision, {
        ...options, baseOptions: { modelAssetPath: `${base}mediapipe/hand_landmarker.task`, delegate: 'GPU' },
      });
      delegate = 'GPU';
    } catch (gpuError) {
      console.info('GPU initialization failed; trying the CPU delegate.', gpuError);
      landmarker = await HandLandmarker.createFromOptions(vision, {
        ...options, baseOptions: { modelAssetPath: `${base}mediapipe/hand_landmarker.task`, delegate: 'CPU' },
      });
      delegate = 'CPU';
    }
    // A page can be closed while the asynchronous model initialization is
    // running. Release a late result instead of retaining its GPU resources.
    if (generation !== this.generation) {
      landmarker.close();
      throw new DOMException('Hand tracker initialization was canceled.', 'AbortError');
    }
    this.landmarker = landmarker;
    this.delegate = delegate;
  }

  resetVideo() {
    this.lastVideoTime = -1;
    this.lastDetection = -Infinity;
  }

  detect(video, timestamp) {
    // undefined means "no new sample", distinct from a valid zero-hand result.
    // Throttling prevents repeated inference on one decoded video frame.
    if (!this.landmarker || video.readyState < 2 || video.currentTime === this.lastVideoTime
      || timestamp - this.lastDetection < 50) return undefined;
    this.lastVideoTime = video.currentTime;
    this.lastDetection = timestamp;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    if (this.input.width !== width || this.input.height !== height) {
      this.input.width = width;
      this.input.height = height;
    }
    // Detect on an unmirrored image; frameGeometry mirrors the landmark x.
    this.context.drawImage(video, 0, 0, width, height);
    return this.landmarker.detectForVideo(this.input, timestamp);
  }

  close() {
    this.generation++;
    this.landmarker?.close();
    this.landmarker = null;
  }
}
