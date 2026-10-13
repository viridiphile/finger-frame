// Original Canvas artwork inspired by the user's desk and apartment photos.
// Static scenery is rasterized once per source context/size. The existing demo
// hands and frame animate independently, keeping the effects as the focus.
const scenes = new WeakMap();
const TAU = Math.PI * 2;

function roundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  ctx.fill();
}

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function line(ctx, points, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
}

function apartment(ctx, x, y, width, color, rightSide = false) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 240);
  ctx.fillStyle = '#687f83';
  ctx.fillRect(x + (rightSide ? 0 : width - 9), y, 9, 240);
  ctx.fillStyle = '#d8ded6';
  ctx.fillRect(x - 3, y, width + 6, 5);
  for (let row = 0; row < 5; row++) {
    const top = y + 18 + row * 43;
    roundedRect(ctx, x + 8, top, width - 23, 27, 1, '#e0e3d8');
    ctx.fillStyle = '#70868a';
    ctx.fillRect(x + 11, top + 3, width - 29, 19);
    line(ctx, [[x + width / 2 - 3, top + 3], [x + width / 2 - 3, top + 22]], '#c4d0cc', 2);
    // Simplified balcony ledges, retaining the apartment-view identity.
    ctx.fillStyle = '#b9c4bd';
    ctx.fillRect(x + 5, top + 23, width - 15, 5);
    line(ctx, [[x + 9, top + 20], [x + width - 16, top + 20]], '#8b9b92');
  }
}

function mountainWindow(ctx) {
  roundedRect(ctx, 273, 41, 654, 348, 8, '#dfd9ca');
  roundedRect(ctx, 282, 49, 636, 329, 5, '#657c75');
  ctx.save();
  ctx.beginPath(); ctx.roundRect(292, 59, 616, 309, 2); ctx.clip();
  const sky = ctx.createLinearGradient(0, 59, 0, 368);
  sky.addColorStop(0, '#b9d0d6'); sky.addColorStop(0.6, '#e0e5dc'); sky.addColorStop(1, '#f1e7ce');
  ctx.fillStyle = sky; ctx.fillRect(292, 59, 616, 309);
  // Broad, quiet cloud bands; no sun disc or distracting background animation.
  ellipse(ctx, 527, 108, 149, 18, '#eaf0e8');
  ellipse(ctx, 614, 119, 120, 15, '#eaf0e8');
  ellipse(ctx, 845, 83, 113, 12, '#dce6e2');
  polygon(ctx, [[292, 291], [339, 223], [374, 234], [409, 210], [454, 253], [504, 225], [554, 203], [599, 142], [634, 162], [673, 183], [724, 224], [756, 208], [788, 229], [828, 205], [871, 236], [908, 223], [908, 368], [292, 368]], '#91aaa6');
  polygon(ctx, [[292, 330], [325, 281], [354, 252], [382, 266], [423, 245], [467, 282], [509, 258], [549, 218], [586, 176], [623, 200], [663, 236], [700, 259], [733, 241], [774, 278], [819, 234], [859, 273], [908, 253], [908, 368], [292, 368]], '#5b8177');
  // Sunlit faces and shaded gullies echo the steep forested reference ridges.
  polygon(ctx, [[586, 176], [549, 218], [509, 258], [470, 310], [524, 290], [560, 236]], '#8fa78c');
  polygon(ctx, [[586, 176], [610, 242], [651, 292], [623, 200]], '#4e746d');
  polygon(ctx, [[423, 245], [382, 266], [348, 315], [394, 295]], '#9aae8e');
  polygon(ctx, [[819, 234], [774, 278], [743, 325], [792, 305]], '#86a285');
  polygon(ctx, [[292, 355], [339, 328], [367, 336], [409, 318], [448, 335], [492, 322], [542, 341], [580, 315], [629, 332], [666, 314], [713, 340], [759, 329], [801, 338], [852, 317], [908, 334], [908, 368], [292, 368]], '#476d58');
  line(ctx, [[353, 307], [386, 283], [413, 273]], '#a5b99b', 2);
  line(ctx, [[557, 264], [542, 283], [514, 299]], '#b4c2a4', 2);
  line(ctx, [[624, 254], [642, 271], [650, 290]], '#749388', 2);
  // Two cropped towers frame the view rather than filling it with city detail.
  apartment(ctx, 284, 183, 70, '#9caeb0');
  apartment(ctx, 853, 159, 65, '#899fa5', true);
  ctx.restore();
  ctx.fillStyle = '#71867c'; ctx.fillRect(716, 58, 7, 311);
  ctx.fillRect(722, 181, 186, 6);
  line(ctx, [[285, 51], [915, 51]], '#b1bfb1', 2);
  roundedRect(ctx, 727, 241, 5, 27, 2, '#d8dfd4');
  roundedRect(ctx, 270, 377, 661, 14, 3, '#b7bca6');
  ctx.fillStyle = '#89937f'; ctx.fillRect(279, 389, 644, 4);
}

function woodenDesk(ctx) {
  const wood = ctx.createLinearGradient(0, 398, 0, 600);
  wood.addColorStop(0, '#d9b576'); wood.addColorStop(0.5, '#cba16b'); wood.addColorStop(1, '#b68a5c');
  ctx.fillStyle = wood; ctx.fillRect(0, 401, 960, 199);
  ctx.fillStyle = '#ebca90'; ctx.fillRect(0, 398, 960, 6);
  // A few long grain lines give Graphite structure without scattered clutter.
  for (let i = 0; i < 8; i++) {
    const y = 421 + i * 24;
    ctx.strokeStyle = i % 2 ? '#8d653221' : '#fff0c326';
    ctx.lineWidth = i % 2 ? 1 : 2;
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.bezierCurveTo(235, y - 8, 536, y + 8, 960, y - 3); ctx.stroke();
  }
  ctx.fillStyle = '#a87c4e'; ctx.fillRect(0, 580, 960, 20);
  ctx.fillStyle = '#e5bf81'; ctx.fillRect(0, 580, 960, 3);
}

function wallArt(ctx) {
  // An original botanical sun-shadow print, inspired by the user's green art
  // reference. Its small warm frame balances the mountain window on the right.
  roundedRect(ctx, 80, 72, 147, 164, 2, '#968c6f24');
  roundedRect(ctx, 76, 67, 147, 164, 2, '#ac8c64');
  roundedRect(ctx, 80, 71, 139, 156, 1, '#d8bc87');
  const paper = ctx.createLinearGradient(85, 76, 214, 222);
  paper.addColorStop(0, '#84956b'); paper.addColorStop(1, '#c7c698');
  ctx.fillStyle = paper; ctx.fillRect(85, 76, 129, 146);
  ctx.save(); ctx.beginPath(); ctx.rect(85, 76, 129, 146); ctx.clip();
  // Warm light panes fall diagonally across the green paper.
  for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) {
    const x = 104 + column * 52, y = 90 + row * 42 + column * 13;
    polygon(ctx, [[x, y], [x + 44, y + 11], [x + 44, y + 46], [x, y + 35]], '#e9dfb2');
  }
  line(ctx, [[102, 232], [119, 194], [113, 164]], '#637750', 3);
  line(ctx, [[115, 211], [143, 188], [155, 158]], '#637750', 2);
  for (const [x, y, angle] of [[111, 200, -0.7], [121, 188, 0.8], [111, 178, -0.9], [137, 193, -0.7], [149, 177, 0.7], [155, 164, -0.8]]) {
    ellipse(ctx, x, y, 5, 12, '#637750', angle);
  }
  polygon(ctx, [[88, 218], [123, 218], [119, 233], [91, 233]], '#697b52');
  ctx.restore();
  line(ctx, [[77, 68], [221, 68]], '#c2a678');
}

function succulent(ctx) {
  ellipse(ctx, 106, 486, 40, 7, '#74553820');
  ctx.fillStyle = '#bd896e'; ctx.beginPath();
  ctx.moveTo(77, 444); ctx.lineTo(83, 479);
  ctx.quadraticCurveTo(106, 490, 129, 479); ctx.lineTo(135, 444);
  ctx.closePath(); ctx.fill();
  ellipse(ctx, 106, 444, 29, 7, '#d9b093');
  ellipse(ctx, 106, 443, 24, 5, '#7c6850');
  line(ctx, [[84, 451], [89, 477]], '#e2b59b', 3);
  for (const [angle, scale, color] of [[-1.15, 0.85, '#6e8a72'], [1.15, 0.85, '#7c9578'], [-0.55, 1, '#a0b292'], [0.55, 1, '#8ca682'], [0, 1, '#739476']]) {
    ctx.save(); ctx.translate(106, 438); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 8);
    ctx.quadraticCurveTo(-17, -6, 0, -37); ctx.quadraticCurveTo(17, -6, 0, 8); ctx.fill();
    line(ctx, [[0, 3], [0, -26]], '#c8d2b470');
    ctx.restore();
  }
  ellipse(ctx, 106, 432, 7, 10, '#aec09c');
}

function barLamp(ctx) {
  // The long light bar and integrated pen cup come from the user's desk lamp.
  const glow = ctx.createRadialGradient(286, 368, 10, 286, 368, 146);
  glow.addColorStop(0, '#fff2bd40'); glow.addColorStop(1, '#fff2bd00');
  ctx.fillStyle = glow; ctx.fillRect(140, 246, 294, 237);
  ellipse(ctx, 255, 457, 99, 10, '#65513721');
  roundedRect(ctx, 182, 436, 159, 18, 5, '#bdc4b6');
  roundedRect(ctx, 178, 431, 159, 17, 5, '#e6e8d9');
  roundedRect(ctx, 218, 272, 8, 160, 3, '#edf0e5');
  roundedRect(ctx, 224, 279, 3, 152, 1, '#aab4a8');
  // The support meets the underside of the rotated bar at (224, 252).
  line(ctx, [[222, 280], [224, 251]], '#e6e8d9', 8);
  line(ctx, [[224, 279], [226, 251]], '#aab4a8', 1.5);
  ellipse(ctx, 222, 276, 5, 5, '#d4dccd');
  ctx.save(); ctx.translate(180, 251); ctx.rotate(-0.12);
  roundedRect(ctx, -8, -13, 197, 19, 8, '#d5bd82');
  roundedRect(ctx, -5, -11, 191, 11, 5, '#e9d9a9');
  roundedRect(ctx, 0, 3, 183, 3, 1, '#fff2bb');
  line(ctx, [[37, -11], [37, 1]], '#c2a873');
  line(ctx, [[151, -11], [151, 1]], '#c2a873');
  ctx.restore();
  // Three stationery silhouettes, kept in the lamp's base instead of loose.
  line(ctx, [[287, 403], [273, 348]], '#496c5c', 5);
  line(ctx, [[304, 403], [313, 342]], '#b67c50', 5);
  line(ctx, [[296, 403], [296, 355]], '#819997', 4);
  polygon(ctx, [[310, 342], [315, 342], [313, 335]], '#e1c09a');
  roundedRect(ctx, 275, 386, 47, 46, [2, 2, 5, 5], '#dfe5d5');
  ctx.fillStyle = '#bfcebd'; ctx.fillRect(309, 388, 13, 41);
  line(ctx, [[278, 388], [306, 388]], '#f6f5e8', 2);
  ellipse(ctx, 199, 439, 2, 1, '#a7b9a1');
}

function laptop(ctx) {
  ellipse(ctx, 522, 466, 185, 16, '#664c3526');
  roundedRect(ctx, 380, 269, 292, 178, 10, '#1f3030');
  roundedRect(ctx, 387, 276, 278, 164, 5, '#52645c');
  roundedRect(ctx, 393, 282, 266, 149, 3, '#263a37');
  ellipse(ctx, 526, 273, 1.6, 1.6, '#87948b');
  // An abstract notes/editor screen, with no copied screen content or branding.
  roundedRect(ctx, 400, 289, 252, 135, 3, '#f0eade');
  roundedRect(ctx, 400, 289, 252, 12, [3, 3, 0, 0], '#dedecf');
  for (const [x, color] of [[407, '#bf8266'], [414, '#d0b06f'], [421, '#89a287']]) ellipse(ctx, x, 295, 1.8, 1.8, color);
  ctx.fillStyle = '#405c52'; ctx.fillRect(400, 301, 55, 123);
  roundedRect(ctx, 407, 311, 34, 5, 1, '#a9bc9e');
  for (let row = 0; row < 6; row++) {
    roundedRect(ctx, 407, 328 + row * 12, row % 2 ? 25 : 33, 2, 1, '#849c88');
    if (row === 2) roundedRect(ctx, 402, 347, 49, 12, 2, '#628071');
  }
  roundedRect(ctx, 470, 312, 100, 7, 2, '#486c58');
  roundedRect(ctx, 470, 325, 77, 3, 1, '#b1b5a0');
  for (let row = 0; row < 4; row++) roundedRect(ctx, 470, 344 + row * 10, [141, 126, 154, 117][row], 2, 1, '#8d9f89');
  roundedRect(ctx, 470, 391, 60, 20, 3, '#bf9665');
  roundedRect(ctx, 538, 391, 78, 20, 3, '#a8b8a0');
  line(ctx, [[580, 313], [628, 313]], '#c2c1aa', 2);
  line(ctx, [[580, 318], [618, 318]], '#c2c1aa', 2);
  // Keyboard deck seen in perspective; its broad tonal bands read in each mode.
  polygon(ctx, [[380, 443], [672, 443], [706, 486], [353, 486]], '#7d8b81');
  polygon(ctx, [[386, 446], [666, 446], [687, 477], [373, 477]], '#364c46');
  for (let row = 0; row < 3; row++) {
    const y = 450 + row * 7;
    const left = 390 - row * 4;
    for (let key = 0; key < 13; key++) roundedRect(ctx, left + key * 21, y, 17, 4, 1, '#70837a');
  }
  polygon(ctx, [[482, 472], [572, 472], [578, 482], [477, 482]], '#a9b3a5');
  roundedRect(ctx, 352, 483, 355, 6, [0, 0, 4, 4], '#293e37');
  roundedRect(ctx, 506, 483, 43, 2, 1, '#819185');
}

function hironoFigure(ctx, x, floor, scale, outfit) {
  ctx.save(); ctx.translate(x, floor); ctx.scale(scale, scale);
  ellipse(ctx, 0, 2, 28, 5, '#69523a24');
  ellipse(ctx, 0, 0, 25, 4, outfit === 'striped' ? '#d6c7a9' : '#617368');
  const clothes = outfit === 'cone' ? '#7095a4' : outfit === 'striped' ? '#c6a964' : '#e8e5d8';
  // Short limbs, oversized cheeks, shaggy bangs and sleepy eyes are the
  // collectible silhouettes; the costumes are simplified from the user's photo.
  roundedRect(ctx, -15, -37, 30, 26, 9, clothes);
  ellipse(ctx, -17, -25, 5, 9, clothes, -0.25);
  ellipse(ctx, 17, -25, 5, 9, clothes, 0.25);
  roundedRect(ctx, -13, -14, 11, 13, 3, outfit === 'striped' ? '#587a68' : '#d7c9af');
  roundedRect(ctx, 2, -14, 11, 13, 3, outfit === 'striped' ? '#a85f4e' : '#d7c9af');
  if (outfit === 'striped') {
    for (const [left, color] of [[-10, '#985447'], [-3, '#4b7469'], [4, '#56778a']]) {
      roundedRect(ctx, left, -30, 4, 24, 1, color);
    }
    roundedRect(ctx, -21, -41, 42, 11, 4, '#cbae6b');
  }
  roundedRect(ctx, -15, -4, 13, 5, 2, '#4e5950');
  roundedRect(ctx, 2, -4, 13, 5, 2, '#4e5950');
  const skin = outfit === 'candle' ? '#eed4ba' : '#deb998';
  ellipse(ctx, -20, -57, 4, 5, skin); ellipse(ctx, 20, -57, 4, 5, skin);
  ellipse(ctx, 0, -58, 22, 20, skin);
  polygon(ctx, [[-14, -43], [-3, -41], [-3, -39], [-11, -40]], '#c9947c');
  const hair = outfit === 'candle' ? '#deded0' : outfit === 'striped' ? '#a96549' : '#293b3c';
  ctx.fillStyle = hair; ctx.beginPath();
  ctx.moveTo(-23, -57); ctx.quadraticCurveTo(-26, -80, -6, -83);
  ctx.quadraticCurveTo(14, -88, 25, -70);
  ctx.lineTo(23, -57); ctx.lineTo(16, -64); ctx.lineTo(12, -58);
  ctx.lineTo(5, -69); ctx.lineTo(0, -60); ctx.lineTo(-6, -69);
  ctx.lineTo(-12, -60); ctx.lineTo(-17, -65); ctx.closePath(); ctx.fill();
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 9, -55, 6, 4, '#f5ead8', side * -0.1);
    ellipse(ctx, side * 8, -54, 2.3, 2.7, '#293b38');
    line(ctx, [[side * 4, -58], [side * 14, -60]], '#715e4f', 2);
    ellipse(ctx, side * 15, -49, 3, 1.6, '#cb9a86');
  }
  ellipse(ctx, 0, -49, 1.8, 1.2, '#b3886c');
  line(ctx, [[-3, -44], [3, -44]], '#936e58');
  if (outfit === 'cone') {
    ellipse(ctx, 0, -78, 23, 5, '#b86157');
    polygon(ctx, [[-16, -80], [0, -114], [16, -80]], '#be625a');
    polygon(ctx, [[-12, -89], [-9, -95], [9, -95], [12, -89]], '#f1dfc4');
    polygon(ctx, [[-5, -103], [-3, -108], [3, -108], [5, -103]], '#f1dfc4');
  } else if (outfit === 'striped') {
    ellipse(ctx, 0, -77, 28, 6, '#6a5549');
    polygon(ctx, [[-21, -79], [-24, -111], [23, -111], [20, -79]], '#735e4d');
    ellipse(ctx, 0, -111, 24, 5, '#8c7760');
    line(ctx, [[-20, -88], [20, -88]], '#a48865', 4);
    polygon(ctx, [[0, -104], [2, -100], [7, -99], [3, -96], [4, -92], [0, -94], [-4, -92], [-3, -96], [-7, -99], [-2, -100]], '#d3b873');
  } else {
    // Small candle-topped pale figure from the photo, kept separate from the lamp.
    roundedRect(ctx, -4, -94, 8, 15, 2, '#e8d8a8');
    ellipse(ctx, 0, -99, 4, 7, '#d6b566');
    ellipse(ctx, 0, -98, 1.6, 4, '#f3ddb1');
  }
  ctx.restore();
}

function figurines(ctx) {
  // A small collection on a low wooden ledge, not a single anonymous doll.
  ellipse(ctx, 776, 425, 111, 10, '#7451381a');
  roundedRect(ctx, 684, 414, 211, 9, 3, '#a57e54');
  roundedRect(ctx, 681, 411, 211, 6, 2, '#dcc08d');
  hironoFigure(ctx, 715, 409, 0.92, 'cone');
  hironoFigure(ctx, 777, 409, 1, 'striped');
  hironoFigure(ctx, 843, 411, 0.89, 'candle');
}

function notebook(ctx) {
  ctx.save(); ctx.translate(0, 20);
  ellipse(ctx, 546, 543, 120, 10, '#7355381a');
  polygon(ctx, [[439, 487], [615, 494], [648, 547], [465, 539]], '#658372');
  polygon(ctx, [[442, 481], [611, 488], [642, 541], [466, 533]], '#f1e8d2');
  line(ctx, [[464, 489], [625, 495]], '#d0c5ab', 1.2);
  for (let row = 0; row < 5; row++) line(ctx, [[464 + row * 4, 495 + row * 7], [616 + row * 4, 501 + row * 7]], '#c3c9b6');
  line(ctx, [[482, 489], [507, 535]], '#bc92825c');
  for (let ring = 0; ring < 8; ring++) ellipse(ctx, 448 + ring * 3, 486 + ring * 6, 2.3, 1.4, '#a29478');
  line(ctx, [[661, 508], [728, 522]], '#344f48', 5);
  line(ctx, [[665, 507], [714, 517]], '#96ad9a', 1.5);
  polygon(ctx, [[728, 519], [733, 524], [725, 523]], '#d8d0b1');
  ctx.restore();
}

function flowerLamp(ctx) {
  // A folded white flower-shaped shade on a continuous gooseneck, inspired by
  // the actual lamp. Overlapping folds give it volume instead of a daisy outline.
  const glow = ctx.createRadialGradient(875, 350, 2, 875, 350, 78);
  glow.addColorStop(0, '#fff3cd24'); glow.addColorStop(1, '#fff3cd00');
  ctx.fillStyle = glow; ctx.fillRect(796, 274, 159, 155);
  ellipse(ctx, 917, 434, 30, 5, '#775c3d21');
  ellipse(ctx, 915, 431, 27, 7, '#59755d');
  ellipse(ctx, 914, 427, 27, 7, '#819575');
  ctx.strokeStyle = '#657f65'; ctx.lineWidth = 4; ctx.beginPath();
  ctx.moveTo(914, 425); ctx.bezierCurveTo(903, 373, 938, 323, 917, 272); ctx.stroke();
  ctx.strokeStyle = '#a8b89a'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(915, 424); ctx.bezierCurveTo(905, 372, 939, 323, 918, 273); ctx.stroke();
  ctx.fillStyle = '#f6f1e2'; ctx.beginPath();
  ctx.moveTo(915, 272); ctx.quadraticCurveTo(895, 248, 882, 261);
  ctx.quadraticCurveTo(868, 240, 856, 258); ctx.quadraticCurveTo(837, 248, 841, 271);
  ctx.quadraticCurveTo(827, 283, 842, 295); ctx.quadraticCurveTo(835, 315, 854, 314);
  ctx.quadraticCurveTo(864, 331, 880, 316); ctx.quadraticCurveTo(902, 321, 906, 301);
  ctx.quadraticCurveTo(925, 291, 915, 272); ctx.fill();
  ctx.fillStyle = '#dfe3d3'; ctx.beginPath();
  ctx.moveTo(916, 272); ctx.quadraticCurveTo(883, 270, 842, 295);
  ctx.quadraticCurveTo(850, 299, 859, 304); ctx.quadraticCurveTo(890, 282, 916, 272); ctx.fill();
  ctx.fillStyle = '#fff9e9'; ctx.beginPath();
  ctx.moveTo(915, 272); ctx.quadraticCurveTo(875, 279, 854, 314);
  ctx.quadraticCurveTo(869, 319, 880, 316); ctx.quadraticCurveTo(885, 294, 915, 272); ctx.fill();
  ctx.fillStyle = '#e7e8d9'; ctx.beginPath();
  ctx.moveTo(916, 272); ctx.quadraticCurveTo(885, 264, 882, 261);
  ctx.quadraticCurveTo(875, 268, 872, 283); ctx.quadraticCurveTo(895, 272, 916, 272); ctx.fill();
  ellipse(ctx, 915, 273, 7, 8, '#6b8063', -0.4);
  line(ctx, [[849, 279], [899, 272]], '#ffffff85');
}

function paintStudyScene(ctx) {
  const wall = ctx.createLinearGradient(0, 0, 960, 600);
  wall.addColorStop(0, '#ece5d5'); wall.addColorStop(0.65, '#f4eddf'); wall.addColorStop(1, '#e5d8bd');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 960, 600);
  // A soft curtain edge balances the window without recreating the whole room.
  ctx.fillStyle = '#d8cebc'; ctx.fillRect(0, 0, 44, 403);
  ctx.fillStyle = '#e4dac8'; ctx.fillRect(9, 0, 14, 403);
  ctx.fillStyle = '#c5bda958'; ctx.fillRect(37, 0, 4, 403);
  wallArt(ctx);
  mountainWindow(ctx);
  woodenDesk(ctx);
  succulent(ctx);
  barLamp(ctx);
  flowerLamp(ctx);
  figurines(ctx);
  laptop(ctx);
  notebook(ctx);
}

export function drawStudyScene(ctx, width, height) {
  let scene = scenes.get(ctx);
  if (!scene || scene.width !== width || scene.height !== height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const illustration = canvas.getContext('2d');
    illustration.scale(width / 960, height / 600);
    paintStudyScene(illustration);
    scene = { canvas, width, height };
    scenes.set(ctx, scene);
  }
  ctx.drawImage(scene.canvas, 0, 0, width, height);
}
