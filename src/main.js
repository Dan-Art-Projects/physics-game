import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { MAT } from './materials.js';

// ---- App state ----
const sim = new Simulation();
const container = document.getElementById('canvas-container');
const renderer = new Renderer(container);

let selectedMat = MAT.SAND;
let isMouseDown  = false;
let isRightDown  = false;
let lastGX = -1;
let lastGY = -1;

const ui = new UI(
  (matId) => { selectedMat = matId; },
  () => sim.clear(),
);

// ---- Mouse / touch input ----

function paintAt(screenX, screenY, erase) {
  const { gx, gy } = renderer.screenToGrid(screenX, screenY);
  if (gx === lastGX && gy === lastGY) return;
  lastGX = gx;
  lastGY = gy;

  const mat = erase ? MAT.EMPTY : selectedMat;
  sim.paint(gx, gy, ui.brushSize, mat);
}

// Draw a line between two grid points to avoid gaps during fast mouse moves
function paintLine(x0, y0, x1, y1, erase) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  const mat = erase ? MAT.EMPTY : selectedMat;
  let cx = x0, cy = y0;

  while (true) {
    sim.paint(cx, cy, ui.brushSize, mat);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 <  dx) { err += dx; cy += sy; }
  }
}

const canvas = renderer.renderer.domElement;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (e.button === 0) isMouseDown  = true;
  if (e.button === 2) isRightDown  = true;
  lastGX = -1; lastGY = -1;
  const erase = e.button === 2 || ui.eraseMode;
  paintAt(e.clientX, e.clientY, erase);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isMouseDown && !isRightDown) return;
  const erase = isRightDown || (isMouseDown && ui.eraseMode);

  const { gx: gx1, gy: gy1 } = renderer.screenToGrid(e.clientX, e.clientY);

  if (lastGX >= 0) {
    paintLine(lastGX, lastGY, gx1, gy1, erase);
  } else {
    sim.paint(gx1, gy1, ui.brushSize, erase ? MAT.EMPTY : selectedMat);
  }

  lastGX = gx1;
  lastGY = gy1;
});

canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) isMouseDown = false;
  if (e.button === 2) isRightDown = false;
});

canvas.addEventListener('mouseleave', () => {
  isMouseDown = false;
  isRightDown = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  ui.onScroll(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

// Touch support
let lastTouchX = -1, lastTouchY = -1;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  lastTouchX = -1; lastTouchY = -1;
  paintAt(t.clientX, t.clientY, ui.eraseMode);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const { gx, gy } = renderer.screenToGrid(t.clientX, t.clientY);
  if (lastTouchX >= 0) {
    paintLine(lastTouchX, lastTouchY, gx, gy, ui.eraseMode);
  }
  lastTouchX = gx;
  lastTouchY = gy;
}, { passive: false });

canvas.addEventListener('touchend', () => {
  lastTouchX = -1; lastTouchY = -1;
});

// ---- Game loop ----

let lastTime = 0;
const TARGET_FPS = 60;
const FRAME_MS   = 1000 / TARGET_FPS;

// How many sim steps to run per render frame (for speed)
const STEPS_PER_FRAME = 1;

function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt = timestamp - lastTime;
  if (dt < FRAME_MS - 1) return;
  lastTime = timestamp;

  for (let s = 0; s < STEPS_PER_FRAME; s++) {
    sim.step();
  }

  renderer.updateTexture(sim);
  renderer.render();
}

requestAnimationFrame(loop);
