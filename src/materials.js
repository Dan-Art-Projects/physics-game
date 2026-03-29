// Material type IDs
export const MAT = {
  EMPTY:     0,
  SAND:      1,
  WATER:     2,
  STONE:     3,
  FIRE:      4,
  SMOKE:     5,
  OIL:       6,
  LAVA:      7,
  STEAM:     8,
  ICE:       9,
  WOOD:      10,
  ACID:      11,
  PLANT:     12,
  GUNPOWDER: 13,
};

// Category flags
export const CAT = {
  EMPTY:   0,
  POWDER:  1,
  LIQUID:  2,
  GAS:     3,
  SOLID:   4,
};

// Per-material definitions
export const MATERIALS = {
  [MAT.EMPTY]: {
    name: 'Empty',
    category: CAT.EMPTY,
    density: 0,
    color: [18, 18, 24],
    flammable: false,
  },
  [MAT.SAND]: {
    name: 'Sand',
    category: CAT.POWDER,
    density: 1.5,
    color: [194, 160, 80],
    flammable: false,
  },
  [MAT.WATER]: {
    name: 'Water',
    category: CAT.LIQUID,
    density: 1.0,
    color: [40, 110, 200],
    flammable: false,
  },
  [MAT.STONE]: {
    name: 'Stone',
    category: CAT.SOLID,
    density: 3.0,
    color: [120, 120, 130],
    flammable: false,
  },
  [MAT.FIRE]: {
    name: 'Fire',
    category: CAT.GAS,
    density: 0.1,
    color: [240, 140, 20],
    flammable: false,
    baseLife: 100,
  },
  [MAT.SMOKE]: {
    name: 'Smoke',
    category: CAT.GAS,
    density: 0.05,
    color: [90, 90, 100],
    flammable: false,
    baseLife: 80,
  },
  [MAT.OIL]: {
    name: 'Oil',
    category: CAT.LIQUID,
    density: 0.7,
    color: [100, 60, 20],
    flammable: true,
  },
  [MAT.LAVA]: {
    name: 'Lava',
    category: CAT.LIQUID,
    density: 2.0,
    color: [220, 90, 10],
    flammable: false,
  },
  [MAT.STEAM]: {
    name: 'Steam',
    category: CAT.GAS,
    density: 0.02,
    color: [180, 210, 240],
    flammable: false,
    baseLife: 150,
  },
  [MAT.ICE]: {
    name: 'Ice',
    category: CAT.SOLID,
    density: 2.5,
    color: [160, 220, 240],
    flammable: false,
  },
  [MAT.WOOD]: {
    name: 'Wood',
    category: CAT.SOLID,
    density: 2.8,
    color: [140, 90, 40],
    flammable: true,
  },
  [MAT.ACID]: {
    name: 'Acid',
    category: CAT.LIQUID,
    density: 1.2,
    color: [80, 200, 60],
    flammable: false,
  },
  [MAT.PLANT]: {
    name: 'Plant',
    category: CAT.SOLID,
    density: 1.0,
    color: [40, 150, 40],
    flammable: true,
  },
  [MAT.GUNPOWDER]: {
    name: 'Powder',
    category: CAT.POWDER,
    density: 1.6,
    color: [80, 80, 90],
    flammable: false,
  },
};

// Palette order for UI display (key shortcuts: 1-9, 0, q, w, e, r)
export const PALETTE = [
  MAT.SAND,
  MAT.WATER,
  MAT.STONE,
  MAT.FIRE,
  MAT.SMOKE,
  MAT.OIL,
  MAT.LAVA,
  MAT.STEAM,
  MAT.ICE,
  MAT.WOOD,
  MAT.ACID,
  MAT.PLANT,
  MAT.GUNPOWDER,
];

// Key bindings: key string -> material id
export const KEY_BINDINGS = {
  '1': MAT.SAND,
  '2': MAT.WATER,
  '3': MAT.STONE,
  '4': MAT.FIRE,
  '5': MAT.SMOKE,
  '6': MAT.OIL,
  '7': MAT.LAVA,
  '8': MAT.STEAM,
  '9': MAT.ICE,
  '0': MAT.WOOD,
  'q': MAT.ACID,
  'w': MAT.PLANT,
  'e': MAT.GUNPOWDER,
};

// Helpers
export function getCategory(type) {
  return MATERIALS[type]?.category ?? CAT.EMPTY;
}

export function getDensity(type) {
  return MATERIALS[type]?.density ?? 0;
}

export function isFlammable(type) {
  return MATERIALS[type]?.flammable ?? false;
}

export function getBaseColor(type) {
  return MATERIALS[type]?.color ?? [0, 0, 0];
}

export function canDisplace(moverType, targetType) {
  if (targetType === MAT.EMPTY) return true;

  const moverCat = getCategory(moverType);
  const targetCat = getCategory(targetType);

  // Solids never move
  if (targetCat === CAT.SOLID) return false;

  // Gases only move to empty cells
  if (moverCat === CAT.GAS) return false;

  // Powders displace liquids/gases below them
  if (moverCat === CAT.POWDER) {
    if (targetCat === CAT.GAS) return true;
    if (targetCat === CAT.LIQUID) return true;
    return false;
  }

  // Liquids displace lighter liquids and gases
  if (moverCat === CAT.LIQUID) {
    if (targetCat === CAT.GAS) return true;
    if (targetCat === CAT.LIQUID) {
      return getDensity(moverType) > getDensity(targetType);
    }
    return false;
  }

  return false;
}
