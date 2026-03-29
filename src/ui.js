import { MAT, MATERIALS, PALETTE, KEY_BINDINGS, getBaseColor } from './materials.js';

export class UI {
  constructor(onMaterialChange, onClear) {
    this.onMaterialChange = onMaterialChange;
    this.onClear = onClear;

    this.selectedMat = MAT.SAND;
    this.brushSize   = 5;
    this.eraseMode   = false;

    this._buttons = new Map(); // matId → button element

    this._buildPalette();
    this._bindClear();
    this._bindKeyboard();
    this._updateBrushDisplay();
    this._updateModeDisplay();
  }

  _buildPalette() {
    const palette = document.getElementById('palette');
    if (!palette) return;

    for (const matId of PALETTE) {
      const def = MATERIALS[matId];
      if (!def) continue;

      const [r, g, b] = def.color;
      const colorHex  = `rgb(${r},${g},${b})`;

      const btn = document.createElement('div');
      btn.className = 'mat-btn';
      btn.dataset.mat = matId;
      btn.title = `${def.name} (${this._keyForMat(matId)})`;

      const circle = document.createElement('div');
      circle.className = 'mat-circle';
      circle.style.background = colorHex;
      circle.style.boxShadow = `0 0 4px ${colorHex}66`;

      const label = document.createElement('div');
      label.className = 'mat-label';
      label.textContent = def.name.toUpperCase();

      btn.appendChild(circle);
      btn.appendChild(label);
      btn.addEventListener('click', () => this._selectMat(matId));

      palette.appendChild(btn);
      this._buttons.set(matId, btn);
    }

    this._updateActiveButton();
  }

  _keyForMat(matId) {
    for (const [key, id] of Object.entries(KEY_BINDINGS)) {
      if (id === matId) return key.toUpperCase();
    }
    return '?';
  }

  _bindClear() {
    const btn = document.getElementById('clear-btn');
    if (btn) btn.addEventListener('click', () => this.onClear());
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      // Material selection
      if (KEY_BINDINGS[key] !== undefined) {
        this._selectMat(KEY_BINDINGS[key]);
        return;
      }

      switch (key) {
        case '[':
          this.brushSize = Math.max(1, this.brushSize - 1);
          this._updateBrushDisplay();
          break;
        case ']':
          this.brushSize = Math.min(50, this.brushSize + 1);
          this._updateBrushDisplay();
          break;
        case 'c':
          this.onClear();
          break;
        case 'z':
          this.eraseMode = !this.eraseMode;
          this._updateModeDisplay();
          break;
      }
    });
  }

  _selectMat(matId) {
    this.selectedMat = matId;
    this._updateActiveButton();
    this.onMaterialChange(matId);
  }

  _updateActiveButton() {
    for (const [id, btn] of this._buttons) {
      btn.classList.toggle('active', id === this.selectedMat);
    }
  }

  _updateBrushDisplay() {
    const el = document.getElementById('brush-size-display');
    if (el) el.textContent = this.brushSize;
  }

  _updateModeDisplay() {
    const dot  = document.getElementById('mode-dot');
    const text = document.getElementById('mode-text');
    if (dot)  dot.classList.toggle('erase', this.eraseMode);
    if (text) text.textContent = this.eraseMode ? 'ERASE' : 'DRAW';
  }

  onScroll(delta) {
    if (delta > 0) {
      this.brushSize = Math.max(1, this.brushSize - 1);
    } else {
      this.brushSize = Math.min(50, this.brushSize + 1);
    }
    this._updateBrushDisplay();
  }
}
