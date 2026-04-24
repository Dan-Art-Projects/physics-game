import { MAT } from './materials.js';
import { GRID_W, GRID_H } from './simulation.js';

export class Renderer {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.width  = GRID_W;
    this.canvas.height = GRID_H;

    // CSS fills the viewport; no JS sizing math needed
    Object.assign(this.canvas.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      width:          '100%',
      height:         '100%',
      display:        'block',
      touchAction:    'none',
      imageRendering: 'pixelated',
    });

    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.imageData = new ImageData(GRID_W, GRID_H);
  }

  // No-op — CSS handles all resizing
  resize() {}

  // Use live bounding rect so coordinates are accurate regardless of
  // mobile address-bar state or any CSS change
  screenToGrid(px, py) {
    const rect = this.canvas.getBoundingClientRect();
    const gx = Math.floor((px - rect.left) / rect.width  * GRID_W);
    const gy = Math.floor((py - rect.top)  / rect.height * GRID_H);
    return { gx, gy };
  }

  updateTexture(sim) {
    const { type, life, cv } = sim;
    const data = this.imageData.data;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i  = y * GRID_W + x;
        const di = i * 4;
        const [r, g, b] = this._cellColor(type[i], life[i], cv[i]);
        data[di    ] = r;
        data[di + 1] = g;
        data[di + 2] = b;
        data[di + 3] = 255;
      }
    }
  }

  render() {
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  _cellColor(mat, life, cvByte) {
    const vari = (cvByte / 255) * 30 - 15;

    switch (mat) {
      case MAT.EMPTY:
        return [18, 18, 24];

      case MAT.SAND: {
        const v = vari | 0;
        return [clamp(194 + v, 0, 255), clamp(160 + v, 0, 255), clamp(80 + (v >> 1), 0, 255)];
      }

      case MAT.WATER: {
        const v = (vari * 0.5) | 0;
        return [clamp(40 + v, 0, 255), clamp(110 + v, 0, 255), clamp(200 + v, 0, 255)];
      }

      case MAT.STONE: {
        const v = vari | 0;
        return [clamp(120 + v, 0, 255), clamp(120 + v, 0, 255), clamp(130 + v, 0, 255)];
      }

      case MAT.FIRE: {
        const t = life / 150;
        return [255, clamp(Math.round(t * t * 200), 0, 255), clamp(Math.round(t * t * 40), 0, 255)];
      }

      case MAT.SMOKE: {
        const t = life / 100;
        const v = clamp(Math.round(80 * t + vari * t), 0, 255);
        return [v, v, clamp(v + 5, 0, 255)];
      }

      case MAT.OIL: {
        const v = (vari * 0.4) | 0;
        return [clamp(100 + v, 0, 255), clamp(60 + v, 0, 255), clamp(20 + v, 0, 255)];
      }

      case MAT.LAVA: {
        const pulse = Math.sin(cvByte * 0.05) * 15;
        return [
          clamp(220 + (pulse | 0), 0, 255),
          clamp(90  + ((pulse * 0.3) | 0), 0, 255),
          10,
        ];
      }

      case MAT.STEAM: {
        const t = Math.min(life / 150, 1);
        const v = clamp(Math.round(180 * t + vari), 0, 255);
        return [clamp(v - 20, 0, 255), clamp(v, 0, 255), clamp(v + 20, 0, 255)];
      }

      case MAT.ICE: {
        const v = (vari * 0.5) | 0;
        return [clamp(160 + v, 0, 255), clamp(220 + v, 0, 255), clamp(240 + v, 0, 255)];
      }

      case MAT.WOOD: {
        const v = (vari * 0.6) | 0;
        return [clamp(140 + v, 0, 255), clamp(90 + v, 0, 255), clamp(40 + (v >> 1), 0, 255)];
      }

      case MAT.ACID: {
        const v = (vari * 0.5) | 0;
        return [clamp(80 + v, 0, 255), clamp(200 + v, 0, 255), clamp(60 + v, 0, 255)];
      }

      case MAT.PLANT: {
        const v = (vari * 0.5) | 0;
        return [clamp(40 + v, 0, 255), clamp(150 + v, 0, 255), clamp(40 + v, 0, 255)];
      }

      case MAT.GUNPOWDER: {
        const v = (vari * 0.4) | 0;
        return [clamp(80 + v, 0, 255), clamp(80 + v, 0, 255), clamp(90 + v, 0, 255)];
      }

      default:
        return [255, 0, 255];
    }
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
