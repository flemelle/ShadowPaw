// One-off generator: builds much larger, visually distinct zone maps and
// repositions each zone's existing entities onto solid ground within them.
// Run with: node scripts/gen-zones.mjs
import fs from 'fs';
import path from 'path';

const MAPS_DIR = path.resolve('src/data/maps');

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Génère une grille (rows de chars) + la liste des colonnes "sûres" (sol présent,
 * plafond dégagé) utilisables pour poser des entités, en fonction d'un profil.
 */
function generateZone(profile) {
  const { cols, rows, seed, pitChance, pitWidth, plat, gateChar, gateSpots, undulate, ceilingGap } = profile;
  const rand = mulberry32(seed);
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));

  // --- Sol (2 rangées), avec fosses ponctuelles et ondulation optionnelle ---
  let floorTop = rows - ceilingGap; // rangée du dessus du sol
  const floorTopByCol = [];
  let x = 0;
  while (x < cols) {
    if (undulate && x > 8 && x < cols - 8 && rand() < 0.12) {
      const delta = rand() < 0.5 ? -1 : 1;
      floorTop = Math.min(rows - 2, Math.max(4, floorTop + delta));
    }
    const inPit = x > 8 && x < cols - 10 && rand() < pitChance;
    const width = inPit ? pitWidth[0] + Math.floor(rand() * (pitWidth[1] - pitWidth[0] + 1)) : 1;
    for (let i = 0; i < width && x < cols; i++, x++) {
      floorTopByCol[x] = inPit ? null : floorTop;
      if (!inPit) {
        for (let y = floorTop; y < rows; y++) grid[y][x] = '#';
      }
    }
  }

  // --- Plateformes flottantes ---
  const safeCols = [];
  for (let i = 0; i < plat.count; i++) {
    const px = 6 + Math.floor(rand() * (cols - 16));
    const width = plat.width[0] + Math.floor(rand() * (plat.width[1] - plat.width[0] + 1));
    const nearestFloor = floorTopByCol[Math.min(cols - 1, px)] ?? rows - 2;
    const py = Math.max(3, nearestFloor - (plat.heightAbove[0] + Math.floor(rand() * (plat.heightAbove[1] - plat.heightAbove[0] + 1))));
    for (let dx = 0; dx < width && px + dx < cols; dx++) {
      grid[py][px + dx] = '#';
      safeCols.push({ x: px + dx, y: py - 1 });
    }
  }

  // --- Gates (obstruent un passage en hauteur, jamais dans la rangée de sol elle-même) ---
  gateSpots.forEach((frac) => {
    const gx = Math.max(10, Math.min(cols - 10, Math.floor(cols * frac)));
    const floorY = floorTopByCol[gx] ?? rows - 2;
    grid[floorY - 1][gx] = gateChar;
    if (rows - 2 >= floorY) grid[floorY][gx] === '#' && (grid[floorY][gx] = gateChar);
  });

  // Colonnes de sol "sûres" (pour poser des entités), échantillonnées régulièrement.
  for (let cx = 0; cx < cols; cx++) {
    if (floorTopByCol[cx] != null) safeCols.push({ x: cx, y: floorTopByCol[cx] - 1 });
  }
  safeCols.sort((a, b) => a.x - b.x);

  const tiles = grid.map((row) => row.join(''));
  return { tiles, safeCols, floorTopByCol };
}

/** Choisit la colonne sûre la plus proche d'une fraction donnée de la largeur totale. */
function pickAt(safeCols, cols, frac, used) {
  const targetX = Math.floor(cols * frac);
  let best = null;
  let bestDist = Infinity;
  for (const c of safeCols) {
    if (used.has(c.x)) continue;
    const d = Math.abs(c.x - targetX);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  used.add(best.x);
  return best;
}

const ZONE_PROFILES = {
  zone1_portes_velkhar: {
    cols: 90, rows: 14, ceilingGap: 3, seed: 101,
    pitChance: 0.05, pitWidth: [2, 3],
    plat: { count: 10, width: [3, 5], heightAbove: [3, 5] },
    gateChar: 'C', gateSpots: [0.35, 0.68],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.15, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  zone2_antre_velours_noir: {
    cols: 100, rows: 14, ceilingGap: 3, seed: 202,
    pitChance: 0.06, pitWidth: [2, 2],
    plat: { count: 16, width: [2, 4], heightAbove: [2, 4] },
    gateChar: 'C', gateSpots: [0.25, 0.5, 0.78],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.2, boss_arena0: 0.87, zone_exit0: 0.97 },
  },
  zone3_velkhar_foyer_ombres: {
    cols: 100, rows: 16, ceilingGap: 3, seed: 303,
    pitChance: 0.05, pitWidth: [2, 4],
    plat: { count: 14, width: [3, 6], heightAbove: [4, 8] },
    gateChar: 'V', gateSpots: [0.3, 0.65],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.22, npc1: 0.4, boss_arena0: 0.87, zone_exit0: 0.97 },
  },
  zone4_seikuji_quietude: {
    cols: 110, rows: 16, ceilingGap: 3, seed: 404,
    pitChance: 0.04, pitWidth: [2, 3],
    plat: { count: 22, width: [2, 4], heightAbove: [2, 3] },
    gateChar: 'D', gateSpots: [0.2, 0.4, 0.6, 0.8],
    undulate: false,
    entityFracs: { spawn: 0.03, boss_arena0: 0.45, power_altar0: 0.9, zone_exit0: 0.98 },
  },
  zone5_seikuji_corrompu: {
    cols: 110, rows: 15, ceilingGap: 3, seed: 505,
    pitChance: 0.05, pitWidth: [2, 3],
    plat: { count: 14, width: [3, 5], heightAbove: [3, 6] },
    gateChar: 'L', gateSpots: [0.3, 0.6],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.15, puzzle_trigger0: 0.5, zone_exit0: 0.97 },
  },
  zone6_jardins_oublies: {
    cols: 130, rows: 16, ceilingGap: 3, seed: 606,
    pitChance: 0.05, pitWidth: [2, 3],
    plat: { count: 20, width: [3, 6], heightAbove: [3, 6] },
    gateChar: 'L', gateSpots: [0.25, 0.55],
    undulate: true,
    entityFracs: { spawn: 0.02, puzzle_trigger0: 0.2, puzzle_trigger1: 0.4, puzzle_trigger2: 0.6, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  zone7_salle_miroirs: {
    cols: 130, rows: 16, ceilingGap: 3, seed: 707,
    pitChance: 0.05, pitWidth: [2, 3],
    plat: { count: 18, width: [3, 5], heightAbove: [3, 7] },
    gateChar: 'S', gateSpots: [0.2, 0.5, 0.75],
    undulate: false,
    entityFracs: { spawn: 0.02, puzzle_trigger0: 0.22, puzzle_trigger1: 0.42, puzzle_trigger2: 0.62, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  zone8_vide_entre_deux: {
    cols: 90, rows: 14, ceilingGap: 3, seed: 808,
    pitChance: 0.1, pitWidth: [3, 5],
    plat: { count: 16, width: [3, 5], heightAbove: [2, 5] },
    gateChar: 'S', gateSpots: [],
    undulate: false,
    entityFracs: { spawn: 0.03, puzzle_trigger0: 0.25, npc0: 0.55, boss_arena0: 0.85, ending_trigger0: 0.97 },
  },
};

for (const file of fs.readdirSync(MAPS_DIR)) {
  if (!/^zone\d\.json$/.test(file)) continue;
  const full = path.join(MAPS_DIR, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const profile = ZONE_PROFILES[data.id];
  if (!profile) continue;

  const { tiles, safeCols } = generateZone(profile);
  const used = new Set();

  // Assigne x,y à chaque entité existante, dans l'ordre où elles apparaissent,
  // en réutilisant la fraction prévue pour son "slot" (spawn, npc0, npc1, ...).
  const typeCounters = {};
  const newEntities = data.entities.map((entity) => {
    const idx = typeCounters[entity.type] ?? 0;
    typeCounters[entity.type] = idx + 1;
    const key = idx === 0 ? `${entity.type}0` : `${entity.type}${idx}`;
    const frac = profile.entityFracs[entity.type === 'spawn' ? 'spawn' : key] ?? 0.5;
    const pos = pickAt(safeCols, profile.cols, frac, used);
    return { ...entity, x: pos.x, y: pos.y };
  });

  const updated = {
    ...data,
    cols: profile.cols,
    rows: profile.rows,
    notes: 'Layout procédural (scripts/gen-zones.mjs) — grande zone multi-écrans avec plateformes et obstacles liés aux pouvoirs.',
    tiles,
    entities: newEntities,
  };
  fs.writeFileSync(full, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Wrote ${file}: ${profile.cols}x${profile.rows}`);
}
