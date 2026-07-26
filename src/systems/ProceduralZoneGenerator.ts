/**
 * Générateur procédural de secours — port TypeScript (navigateur) de scripts/gen-zones.mjs,
 * utilisé quand la génération IA (cf. ZoneGenerator.ts) échoue ou dépasse son délai. Même
 * algorithme, mêmes seeds : une zone "de secours" est donc toujours identique aux tuiles
 * statiques déjà commitées dans src/data/maps/, jamais une surprise non testée.
 */
import type { ZoneEntity, ZoneMap } from '@/utils/Types';
import { ZONE_PROFILES, MOB_FRACS, CAPTIVE_FRAC, CAT_DECOR_FRACS, CAT_DECOR_VARIANT_COUNT, MAX_SAFE_PIT_WIDTH } from './zoneProfiles';
import type { ZoneProfile } from './zoneProfiles';

interface SafeCol {
  x: number;
  y: number;
}

interface GeneratedGrid {
  tiles: string[];
  safeCols: SafeCol[];
  groundCols: SafeCol[];
  floorTopByCol: (number | null)[];
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARENA_HALF_WIDTH = 14;

function clearBossArena(
  grid: string[][],
  floorTopByCol: (number | null)[],
  cols: number,
  rows: number,
  bossFrac: number | undefined,
): void {
  if (bossFrac == null) return;
  const bossCol = Math.max(0, Math.min(cols - 1, Math.floor(cols * bossFrac)));
  const lo = Math.max(1, bossCol - ARENA_HALF_WIDTH);
  const hi = Math.min(cols - 2, bossCol + ARENA_HALF_WIDTH);

  let refFloor: number | null = null;
  for (let d = 0; d <= ARENA_HALF_WIDTH && refFloor == null; d++) {
    if (floorTopByCol[bossCol - d] != null) refFloor = floorTopByCol[bossCol - d];
    else if (floorTopByCol[bossCol + d] != null) refFloor = floorTopByCol[bossCol + d];
  }
  if (refFloor == null) refFloor = rows - 3;

  for (let x = lo; x <= hi; x++) {
    for (let y = 0; y < rows; y++) grid[y][x] = y >= (refFloor as number) ? '#' : '.';
    floorTopByCol[x] = refFloor;
  }
}

function generateMirroredZone(profile: ZoneProfile): GeneratedGrid {
  const halfCols = Math.floor(profile.cols / 2);
  const half = generateZone({ ...profile, cols: halfCols, mirror: false });
  const { rows } = profile;
  const cols = halfCols * 2;

  let tiles = half.tiles.map((row) => row + [...row].reverse().join(''));
  const floorTopByCol = [...half.floorTopByCol, ...[...half.floorTopByCol].reverse()];

  if (profile.entityFracs?.boss_arena0 != null) {
    const grid = tiles.map((row) => [...row]);
    clearBossArena(grid, floorTopByCol, cols, rows, profile.entityFracs.boss_arena0);
    tiles = grid.map((row) => row.join(''));
  }

  const safeCols: SafeCol[] = [];
  const groundCols: SafeCol[] = [];
  for (let x = 0; x < cols; x++) {
    if (floorTopByCol[x] != null) {
      groundCols.push({ x, y: (floorTopByCol[x] as number) - 1 });
      safeCols.push({ x, y: (floorTopByCol[x] as number) - 1 });
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] === '#' && (y === 0 || tiles[y - 1][x] !== '#') && (floorTopByCol[x] == null || y < (floorTopByCol[x] as number))) {
        safeCols.push({ x, y: y - 1 });
      }
    }
  }
  safeCols.sort((a, b) => a.x - b.x);
  groundCols.sort((a, b) => a.x - b.x);

  return { tiles, safeCols, groundCols, floorTopByCol };
}

export function generateZone(profile: ZoneProfile): GeneratedGrid {
  const { cols, rows, seed, pitChance, pitWidth, plat, gateChar, gateSpots, undulate, ceilingGap } = profile;
  if (profile.mirror) return generateMirroredZone(profile);
  const rand = mulberry32(seed);
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));

  let floorTop = rows - ceilingGap;
  const floorTopByCol: (number | null)[] = [];
  let x = 0;
  let justHadPit = false;
  const MIN_SOLID_AFTER_PIT = 3;
  let solidRunSincePit = Infinity;
  while (x < cols) {
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

  const safeCols: SafeCol[] = [];
  const occupied: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (let cx = 0; cx < cols; cx++) {
    const ft = floorTopByCol[cx];
    if (ft != null) for (let y = ft; y < rows; y++) occupied[y][cx] = true;
  }

  const GAP_X = 3;
  const GAP_Y_ABOVE = 3;
  const GAP_Y_BELOW = 2;

  const canPlace = (px: number, py: number, width: number): boolean => {
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

  const placePlatform = (px: number, py: number, width: number): void => {
    for (let dx = 0; dx < width; dx++) {
      const cx = px + dx;
      if (cx < 0 || cx >= cols) continue;
      grid[py][cx] = '#';
      occupied[py][cx] = true;
      safeCols.push({ x: cx, y: py - 1 });
    }
  };

  for (let i = 0; i < plat.count; i++) {
    const allowTowers = profile.allowTowers ?? true;
    const chainRoll = rand();
    const chainLen = allowTowers && chainRoll < 0.15 ? 4 + Math.floor(rand() * 3) : chainRoll < 0.45 ? 2 + Math.floor(rand() * 2) : 1;
    let px = 6 + Math.floor(rand() * (cols - 16));
    let refY = floorTopByCol[Math.min(cols - 1, Math.max(0, px))] ?? rows - 2;
    const dir = rand() < 0.5 ? -1 : 1;

    for (let step = 0; step < chainLen; step++) {
      const width = plat.width[0] + Math.floor(rand() * (plat.width[1] - plat.width[0] + 1));
      const clearance = plat.heightAbove[0] + Math.floor(rand() * (plat.heightAbove[1] - plat.heightAbove[0] + 1));
      const py = Math.max(3, refY - clearance - 1);

      let placed = false;
      for (let attempt = 0; attempt < 4 && !placed; attempt++) {
        const tryX = px + (attempt === 0 ? 0 : Math.floor(rand() * 6 - 3));
        if (canPlace(tryX, py, width)) {
          placePlatform(tryX, py, width);
          px = tryX;
          placed = true;
        }
      }
      if (!placed) break;

      refY = py;
      px += dir * (width + GAP_X + Math.floor(rand() * 3));
      if (px < 4 || px > cols - 6) break;
    }
  }

  clearBossArena(grid, floorTopByCol, cols, rows, profile.entityFracs?.boss_arena0);

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
    if (rows - 2 >= floorY && grid[floorY][gx] === '#') grid[floorY][gx] = gateChar;
  });

  const groundCols: SafeCol[] = [];
  for (let cx = 0; cx < cols; cx++) {
    if (floorTopByCol[cx] != null) {
      groundCols.push({ x: cx, y: (floorTopByCol[cx] as number) - 1 });
      safeCols.push({ x: cx, y: (floorTopByCol[cx] as number) - 1 });
    }
  }
  safeCols.sort((a, b) => a.x - b.x);
  groundCols.sort((a, b) => a.x - b.x);

  const tiles = grid.map((row) => row.join(''));
  return { tiles, safeCols, groundCols, floorTopByCol };
}

function pickAt(safeCols: SafeCol[], cols: number, frac: number, used: Set<number>, avoid: number[] = [], minDist = 0): SafeCol {
  const targetX = Math.floor(cols * frac);
  const scan = (respectAvoid: boolean): SafeCol | null => {
    let best: SafeCol | null = null;
    let bestDist = Infinity;
    for (const c of safeCols) {
      if (used.has(c.x)) continue;
      if (respectAvoid && avoid.some((ax) => Math.abs(ax - c.x) < minDist)) continue;
      const d = Math.abs(c.x - targetX);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  };
  const best = scan(true) ?? scan(false);
  if (!best) throw new Error('ProceduralZoneGenerator: no safe column available to place an entity');
  used.add(best.x);
  return best;
}

/**
 * Génère un ZoneMap complet (tuiles + positions x,y) pour `zoneId`, à partir du roster
 * d'entités FIXE de la zone (identité narrative déjà déterminée — cf. Types.ts ZoneEntity —
 * seuls x/y sont recalculés ici). Lance si `zoneId` n'a pas de profil connu.
 */
export function generateZoneMap(zoneId: string, meta: Omit<ZoneMap, 'cols' | 'rows' | 'tiles' | 'entities'>, entityRoster: ZoneEntity[]): ZoneMap {
  const profile = ZONE_PROFILES[zoneId];
  if (!profile) throw new Error(`ProceduralZoneGenerator: no profile for zone "${zoneId}"`);

  const { tiles, groundCols } = generateZone(profile);
  const used = new Set<number>();
  const typeCounters: Record<string, number> = {};
  const MIN_MOB_NPC_DIST = 8;
  const npcXs: number[] = [];

  const entities = entityRoster.map((entity) => {
    const idx = typeCounters[entity.type] ?? 0;
    typeCounters[entity.type] = idx + 1;
    const key = idx === 0 ? `${entity.type}0` : `${entity.type}${idx}`;
    const frac =
      entity.type === 'mob' ? MOB_FRACS[entity.tier - 1]
      : entity.type === 'captive' ? CAPTIVE_FRAC[zoneId]
      : entity.type === 'cat_decor' ? CAT_DECOR_FRACS[idx % CAT_DECOR_FRACS.length]
      : (profile.entityFracs[entity.type === 'spawn' ? 'spawn' : key] ?? 0.5);
    const pos = entity.type === 'mob'
      ? pickAt(groundCols, profile.cols, frac, used, npcXs, MIN_MOB_NPC_DIST)
      : pickAt(groundCols, profile.cols, frac, used);
    if (entity.type === 'npc') npcXs.push(pos.x);
    return { ...entity, x: pos.x, y: pos.y };
  });

  return { ...meta, cols: profile.cols, rows: profile.rows, tiles, entities };
}

export { CAT_DECOR_VARIANT_COUNT };
