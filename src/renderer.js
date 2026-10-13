import { EffectPipeline } from './effectPipeline.js';
import { ForegroundHandMask } from './handMask.js';

export function polygonPath(context, points) {
  context.beginPath();
  appendPolygonPath(context, points);
}

function appendPolygonPath(context, points) {
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
  context.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.source = document.createElement('canvas');
    this.sourceContext = this.source.getContext('2d');
    this.effects = new EffectPipeline();
    this.sketch = this.effects.graphite;
    this.handMask = new ForegroundHandMask();
    this.resize(960, 600);
  }

  resize(width, height) {
    this.canvas.width = this.source.width = width;
    this.canvas.height = this.source.height = height;
    this.effects.resetTemporal();
  }

  drawCamera(video) {
    const ctx = this.sourceContext;
    ctx.save();
    ctx.translate(this.source.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, this.source.width, this.source.height);
    ctx.restore();
  }

  composite(frame, effectEnabled, showOutline = true, hands = [], effectContext = {}) {
    const ctx = this.context;
    const { width, height } = this.canvas;
    // Always redraw the original source: disabling the effect leaves no residue.
    ctx.drawImage(this.source, 0, 0, width, height);
    if (!frame.polygon || frame.opacity <= 0) return;
    if (effectEnabled) {
      const layers = this.effects.process(this.source, { ...effectContext, frame });
      for (const layer of layers) {
        ctx.save();
        ctx.beginPath();
        for (const region of layer.regions) appendPolygonPath(ctx, region);
        ctx.clip('evenodd');
        ctx.globalAlpha = frame.opacity;
        const bounds = layer.bounds;
        ctx.drawImage(layer.canvas, bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.restore();
      }
      ctx.save();
      ctx.beginPath();
      for (const region of frame.regions ?? [frame.polygon]) appendPolygonPath(ctx, region);
      ctx.clip('evenodd');
      // Restore actual source pixels, not a painted skin color. The current
      // polygon clip also confines feathering so outside pixels stay exact.
      ctx.globalAlpha = 1;
      this.handMask.restore(ctx, this.source, hands);
      ctx.restore();
    }
    if (showOutline) this.drawOutline(frame);
  }

  drawOutline(frame) {
    const ctx = this.context;
    const unit = Math.max(1, this.canvas.width / 960);
    ctx.save();
    ctx.globalAlpha = frame.opacity;
    polygonPath(ctx, frame.polygon);
    ctx.strokeStyle = 'rgba(18, 38, 30, .55)';
    ctx.lineWidth = 4 * unit;
    ctx.stroke();
    ctx.strokeStyle = frame.state === 'holding' || frame.state === 'predicting' ? '#f5c578' : '#c4f6d3';
    ctx.lineWidth = 1.7 * unit;
    if (frame.state === 'holding' || frame.state === 'predicting') ctx.setLineDash([6 * unit, 5 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const point of frame.polygon) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5.5 * unit, 0, Math.PI * 2);
      ctx.fillStyle = '#f6fff8';
      ctx.fill();
      ctx.lineWidth = 2 * unit;
      ctx.strokeStyle = '#276147';
      ctx.stroke();
    }
    ctx.restore();
  }
}
