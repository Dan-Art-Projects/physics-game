import {
  MAT, CAT,
  MATERIALS,
  getCategory, getDensity, isFlammable, canDisplace,
} from './materials.js';

export const GRID_W = 400;
export const GRID_H = 250;

export class Simulation {
  constructor() {
    const size = GRID_W * GRID_H;
    this.type    = new Uint8Array(size);
    this.life    = new Uint16Array(size);
    this.cv      = new Uint8Array(size);      // color variation 0-255 maps to ±15
    this.updated = new Uint8Array(size);

    this.frame = 0;
    this._leftToRight = true;
  }

  idx(x, y) {
    return y * GRID_W + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return MAT.STONE; // treat out-of-bounds as stone
    return this.type[this.idx(x, y)];
  }

  set(x, y, mat) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.type[i] = mat;
    this.life[i] = this._initLife(mat);
    this.cv[i]   = Math.floor(Math.random() * 256);
    this.updated[i] = 0;
  }

  _initLife(mat) {
    switch (mat) {
      case MAT.FIRE:      return 80  + Math.floor(Math.random() * 70);
      case MAT.SMOKE:     return 60  + Math.floor(Math.random() * 40);
      case MAT.STEAM:     return 120 + Math.floor(Math.random() * 60);
      default:            return 0;
    }
  }

  clear() {
    this.type.fill(0);
    this.life.fill(0);
    this.cv.fill(0);
    this.updated.fill(0);
  }

  // Paint a filled circle of material
  paint(cx, cy, radius, mat) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          this.set(cx + dx, cy + dy, mat);
        }
      }
    }
  }

  // --- Movement helpers ---

  tryMove(x1, y1, x2, y2) {
    if (!this.inBounds(x2, y2)) return false;
    const i1 = this.idx(x1, y1);
    const i2 = this.idx(x2, y2);

    if (this.updated[i2]) return false;
    if (!canDisplace(this.type[i1], this.type[i2])) return false;

    // Swap
    const t = this.type[i1];  this.type[i1]  = this.type[i2];  this.type[i2]  = t;
    const l = this.life[i1];  this.life[i1]  = this.life[i2];  this.life[i2]  = l;
    const c = this.cv[i1];    this.cv[i1]    = this.cv[i2];    this.cv[i2]    = c;

    this.updated[i1] = 1;
    this.updated[i2] = 1;
    return true;
  }

  markUpdated(x, y) {
    if (this.inBounds(x, y)) this.updated[this.idx(x, y)] = 1;
  }

  // --- Main step ---

  step() {
    this.updated.fill(0);
    this._leftToRight = !this._leftToRight;
    this.frame++;

    for (let y = GRID_H - 1; y >= 0; y--) {
      if (this._leftToRight) {
        for (let x = 0; x < GRID_W; x++) this._updateCell(x, y);
      } else {
        for (let x = GRID_W - 1; x >= 0; x--) this._updateCell(x, y);
      }
    }
  }

  _updateCell(x, y) {
    const i = this.idx(x, y);
    if (this.updated[i]) return;

    const mat = this.type[i];
    if (mat === MAT.EMPTY) return;

    const cat = getCategory(mat);

    switch (cat) {
      case CAT.POWDER:  this._updatePowder(x, y, mat, i); break;
      case CAT.LIQUID:  this._updateLiquid(x, y, mat, i); break;
      case CAT.GAS:     this._updateGas(x, y, mat, i);    break;
      case CAT.SOLID:   this._updateSolid(x, y, mat, i);  break;
    }
  }

  // --- Powder (sand, gunpowder) ---

  _updatePowder(x, y, mat, i) {
    // Interactions first (before movement)
    this._interactPowder(x, y, mat, i);
    if (this.type[i] !== mat) return; // transformed

    // Fall straight down
    if (this.tryMove(x, y, x, y + 1)) return;

    // Slide diagonally
    const left  = x - 1 + (this._leftToRight ? 0 : 1);
    const right = x + 1 - (this._leftToRight ? 0 : 1);
    // Try both directions, bias by frame direction
    const a = this._leftToRight ? left : right;
    const b = this._leftToRight ? right : left;

    if (this.tryMove(x, y, a, y + 1)) return;
    if (this.tryMove(x, y, b, y + 1)) return;

    this.updated[i] = 1;
  }

  _interactPowder(x, y, mat, i) {
    if (mat === MAT.GUNPOWDER) {
      // Check neighbors for fire or lava
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        const n = this.get(x + dx, y + dy);
        if (n === MAT.FIRE || n === MAT.LAVA) {
          this._explode(x, y);
          return;
        }
      }
    }
  }

  // --- Liquid (water, oil, lava, acid) ---

  _updateLiquid(x, y, mat, i) {
    // Interactions first
    this._interactLiquid(x, y, mat, i);
    if (this.type[i] !== mat) return;

    // Fall down
    if (this.tryMove(x, y, x, y + 1)) return;

    // Spread horizontally (dispersion)
    const dispersion = 5;
    const dir = this._leftToRight ? 1 : -1;

    // Try one direction then the other
    let moved = false;
    for (let d = 1; d <= dispersion; d++) {
      if (this.tryMove(x, y, x + dir * d, y)) { moved = true; break; }
      if (!this.inBounds(x + dir * d, y) || this.type[this.idx(x + dir * d, y)] !== MAT.EMPTY) break;
    }
    if (!moved) {
      for (let d = 1; d <= dispersion; d++) {
        if (this.tryMove(x, y, x - dir * d, y)) { break; }
        if (!this.inBounds(x - dir * d, y) || this.type[this.idx(x - dir * d, y)] !== MAT.EMPTY) break;
      }
    }

    this.updated[i] = 1;
  }

  _interactLiquid(x, y, mat, i) {
    if (mat === MAT.LAVA) {
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const n = this.type[ni];

        if (n === MAT.WATER) {
          // Lava -> stone, water -> steam
          this.type[i]  = MAT.STONE;
          this.cv[i]    = Math.floor(Math.random() * 256);
          this.type[ni] = MAT.STEAM;
          this.life[ni] = this._initLife(MAT.STEAM);
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[i] = 1;
          this.updated[ni] = 1;
          return;
        }
        if (n === MAT.ICE) {
          // Lava -> stone, ice -> water
          this.type[i]  = MAT.STONE;
          this.cv[i]    = Math.floor(Math.random() * 256);
          this.type[ni] = MAT.WATER;
          this.life[ni] = 0;
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[i] = 1;
          this.updated[ni] = 1;
          return;
        }
        // Lava ignites flammables
        if (isFlammable(n) && Math.random() < 0.03) {
          this.type[ni] = MAT.FIRE;
          this.life[ni] = this._initLife(MAT.FIRE);
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[ni] = 1;
        }
      }
    }

    if (mat === MAT.ACID) {
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const n = this.type[ni];
        if (n === MAT.STONE || n === MAT.SAND || n === MAT.WOOD || n === MAT.PLANT) {
          if (Math.random() < 0.015) {
            this.type[ni] = MAT.EMPTY;
            this.updated[ni] = 1;
            // Acid may consume itself
            if (Math.random() < 0.3) {
              this.type[i] = MAT.EMPTY;
              this.updated[i] = 1;
              return;
            }
          }
        }
      }
    }

    if (mat === MAT.WATER) {
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const n = this.type[ni];
        if (n === MAT.FIRE) {
          // Water extinguishes fire -> smoke
          this.type[ni] = MAT.SMOKE;
          this.life[ni] = this._initLife(MAT.SMOKE);
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[ni] = 1;
          // Water becomes steam
          this.type[i]  = MAT.STEAM;
          this.life[i]  = this._initLife(MAT.STEAM);
          this.cv[i]    = Math.floor(Math.random() * 256);
          this.updated[i] = 1;
          return;
        }
      }
    }
  }

  // --- Gas (fire, smoke, steam) ---

  _updateGas(x, y, mat, i) {
    // Tick life down
    if (this.life[i] > 0) {
      this.life[i]--;
      if (this.life[i] === 0) {
        this._gasExpire(x, y, mat, i);
        return;
      }
    }

    // Interactions
    this._interactGas(x, y, mat, i);
    if (this.type[i] !== mat) return;

    // Rise upward
    if (this.tryMove(x, y, x, y - 1)) return;

    // Spread horizontally (random walk)
    const dir = (Math.random() < 0.5 ? 1 : -1);
    if (this.tryMove(x, y, x + dir, y - 1)) return;
    if (this.tryMove(x, y, x - dir, y - 1)) return;
    if (this.tryMove(x, y, x + dir, y)) return;
    if (this.tryMove(x, y, x - dir, y)) return;

    this.updated[i] = 1;
  }

  _gasExpire(x, y, mat, i) {
    if (mat === MAT.FIRE) {
      this.type[i] = MAT.SMOKE;
      this.life[i] = this._initLife(MAT.SMOKE);
      this.cv[i]   = Math.floor(Math.random() * 256);
    } else if (mat === MAT.STEAM) {
      // Chance to condense to water
      if (Math.random() < 0.4) {
        this.type[i] = MAT.WATER;
        this.life[i] = 0;
        this.cv[i]   = Math.floor(Math.random() * 256);
      } else {
        this.type[i] = MAT.EMPTY;
      }
    } else {
      this.type[i] = MAT.EMPTY;
    }
    this.updated[i] = 1;
  }

  _interactGas(x, y, mat, i) {
    if (mat === MAT.FIRE) {
      // Spread to flammable neighbors
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const n = this.type[ni];
        if (isFlammable(n) && Math.random() < 0.025) {
          this.type[ni] = MAT.FIRE;
          this.life[ni] = this._initLife(MAT.FIRE);
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[ni] = 1;
        }
        if (n === MAT.WATER && Math.random() < 0.05) {
          // Fire extinguished by nearby water
          this.type[i] = MAT.SMOKE;
          this.life[i] = this._initLife(MAT.SMOKE);
          this.updated[i] = 1;
          this.type[ni] = MAT.STEAM;
          this.life[ni] = this._initLife(MAT.STEAM);
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[ni] = 1;
          return;
        }
        if (n === MAT.ICE && Math.random() < 0.02) {
          this.type[ni] = MAT.WATER;
          this.life[ni] = 0;
          this.cv[ni]   = Math.floor(Math.random() * 256);
          this.updated[ni] = 1;
        }
        if (n === MAT.GUNPOWDER) {
          this._explode(nx, ny);
          return;
        }
      }
    }
  }

  // --- Solid (stone, ice, wood, plant) ---

  _updateSolid(x, y, mat, i) {
    if (mat === MAT.ICE) {
      // Melt if adjacent to fire or lava
      const neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of neighbors) {
        const n = this.get(x + dx, y + dy);
        if (n === MAT.FIRE || n === MAT.LAVA) {
          if (Math.random() < 0.02) {
            this.type[i] = MAT.WATER;
            this.life[i] = 0;
            this.cv[i]   = Math.floor(Math.random() * 256);
            this.updated[i] = 1;
            return;
          }
        }
      }
    }

    if (mat === MAT.PLANT) {
      // Grow toward adjacent water slowly
      if (Math.random() < 0.003) {
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        // Shuffle
        for (let d = dirs.length - 1; d > 0; d--) {
          const j = Math.floor(Math.random() * (d + 1));
          [dirs[d], dirs[j]] = [dirs[j], dirs[d]];
        }
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (!this.inBounds(nx, ny)) continue;
          const ni = this.idx(nx, ny);
          if (this.type[ni] === MAT.WATER) {
            // Grow plant here (consume water)
            this.type[ni] = MAT.PLANT;
            this.cv[ni]   = Math.floor(Math.random() * 256);
            this.updated[ni] = 1;
            return;
          }
        }
      }
    }

    this.updated[i] = 1;
  }

  // --- Explosion ---

  _explode(cx, cy) {
    const RADIUS = 12;
    const R2 = RADIUS * RADIUS;
    const INNER = 6;
    const I2 = INNER * INNER;

    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;

        const t = this.type[ni];
        if (t === MAT.STONE) continue; // stone resists explosion

        if (d2 <= I2) {
          // Inner: clear to empty
          this.type[ni] = MAT.EMPTY;
        } else {
          // Outer ring: fire
          if (t === MAT.EMPTY || t === MAT.GUNPOWDER || isFlammable(t)) {
            this.type[ni] = MAT.FIRE;
            this.life[ni] = this._initLife(MAT.FIRE);
            this.cv[ni]   = Math.floor(Math.random() * 256);
          }
        }
        this.updated[ni] = 1;
      }
    }

    // Chain: any adjacent gunpowder?
    // (already handled because they get fire set on them and will trigger next frame)
  }
}
