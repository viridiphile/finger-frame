// An original Canvas illustration. It uses no image files, network or model.
function roundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function leaf(ctx, x, y, angle, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.ellipse(0, -27, 13, 29, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#60866c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -52);
  ctx.stroke();
  ctx.restore();
}

export function drawDemoScene(ctx, width, height, timestamp) {
  const time = timestamp / 1000;
  ctx.save();
  ctx.scale(width / 960, height / 600);
  const sky = ctx.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#e4d8c4');
  sky.addColorStop(1, '#f5ead8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 600);
  // Window, slow clouds, and distant hills provide moving, colored detail.
  roundedRect(ctx, 75, 44, 466, 350, 100, '#c5b69e');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(88, 56, 440, 322, 90);
  ctx.clip();
  ctx.fillStyle = '#b9cdd0';
  ctx.fillRect(88, 56, 440, 322);
  ctx.fillStyle = '#f9e2a0';
  ctx.beginPath();
  ctx.arc(425, 118, 34, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const x = 150 + i * 135 + Math.sin(time * 0.18 + i) * 32;
    ctx.fillStyle = '#edf1ea';
    ctx.beginPath();
    ctx.ellipse(x, 150 + i * 18, 60, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8da898';
  ctx.beginPath();
  ctx.moveTo(70, 380);
  ctx.bezierCurveTo(200, 180, 295, 255, 420, 309);
  ctx.bezierCurveTo(480, 240, 555, 265, 570, 380);
  ctx.fill();
  ctx.fillStyle = '#567d69';
  ctx.beginPath();
  ctx.moveTo(70, 380);
  ctx.bezierCurveTo(190, 282, 350, 412, 570, 303);
  ctx.lineTo(570, 390);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c5b69e';
  ctx.fillRect(301, 57, 9, 322);
  ctx.fillRect(88, 250, 440, 8);
  // A graphic art print on the wall.
  roundedRect(ctx, 650, 72, 159, 186, 4, '#b49874');
  roundedRect(ctx, 658, 80, 143, 170, 2, '#f6efe1');
  ctx.fillStyle = '#b96b45';
  ctx.beginPath();
  ctx.arc(728, 155, 40, Math.PI, 0);
  ctx.lineTo(768, 219);
  ctx.lineTo(688, 219);
  ctx.fill();
  ctx.fillStyle = '#e4b976';
  ctx.beginPath();
  ctx.arc(749, 117, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b08c66';
  ctx.fillRect(0, 426, 960, 174);
  ctx.fillStyle = '#cca77e';
  ctx.fillRect(0, 420, 960, 12);
  for (let y = 451; y < 600; y += 28) {
    ctx.strokeStyle = 'rgba(93, 61, 40, .12)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(300, y - 8, 660, y + 9, 960, y - 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(50, 46, 29, .14)';
  ctx.beginPath();
  ctx.ellipse(614, 487, 227, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  // Books, a cup and an animated plant show contours and shaded surfaces.
  roundedRect(ctx, 362, 457, 216, 26, 4, '#345d56');
  roundedRect(ctx, 371, 461, 199, 14, 2, '#ebe2cb');
  roundedRect(ctx, 387, 435, 194, 22, 3, '#b36246');
  roundedRect(ctx, 395, 439, 177, 13, 2, '#f5e8ce');
  ctx.strokeStyle = '#f4e5cd';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(346, 400, 23, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  roundedRect(ctx, 272, 360, 76, 82, [4, 4, 23, 23], '#f4e5cd');
  ctx.fillStyle = '#805a3d';
  ctx.beginPath();
  ctx.ellipse(310, 364, 32, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = 'rgba(255, 252, 240, .55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300 + i * 18, 346);
    ctx.bezierCurveTo(280 + i * 18, 326, 325 + i * 18 + Math.sin(time) * 8, 320, 302 + i * 18, 293);
    ctx.stroke();
  }
  const sway = Math.sin(time * 0.9) * 0.035;
  ctx.strokeStyle = '#41674e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(718, 415);
  ctx.quadraticCurveTo(724, 316, 712 + sway * 110, 239);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    leaf(ctx, 716 + Math.sin(i) * 7, 388 - i * 22, side * (0.7 + i * 0.055) + sway, 1.15 - i * 0.06, i % 2 ? '#486e52' : '#72926a');
  }
  ctx.fillStyle = '#c57c58';
  ctx.beginPath();
  ctx.moveTo(664, 395);
  ctx.lineTo(773, 395);
  ctx.lineTo(755, 486);
  ctx.quadraticCurveTo(718, 502, 681, 486);
  ctx.closePath();
  ctx.fill();
  roundedRect(ctx, 658, 389, 122, 18, 5, '#da9470');
  ctx.restore();
}

export function demoFingertips(width, height, timestamp) {
  const t = timestamp / 1000;
  const center = { x: width * (0.51 + Math.sin(t * 0.37) * 0.08), y: height * (0.52 + Math.cos(t * 0.31) * 0.03) };
  const frameWidth = width * (0.44 + Math.sin(t * 0.43) * 0.05);
  const frameHeight = height * (0.48 + Math.cos(t * 0.48) * 0.04);
  const angle = Math.sin(t * 0.29) * 0.2;
  return [
    { x: -1, y: 1, hand: 0, finger: 0 },
    { x: -1, y: -1, hand: 0, finger: 1 },
    { x: 1, y: 1, hand: 1, finger: 0 },
    { x: 1, y: -1, hand: 1, finger: 1 },
  ].map((p) => {
    const x = p.x * frameWidth / 2, y = p.y * frameHeight / 2;
    return { ...p, x: center.x + x * Math.cos(angle) - y * Math.sin(angle), y: center.y + x * Math.sin(angle) + y * Math.cos(angle) };
  });
}
