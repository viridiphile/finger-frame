// A single capture remains active through asynchronous PNG encoding. Source
// changes invalidate its token, including callbacks already waiting on toBlob.
export class CaptureCountdown {
  constructor({ captureFrame, saveFrame, onChange, onError }) {
    this.captureFrame = captureFrame;
    this.saveFrame = saveFrame;
    this.onChange = onChange;
    this.onError = onError;
    this.active = false;
    this.remaining = 0;
    this.timer = null;
    this.generation = 0;
  }

  start() {
    if (this.active) return false;
    const generation = ++this.generation;
    this.active = true;
    this.remaining = 3;
    this.onChange();
    const tick = async () => {
      this.timer = null;
      if (generation !== this.generation) return;
      this.remaining--;
      this.onChange();
      if (this.remaining > 0) {
        this.timer = setTimeout(tick, 1000);
        return;
      }
      try {
        const frame = await this.captureFrame();
        if (generation !== this.generation) return;
        if (!frame) throw new Error('The canvas did not produce an image.');
        this.saveFrame(frame);
      } catch (error) {
        if (generation === this.generation) this.onError(error);
      } finally {
        if (generation === this.generation) {
          this.active = false;
          this.onChange();
        }
      }
    };
    this.timer = setTimeout(tick, 1000);
    return true;
  }

  cancel() {
    clearTimeout(this.timer);
    this.timer = null;
    this.generation++;
    this.active = false;
    this.remaining = 0;
    this.onChange();
  }
}
