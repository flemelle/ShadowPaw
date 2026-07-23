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
// Portée maximale d'un saut en course (cf. entities/Player.ts : MOVE_SPEED=200, JUMP_SPEED=480,
// gravité=900) : temps de vol 2*480/900 ≈ 1.067s à 200px/s ≈ 213px ≈ 6.67 tuiles de 32px. Une
// fosse plus large que ça est mathématiquement infranchissable au jugé, quel que soit le doigté
// du joueur ; on plafonne donc à 4 tuiles pour garder une marge confortable (~40%) pour un élan
// imparfait, un saut débuté un peu en retard, etc. — plutôt que de coller au maximum théorique.
const MAX_SAFE_PIT_WIDTH = 4;

/**
 * "Salle des Miroirs" (zone7) : génère une moitié normalement puis la duplique en miroir
 * pour l'autre — plutôt qu'un simple réglage de paramètres, une vraie symétrie structurelle
 * qui distingue enfin cette zone des sept autres construites sur le même moule aléatoire.
 */
function generateMirroredZone(profile) {
  const halfCols = Math.floor(profile.cols / 2);
  const half = generateZone({ ...profile, cols: halfCols, mirror: false });
  const { rows } = profile;
  const cols = halfCols * 2;

  const tiles = half.tiles.map((row) => row + [...row].reverse().join(''));
  const floorTopByCol = [...half.floorTopByCol, ...[...half.floorTopByCol].reverse()];

  // safeCols/groundCols doivent être reconstruits sur la grille complète (celles de `half`
  // ne couvrent que la première moitié) plutôt que simplement dupliquées-inversées.
  const occupied = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] === '#') occupied[y][x] = true;
    }
  }
  const safeCols = [];
  const groundCols = [];
  for (let x = 0; x < cols; x++) {
    if (floorTopByCol[x] != null) {
      groundCols.push({ x, y: floorTopByCol[x] - 1 });
      safeCols.push({ x, y: floorTopByCol[x] - 1 });
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] === '#' && (y === 0 || tiles[y - 1][x] !== '#') && (floorTopByCol[x] == null || y < floorTopByCol[x])) {
        safeCols.push({ x, y: y - 1 });
      }
    }
  }
  safeCols.sort((a, b) => a.x - b.x);
  groundCols.sort((a, b) => a.x - b.x);

  return { tiles, safeCols, groundCols, floorTopByCol };
}

function generateZone(profile) {
  const { cols, rows, seed, pitChance, pitWidth, plat, gateChar, gateSpots, undulate, ceilingGap } = profile;
  if (profile.mirror) return generateMirroredZone(profile);
  const rand = mulberry32(seed);
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));

  // --- Sol (2 rangées), avec fosses ponctuelles et ondulation optionnelle ---
  let floorTop = rows - ceilingGap; // rangée du dessus du sol
  const floorTopByCol = [];
  let x = 0;
  let justHadPit = false;
  // Colonnes de sol pleines à garantir après une fosse : sans ça, une nouvelle fosse pouvait
  // être tirée une seule colonne plus loin, mettant bout à bout deux fosses "sûres" en un
  // gouffre cumulé plus large que MAX_SAFE_PIT_WIDTH — et surtout sans la moindre place pour
  // reprendre son élan avant le saut suivant.
  const MIN_SOLID_AFTER_PIT = 3;
  let solidRunSincePit = Infinity;
  while (x < cols) {
    // Pas d'ondulation juste après une fosse : un atterrissage plus haut que le décollage
    // réduirait encore la portée de saut déjà consommée par la traversée de la fosse elle-même.
    if (undulate && !justHadPit && x > 8 && x < cols - 8 && rand() < 0.12) {
      const delta = rand() < 0.5 ? -1 : 1;
      floorTop = Math.min(rows - 2, Math.max(4, floorTop + delta));
    }
    const canRollPit = x > 8 && x < cols - 10 && solidRunSincePit >= MIN_SOLID_AFTER_PIT;
    const inPit = canRollPit && rand() < pitChance;
    const maxWidth = Math.min(pitWidth[1], MAX_SAFE_PIT_WIDTH);
    const minWidth = Math.min(pitWidth[0], maxWidth);
    const width = inPit ? minWidth + Math.floor(rand() * (maxWidth - minWidth + 1)) : 1;
    justHadPit = inPit;
    solidRunSincePit = inPit ? 0 : solidRunSincePit + width;
    for (let i = 0; i < width && x < cols; i++, x++) {
      floorTopByCol[x] = inPit ? null : floorTop;
      if (!inPit) {
        for (let y = floorTop; y < rows; y++) grid[y][x] = '#';
      }
    }
  }

  // --- Plateformes flottantes ---
  // Isolées et espacées : chaque plateforme réserve une marge libre autour d'elle
  // (occupied[]) avant d'être posée, pour ne jamais coller à une autre plateforme
  // ni former de "mur"/cul-de-sac. Une plateforme peut être longue, mais il y a
  // toujours du vide entre deux plateformes pour que le joueur puisse circuler.
  const safeCols = [];
  const occupied = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (let cx = 0; cx < cols; cx++) {
    const ft = floorTopByCol[cx];
    if (ft != null) for (let y = ft; y < rows; y++) occupied[y][cx] = true;
  }

  const GAP_X = 3; // colonnes de vide obligatoires de part et d'autre
  const GAP_Y_ABOVE = 3; // dégagement vertical au-dessus (place pour sauter/atterrir)
  // Doit couvrir au moins la clearance minimale voulue entre une plateforme et ce qu'il y a
  // dessous (cf. plat.heightAbove) : sans ça, une plateforme large posée au-dessus d'un sol
  // dont la hauteur varie sous son empan pouvait se retrouver à 1 seule tuile du sol à une
  // extrémité même quand son point d'ancrage respectait les 2 tuiles de dégagement voulues.
  const GAP_Y_BELOW = 2;

  const canPlace = (px, py, width) => {
    if (py < 2 || py >= rows - 1) return false;
    for (let dx = -GAP_X; dx < width + GAP_X; dx++) {
      const cx = px + dx;
      if (cx < 0 || cx >= cols) return false;
      for (let dy = -GAP_Y_ABOVE; dy <= GAP_Y_BELOW; dy++) {
        const cy = py + dy;
        if (cy < 0 || cy >= rows) continue;
        if (occupied[cy][cx]) return false;
      }
    }
    return true;
  };

  const placePlatform = (px, py, width) => {
    for (let dx = 0; dx < width; dx++) {
      const cx = px + dx;
      if (cx < 0 || cx >= cols) continue;
      grid[py][cx] = '#';
      occupied[py][cx] = true;
      safeCols.push({ x: cx, y: py - 1 });
    }
  };

  for (let i = 0; i < plat.count; i++) {
    // 15% de chances d'une "tour" en hauteur (4-6 marches), 30% d'un escalier classique (2-3),
    // le reste une plateforme seule. Chaque marche reste construite exactement comme avant
    // (même formule de clearance/écart horizontal) : une tour n'est donc jamais qu'un escalier
    // classique poursuivi plus longtemps, ce qui garantit par construction qu'aucune marche
    // n'est jamais à plus d'un saut de la précédente, même en haut d'une tour de 6 marches.
    const chainRoll = rand();
    const chainLen = chainRoll < 0.15 ? 4 + Math.floor(rand() * 3) : chainRoll < 0.45 ? 2 + Math.floor(rand() * 2) : 1;
    let px = 6 + Math.floor(rand() * (cols - 16));
    let refY = floorTopByCol[Math.min(cols - 1, Math.max(0, px))] ?? rows - 2;
    const dir = rand() < 0.5 ? -1 : 1;

    for (let step = 0; step < chainLen; step++) {
      const width = plat.width[0] + Math.floor(rand() * (plat.width[1] - plat.width[0] + 1));
      // plat.heightAbove est le nombre de tuiles VIDES entre le sommet du sol/de la marche
      // précédente et le dessous de cette plateforme (donc +1 dans le calcul de la rangée :
      // avec un delta de rangée égal à heightAbove, la case juste sous la plateforme EST déjà
      // le sol, ce qui ne laissait qu'une seule tuile de dégagement réel au lieu de deux).
      const clearance = plat.heightAbove[0] + Math.floor(rand() * (plat.heightAbove[1] - plat.heightAbove[0] + 1));
      const py = Math.max(3, refY - clearance - 1);

      // Quelques essais avec un léger décalage horizontal si la place manque, sinon on abandonne cette marche.
      let placed = false;
      for (let attempt = 0; attempt < 4 && !placed; attempt++) {
        const tryX = px + (attempt === 0 ? 0 : Math.floor(rand() * 6 - 3));
        if (canPlace(tryX, py, width)) {
          placePlatform(tryX, py, width);
          px = tryX;
          placed = true;
        }
      }
      if (!placed) break; // pas la peine de continuer la chaîne si cette marche ne rentre pas

      refY = py;
      // L'écart entre deux marches d'un même escalier doit rester sautable EN MONTANT (ou en
      // descendant) : un saut qui doit aussi gagner de la hauteur couvre moins de distance
      // horizontale qu'un saut à plat (cf. MAX_SAFE_PIT_WIDTH plus haut, pensé pour un saut à
      // plat). Un vide de 3 à 5 tuiles entre marches reste sûr même pour un dénivelé de 2-3.
      px += dir * (width + GAP_X + Math.floor(rand() * 3));
      if (px < 4 || px > cols - 6) break;
    }
  }

  // --- Gates (obstruent un passage en hauteur, jamais dans la rangée de sol elle-même) ---
  // Avec des cratères plus larges/fréquents, la colonne visée tombe parfois dans une
  // fosse (pas de sol) : on cherche alors la colonne de sol la plus proche pour que
  // la gate reste posée sur du solide plutôt que de flotter au-dessus du vide.
  gateSpots.forEach((frac) => {
    let gx = Math.max(10, Math.min(cols - 10, Math.floor(cols * frac)));
    if (floorTopByCol[gx] == null) {
      for (let d = 1; d < cols; d++) {
        if (floorTopByCol[gx - d] != null) { gx -= d; break; }
        if (floorTopByCol[gx + d] != null) { gx += d; break; }
      }
    }
    const floorY = floorTopByCol[gx] ?? rows - 2;
    grid[floorY - 1][gx] = gateChar;
    if (rows - 2 >= floorY) grid[floorY][gx] === '#' && (grid[floorY][gx] = gateChar);
  });

  // Colonnes de sol "sûres" (pour poser des entités), échantillonnées régulièrement. Séparées
  // de `safeCols` (qui mélange sol ET sommets de plateformes) : un boss/autel/sortie de zone
  // placé sur une plateforme plutôt qu'au sol n'est pas garanti accessible (une plateforme peut
  // être en haut d'un escalier dont chaque marche est déjà à la limite du saut, cf. heightAbove
  // — un jeu qui monte ET avance en même temps a une portée horizontale bien moindre qu'un saut
  // à plat). Les entités de progression doivent donc toujours atterrir au sol, jamais en l'air.
  const groundCols = [];
  for (let cx = 0; cx < cols; cx++) {
    if (floorTopByCol[cx] != null) {
      groundCols.push({ x: cx, y: floorTopByCol[cx] - 1 });
      safeCols.push({ x: cx, y: floorTopByCol[cx] - 1 });
    }
  }
  safeCols.sort((a, b) => a.x - b.x);
  groundCols.sort((a, b) => a.x - b.x);

  const tiles = grid.map((row) => row.join(''));
  return { tiles, safeCols, groundCols, floorTopByCol };
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
  // Ruines extérieures, nuit — zone d'intro : calme, peu de fosses, plateformes larges.
  zone1_portes_velkhar: {
    cols: 130, rows: 14, ceilingGap: 3, seed: 101,
    pitChance: 0.06, pitWidth: [2, 4],
    plat: { count: 18, width: [4, 6], heightAbove: [2, 2] },
    // Zone 1 : le joueur n'a encore AUCUN pouvoir. Ses propres gates ('C', griffes)
    // ne peuvent donc pas y apparaître — griffes_renforcees n'est justement accordé
    // qu'en battant le boss de cette même zone. Sans ça, la zone était infranchissable
    // hors Mode Admin (cf. "les pouvoirs doivent s'acquérir au fur et à mesure").
    gateChar: 'C', gateSpots: [],
    // Un léger relief plutôt qu'un sol parfaitement plat sur 130 colonnes : reste calme
    // (amplitude ±1 tuile, 12% des colonnes), juste moins monotone à traverser.
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.15, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  // Dojo souterrain, chaînes — plafond bas et dense : plateformes étroites et rapprochées,
  // moins de dégagement vertical, pour une sensation d'enfermement distincte du plein air.
  zone2_antre_velours_noir: {
    cols: 145, rows: 15, ceilingGap: 5, seed: 202,
    pitChance: 0.11, pitWidth: [2, 4],
    plat: { count: 34, width: [2, 3], heightAbove: [2, 2] },
    gateChar: 'C', gateSpots: [0.25, 0.5, 0.78],
    // Sol de caverne irrégulier plutôt que plat : cohérent avec l'ambiance "grotte" et casse
    // la linéarité du couloir.
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.2, boss_arena0: 0.87, zone_exit0: 0.97 },
  },
  // Cœur du sanctuaire, énergie sombre pulsante — verticalité marquée, sol qui monte et
  // descend sans cesse (undulate) : une traversée en dents de scie plutôt qu'un sol plat.
  zone3_velkhar_foyer_ombres: {
    cols: 145, rows: 19, ceilingGap: 3, seed: 303,
    pitChance: 0.1, pitWidth: [2, 4],
    plat: { count: 30, width: [3, 5], heightAbove: [2, 2] },
    gateChar: 'V', gateSpots: [0.3, 0.65],
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.22, npc1: 0.4, boss_arena0: 0.87, zone_exit0: 0.97 },
  },
  // Temple au sommet, silence absolu — sobre et ordonné : fosses rares, plateformes larges
  // et régulièrement espacées, aucune ondulation. L'antithèse du chaos qui suivra en Acte 2.
  zone4_seikuji_quietude: {
    cols: 160, rows: 16, ceilingGap: 3, seed: 404,
    pitChance: 0.05, pitWidth: [2, 3],
    plat: { count: 26, width: [4, 7], heightAbove: [2, 2] },
    gateChar: 'D', gateSpots: [0.2, 0.4, 0.6, 0.8],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.1, boss_arena0: 0.45, power_altar0: 0.9, zone_exit0: 0.98 },
  },
  // Le même temple, corrompu — l'ordre de la zone 4 se fissure : plus de fosses, sol
  // irrégulier (undulate), plateformes de tailles très inégales.
  zone5_seikuji_corrompu: {
    cols: 160, rows: 15, ceilingGap: 3, seed: 505,
    pitChance: 0.12, pitWidth: [2, 4],
    plat: { count: 34, width: [2, 6], heightAbove: [2, 2] },
    gateChar: 'L', gateSpots: [0.3, 0.6],
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.15, puzzle_trigger0: 0.5, zone_exit0: 0.97 },
  },
  // Jardins extérieurs, végétation corrompue — terrain organique et sinueux : ondulation
  // plus fréquente que partout ailleurs, plateformes larges façon frondaisons.
  zone6_jardins_oublies: {
    cols: 190, rows: 16, ceilingGap: 3, seed: 606,
    pitChance: 0.08, pitWidth: [2, 4],
    plat: { count: 30, width: [4, 7], heightAbove: [2, 2] },
    gateChar: 'L', gateSpots: [0.25, 0.55],
    undulate: true,
    entityFracs: { spawn: 0.02, npc0: 0.08, puzzle_trigger0: 0.2, puzzle_trigger1: 0.4, puzzle_trigger2: 0.6, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  // Salle des Miroirs — vraie symétrie structurelle (cf. generateMirroredZone) plutôt qu'un
  // simple réglage de paramètres : la moitié gauche est reflétée à l'identique à droite.
  zone7_salle_miroirs: {
    cols: 190, rows: 16, ceilingGap: 3, seed: 707,
    pitChance: 0.08, pitWidth: [2, 4],
    plat: { count: 17, width: [3, 5], heightAbove: [2, 2] },
    gateChar: 'S', gateSpots: [0.35, 0.7],
    undulate: false,
    mirror: true,
    entityFracs: { spawn: 0.02, npc0: 0.1, puzzle_trigger0: 0.22, puzzle_trigger1: 0.42, puzzle_trigger2: 0.62, boss_arena0: 0.85, zone_exit0: 0.97 },
  },
  // Le vide entre lumière et ombre, décor abstrait — le moins de sol possible : de rares
  // îlots flottants largement espacés au-dessus d'un vide quasi continu, jamais un long
  // couloir de terrain plein comme les sept autres zones.
  zone8_vide_entre_deux: {
    cols: 130, rows: 14, ceilingGap: 3, seed: 808,
    pitChance: 0.2, pitWidth: [2, 4],
    plat: { count: 20, width: [2, 4], heightAbove: [2, 2] },
    gateChar: 'S', gateSpots: [],
    undulate: false,
    entityFracs: { spawn: 0.03, puzzle_trigger0: 0.25, npc0: 0.55, boss_arena0: 0.85, ending_trigger0: 0.97 },
  },
};

// 5 mobs par zone, répartis uniformément de gauche à droite — le tier (1-5) monte avec la
// position dans la zone, pour une difficulté "crescendo" au sein même du chapitre (en plus de
// l'escalade d'une zone à l'autre, cf. mobHp/mobSpeed dans entities/Enemy.ts qui combinent les deux).
const MOB_FRACS = [0.18, 0.34, 0.5, 0.66, 0.82];

for (const file of fs.readdirSync(MAPS_DIR)) {
  if (!/^zone\d\.json$/.test(file)) continue;
  const full = path.join(MAPS_DIR, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const profile = ZONE_PROFILES[data.id];
  if (!profile) continue;

  // Idempotent : n'ajoute les mobs qu'une fois, un ré-run du script ne les duplique pas.
  if (!data.entities.some((e) => e.type === 'mob')) {
    for (let tier = 1; tier <= 5; tier++) data.entities.push({ type: 'mob', x: 0, y: 0, tier });
  }

  const { tiles, groundCols } = generateZone(profile);
  const used = new Set();

  // Assigne x,y à chaque entité existante, dans l'ordre où elles apparaissent, en réutilisant
  // la fraction prévue pour son "slot" (spawn, npc0, npc1, ...) — toujours au sol (groundCols),
  // jamais sur une plateforme flottante potentiellement hors de portée de saut.
  const typeCounters = {};
  const newEntities = data.entities.map((entity) => {
    const idx = typeCounters[entity.type] ?? 0;
    typeCounters[entity.type] = idx + 1;
    const key = idx === 0 ? `${entity.type}0` : `${entity.type}${idx}`;
    const frac = entity.type === 'mob' ? MOB_FRACS[entity.tier - 1] : (profile.entityFracs[entity.type === 'spawn' ? 'spawn' : key] ?? 0.5);
    const pos = pickAt(groundCols, profile.cols, frac, used);
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
