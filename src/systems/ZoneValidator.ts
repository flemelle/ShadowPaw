/**
 * Valide un ZoneMap (généré par l'IA ou par ProceduralZoneGenerator) avant de le laisser
 * atteindre le joueur : forme de grille correcte, caractères légaux, et surtout — toute entité
 * non-optionnelle doit être *atteignable à pied/au saut* depuis le spawn, en respectant la
 * portée de saut réelle du jeu (cf. zoneProfiles.ts MAX_JUMP_TILES). Rejeter ici plutôt que de
 * laisser un layout IA créatif mais infranchissable arriver en jeu — cf. ZoneGenerator.ts qui
 * retombe sur le générateur procédural (toujours valide) dès que ceci renvoie `valid: false`.
 */
import type { ZoneEntity, ZoneMap } from '@/utils/Types';
import { MAX_JUMP_TILES, TILE_LEGEND } from './zoneProfiles';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const LEGAL_CHARS = new Set(Object.keys(TILE_LEGEND));
/** Marge de descente en tuiles à l'apex du saut (cf. JUMP_SPEED²/(2·GRAVITY_Y)/32) — au-delà,
 * une marche est trop haute pour être escaladée d'un seul saut, même à l'arrêt. */
const MAX_JUMP_RISE_TILES = 5;

interface SurfaceNode {
  x: number;
  /** Rangée du dessus du sol/de la plateforme à cette colonne (comme `floorTopByCol`). */
  row: number;
}

/** Portes de pouvoir (C/V/D/S/L) : solides par défaut tant que le pouvoir requis n'est pas
 * acquis (cf. LevelLoader.buildZone) — donc praticables comme du sol pour l'accessibilité,
 * même si un joueur avec le pouvoir pourra ensuite les traverser. */
function isSolid(ch: string): boolean {
  return ch === '#' || ch === 'C' || ch === 'V' || ch === 'D' || ch === 'S' || ch === 'L';
}

/**
 * Rangée du dessus du SOL réel de cette colonne (le socle continu jusqu'en bas), ou `null` si
 * la colonne est une fosse sans fond. Balayage du BAS vers le HAUT, en s'arrêtant dès que la
 * colonne cesse d'être pleine — PAS un balayage du haut vers le bas, qui renverrait le sommet
 * d'une plateforme flottante isolée plutôt que le sol qu'elle survole (même bug déjà corrigé
 * dans GameScene.groundTopByCol/Enemy.hasGroundAhead cette session : deux colonnes voisines avec
 * des plateformes à des hauteurs différentes semblaient alors "à des hauteurs très différentes"
 * alors que le vrai sol, en dessous, était parfaitement plat et continu entre les deux).
 * Les entités obligatoires sont toujours posées sur ce socle (cf. ProceduralZoneGenerator
 * `groundCols`), jamais sur une plateforme flottante — c'est donc le bon réseau à valider.
 */
function surfaceRowOf(tiles: string[], x: number, rows: number): number | null {
  // Ne suppose plus que le sol touche la dernière rangée de la grille (cf. ProceduralZoneGenerator :
  // le sol n'est plus qu'une seule rangée solide "flottante", pas un socle plein jusqu'en bas) —
  // le premier solide rencontré en balayant du bas vers le haut reste toujours la bonne surface
  // (celle sur laquelle on atterrirait en tombant dans cette colonne), qu'il touche le bord ou non.
  for (let y = rows - 1; y >= 0; y--) {
    if (isSolid(tiles[y][x])) return y;
  }
  return null;
}

function validateShape(map: ZoneMap): ValidationResult {
  if (!Array.isArray(map.tiles) || map.tiles.length !== map.rows) {
    return { valid: false, reason: `expected ${map.rows} rows, got ${map.tiles?.length}` };
  }
  for (let y = 0; y < map.tiles.length; y++) {
    const row = map.tiles[y];
    if (typeof row !== 'string' || row.length !== map.cols) {
      return { valid: false, reason: `row ${y} has length ${row?.length}, expected ${map.cols}` };
    }
    for (const ch of row) {
      if (!LEGAL_CHARS.has(ch)) return { valid: false, reason: `illegal tile character "${ch}" on row ${y}` };
    }
  }
  return { valid: true };
}

/**
 * BFS sur les colonnes atteignables depuis `spawnX`, en connectant deux colonnes si elles
 * partagent (à peu près) la même hauteur de surface (marche à pied) ou si l'écart horizontal ET
 * la montée éventuelle restent dans la portée de saut réelle du jeu (cf. MAX_JUMP_TILES/
 * MAX_JUMP_RISE_TILES) — une approximation volontairement généreuse (même esprit que le
 * générateur procédural existant), pas une simulation physique image par image.
 */
function reachableColumns(tiles: string[], cols: number, rows: number, spawnX: number): Set<number> {
  const surface: (number | null)[] = [];
  for (let x = 0; x < cols; x++) surface[x] = surfaceRowOf(tiles, x, rows);

  const reachable = new Set<number>();
  const queue: number[] = [];
  const startX = Math.max(0, Math.min(cols - 1, spawnX));
  if (surface[startX] != null) {
    reachable.add(startX);
    queue.push(startX);
  }

  const maxHop = Math.ceil(MAX_JUMP_TILES);
  while (queue.length > 0) {
    const x = queue.shift() as number;
    const row = surface[x] as number;
    for (let dx = -maxHop; dx <= maxHop; dx++) {
      if (dx === 0) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= cols || reachable.has(nx)) continue;
      const nrow = surface[nx];
      if (nrow == null) continue; // fosse sans fond à cette colonne : pas un point d'atterrissage
      const horizontalDist = Math.abs(dx);
      const rise = row - nrow; // positif = la cible est plus HAUTE (il faut monter)
      const walkable = horizontalDist <= 2 && Math.abs(rise) <= 2;
      const jumpable = horizontalDist <= MAX_JUMP_TILES && rise <= MAX_JUMP_RISE_TILES;
      if (walkable || jumpable) {
        reachable.add(nx);
        queue.push(nx);
      }
    }
  }
  return reachable;
}

function entityColumn(entity: ZoneEntity): number {
  return Math.round(entity.x);
}

/** Une entité "optionnelle" (cf. EntityNPC.optional) ou purement décorative ne bloque pas la
 * validation si elle finit isolée — seule la progression obligatoire doit être garantie. */
function isMandatory(entity: ZoneEntity): boolean {
  if (entity.type === 'cat_decor') return false;
  if (entity.type === 'npc' && entity.optional) return false;
  return true;
}

export function validateZoneMap(map: ZoneMap): ValidationResult {
  const shape = validateShape(map);
  if (!shape.valid) return shape;

  const spawn = map.entities.find((e) => e.type === 'spawn');
  if (!spawn) return { valid: false, reason: 'no spawn entity in roster' };

  const reachable = reachableColumns(map.tiles, map.cols, map.rows, entityColumn(spawn));

  for (const entity of map.entities) {
    if (entity.type === 'spawn') continue;
    if (!isMandatory(entity)) continue;
    const col = entityColumn(entity);
    if (col < 0 || col >= map.cols) return { valid: false, reason: `entity ${entity.type} x=${col} out of bounds` };
    if (!reachable.has(col)) {
      return { valid: false, reason: `entity ${entity.type} at x=${col} is not reachable from spawn` };
    }
  }

  return { valid: true };
}
