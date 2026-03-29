import * as THREE from 'three';
import { MAT, MATERIALS, getBaseColor } from './materials.js';
import { GRID_W, GRID_H } from './simulation.js';

export class Renderer {
  constructor(container) {
    this.container = container;

    // Scene setup
    this.scene    = new THREE.Scene();
    this.camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    container.appendChild(this.renderer.domElement);

    // RGBA texture buffer: texture Y=0 is bottom, sim Y=0 is top → flip Y
    this.texData = new Uint8Array(GRID_W * GRID_H * 4);

    this.texture = new THREE.DataTexture(
      this.texData,
      GRID_W,
      GRID_H,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;

    const geo  = new THREE.PlaneGeometry(2, 2);
    const mat  = new THREE.MeshBasicMaterial({ map: this.texture });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);

    // Compute actual pixel dimensions of the sim canvas inside the window
    // Maintain aspect ratio of GRID_W:GRID_H
    const simAspect = GRID_W / GRID_H;
    const winAspect = w / h;

    if (winAspect > simAspect) {
      // Letterbox: height-constrained
      this.displayH = h;
      this.displayW = Math.floor(h * simAspect);
    } else {
      // Pillarbox: width-constrained
      this.displayW = w;
      this.displayH = Math.floor(w / simAspect);
    }

    this.offsetX = Math.floor((w - this.displayW) / 2);
    this.offsetY = Math.floor((h - this.displayH) / 2);
  }

  // Convert screen pixel (px, py) → sim grid cell (gx, gy)
  screenToGrid(px, py) {
    const gx = Math.floor((px - this.offsetX) / this.displayW  * GRID_W);
    const gy = Math.floor((py - this.offsetY) / this.displayH  * GRID_H);
    return { gx, gy };
  }

  updateTexture(sim) {
    const { type, life, cv } = sim;
    const buf = this.texData;

    for (let sy = 0; sy < GRID_H; sy++) {
      // Flip Y: sim row 0 (top) → texture row GRID_H-1 (top in GL = bottom-most data)
      const ty = GRID_H - 1 - sy;
      const simRowStart = sy  * GRID_W;
      const texRowStart = ty  * GRID_W;

      for (let x = 0; x < GRID_W; x++) {
        const si = simRowStart + x;
        const ti = (texRowStart + x) * 4;
        const mat = type[si];

        const [r, g, b] = this._cellColor(mat, life[si], cv[si]);
        buf[ti    ] = r;
        buf[ti + 1] = g;
        buf[ti + 2] = b;
        buf[ti + 3] = 255;
      }
    }

    this.texture.needsUpdate = true;
  }

  _cellColor(mat, life, cvByte) {
    // Map cvByte (0-255) to variation offset in range [-15, +15]
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
        // life fades from high→0; high life = white-yellow, low life = deep red
        const t = life / 150; // 0..1
        const r = clamp(Math.round(255), 0, 255);
        const g = clamp(Math.round(t * t * 200), 0, 255);
        const b = clamp(Math.round(t * t * 40), 0, 255);
        return [r, g, b];
      }

      case MAT.SMOKE: {
        // Fades from gray to black
        const t = life / 100;
        const v = clamp(Math.round(80 * t + vari * t), 0, 255);
        return [v, v, clamp(v + 5, 0, 255)];
      }

      case MAT.OIL: {
        const v = (vari * 0.4) | 0;
        return [clamp(100 + v, 0, 255), clamp(60 + v, 0, 255), clamp(20 + v, 0, 255)];
      }

      case MAT.LAVA: {
        // Pulse using life (life is 0 for lava, use cvByte as pseudo-time)
        const pulse = Math.sin(cvByte * 0.05) * 15;
        return [
          clamp(220 + (pulse | 0), 0, 255),
          clamp(90  + ((pulse * 0.3) | 0), 0, 255),
          clamp(10, 0, 255),
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
        return [255, 0, 255]; // magenta = unknown
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
