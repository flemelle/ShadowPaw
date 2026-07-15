import Phaser from 'phaser';
import { TILE_SIZE, TEX, PALETTES, ZONE_FLOOR_TEX, ZONE_BACKGROUND, DECOR_SETS, DECOR_KEYS } from '@/utils/Constants';
import type { ZoneId } from '@/utils/Constants';
import type { ZoneMap, ZoneEntity } from '@/utils/Types';
import type { PowerSystem } from './PowerSystem';

const mapModules = import.meta.glob('/src/data/maps/zone*.json', { eager: true }) as Record<
  string,
  { default: ZoneMap }
>;

const MAP_REGISTRY: Record<string, ZoneMap> = {};
for (const mod of Object.values(mapModules)) {
  MAP_REGISTRY[mod.default.id] = mod.default;
}

export function getZoneMap(zoneId: string): ZoneMap {
  const map = MAP_REGISTRY[zoneId];
  if (!map) throw new Error(`Zone map introuvable: ${zoneId}`);
  return map;
}

export function listZoneIds(): string[] {
  return Object.keys(MAP_REGISTRY);
}

export interface BuiltZone {
  solidGroup: Phaser.Physics.Arcade.StaticGroup;
  breakableGroup: Phaser.Physics.Arcade.StaticGroup;
  hiddenGroup: Phaser.Physics.Arcade.StaticGroup;
  dashGateGroup: Phaser.Physics.Arcade.StaticGroup;
  shadowWallGroup: Phaser.Physics.Arcade.StaticGroup;
  lightObstacleGroup: Phaser.Physics.Arcade.StaticGroup;
  spawn: { x: number; y: number };
  entityMarkers: { entity: ZoneEntity; sprite: Phaser.GameObjects.Sprite }[];
  decorSprites: Phaser.GameObjects.Image[];
  widthPx: number;
  heightPx: number;
}

/**
 * Construit une zone à partir de sa grille de tuiles + liste d'entités.
 * Les tuiles de gate (C/V/D/S/L) sont matérialisées uniquement si le joueur
 * ne possède pas encore le pouvoir correspondant (ou si le Mode Admin est actif,
 * auquel cas rien ne bloque — cf. GameScene / PowerSystem.has()).
 */
export function buildZone(scene: Phaser.Scene, zoneMap: ZoneMap, powers: PowerSystem): BuiltZone {
  const wallTex = ZONE_FLOOR_TEX[zoneMap.id as ZoneId];
  const palette = PALETTES[zoneMap.palette];

  scene.cameras.main.setBackgroundColor(palette.bg);

  const solidGroup = scene.physics.add.staticGroup();
  const breakableGroup = scene.physics.add.staticGroup();
  const hiddenGroup = scene.physics.add.staticGroup();
  const dashGateGroup = scene.physics.add.staticGroup();
  const shadowWallGroup = scene.physics.add.staticGroup();
  const lightObstacleGroup = scene.physics.add.staticGroup();

  zoneMap.tiles.forEach((row, ry) => {
    [...row].forEach((code, rx) => {
      const px = rx * TILE_SIZE + TILE_SIZE / 2;
      const py = ry * TILE_SIZE + TILE_SIZE / 2;
      switch (code) {
        case '#':
          solidGroup.create(px, py, wallTex);
          break;
        case 'C':
          if (!powers.has('griffes_renforcees')) breakableGroup.create(px, py, TEX.BREAKABLE);
          break;
        case 'V':
          if (!powers.has('vision_feline')) hiddenGroup.create(px, py, TEX.HIDDEN);
          break;
        case 'D':
          if (!powers.has('dash_fantome')) dashGateGroup.create(px, py, TEX.DASH_GATE);
          break;
        case 'S':
          if (!powers.has('forme_ombre')) shadowWallGroup.create(px, py, TEX.SHADOW_WALL);
          break;
        case 'L':
          if (!powers.has('eclat_lumiere')) lightObstacleGroup.create(px, py, TEX.LIGHT_OBSTACLE);
          break;
        default:
          break;
      }
    });
  });

  const spawnEntity = zoneMap.entities.find((e) => e.type === 'spawn');
  const spawn = spawnEntity
    ? { x: spawnEntity.x * TILE_SIZE + TILE_SIZE / 2, y: spawnEntity.y * TILE_SIZE }
    : { x: TILE_SIZE, y: TILE_SIZE };

  const markerTexFor = (e: ZoneEntity): string => {
    switch (e.type) {
      case 'npc':
        return TEX.NPC;
      case 'boss_arena':
        return TEX.BOSS_ARENA;
      case 'zone_exit':
      case 'ending_trigger':
        return TEX.ZONE_EXIT;
      case 'puzzle_trigger':
        return TEX.PUZZLE_TRIGGER;
      case 'power_altar':
        return TEX.POWER_ALTAR;
      case 'shard_pickup':
        return TEX.SHARD;
      default:
        return TEX.NPC;
    }
  };

  const entityMarkers = zoneMap.entities
    .filter((e) => e.type !== 'spawn')
    .map((entity) => {
      const px = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const py = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const sprite = scene.add.sprite(px, py, markerTexFor(entity));
      scene.physics.add.existing(sprite, true);
      return { entity, sprite };
    });

  const decorSprites = scatterDecor(scene, zoneMap);

  return {
    solidGroup,
    breakableGroup,
    hiddenGroup,
    dashGateGroup,
    shadowWallGroup,
    lightObstacleGroup,
    spawn,
    entityMarkers,
    decorSprites,
    widthPx: zoneMap.cols * TILE_SIZE,
    heightPx: zoneMap.rows * TILE_SIZE,
  };
}

/**
 * Disperse quelques décors (arbres/buissons/rochers, Stringstar Fields — cf.
 * ACKNOWLEDGEMENTS.md) sans collision, derrière le gameplay : au sol (grands décors)
 * et sur les plateformes flottantes (petits décors, mis à l'échelle pour ne jamais
 * déborder de la plateforme). Le thème suit celui du décor peint de la zone (cf.
 * ZONE_BACKGROUND) ; les zones sans décor peint (intérieurs sombres) n'en reçoivent pas.
 */
function scatterDecor(scene: Phaser.Scene, zoneMap: ZoneMap): Phaser.GameObjects.Image[] {
  const theme = ZONE_BACKGROUND[zoneMap.id as ZoneId];
  if (!theme) return [];
  const groundPool = DECOR_SETS[theme];
  const platformPool = groundPool.filter((p) => p.key === DECOR_KEYS.BUSH_ROUND || p.key === DECOR_KEYS.ROCK);
  const sprites: Phaser.GameObjects.Image[] = [];
  const { cols, rows, tiles } = zoneMap;

  // groundTopRow[x] = rangée la plus haute du sol continu (connecté jusqu'en bas), ou
  // null si la colonne est une fosse. Sert à distinguer "sol" de "plateforme flottante".
  const groundTopRow: (number | null)[] = new Array(cols).fill(null);
  for (let x = 0; x < cols; x++) {
    if (tiles[rows - 1][x] !== '#') continue;
    let y = rows - 1;
    while (y > 0 && tiles[y - 1][x] === '#') y -= 1;
    groundTopRow[x] = y;
  }

  // --- Décor au sol (grands décors, jamais sur une plateforme isolée) ---
  let gx = 5;
  let guard = 0;
  while (gx < cols - 5 && guard < 200) {
    guard += 1;
    const floorRow = groundTopRow[gx];
    if (floorRow != null) {
      const pick = groundPool[Math.floor(Math.random() * groundPool.length)];
      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = floorRow * TILE_SIZE;
      sprites.push(scene.add.image(px, py, pick.key).setOrigin(0.5, 1).setScale(pick.scale).setDepth(-5));
    }
    gx += 10 + Math.floor(Math.random() * 8);
  }

  // --- Décor sur les plateformes flottantes (petits décors, mis à l'échelle à la largeur) ---
  if (platformPool.length > 0) {
    for (let y = 1; y < rows; y++) {
      let runStart = -1;
      for (let x = 0; x <= cols; x++) {
        const gt = x < cols ? groundTopRow[x] : null;
        const isPlatformSurface = x < cols && tiles[y][x] === '#' && tiles[y - 1][x] !== '#' && (gt == null || y < gt);
        if (isPlatformSurface) {
          if (runStart === -1) runStart = x;
          continue;
        }
        if (runStart !== -1) {
          placePlatformDecor(scene, sprites, platformPool, zoneMap, runStart, x - runStart, y);
          runStart = -1;
        }
      }
    }
  }

  return sprites;
}

/** Place un petit décor centré sur une plateforme, réduit pour ne jamais déborder de ses bords. */
function placePlatformDecor(
  scene: Phaser.Scene,
  sprites: Phaser.GameObjects.Image[],
  pool: { key: string; scale: number }[],
  zoneMap: ZoneMap,
  startX: number,
  width: number,
  row: number,
): void {
  if (width < 1 || Math.random() < 0.5) return; // pas systématique : une plateforme sur deux environ
  const centerX = startX + width / 2;

  // Évite de superposer un décor à un PNJ/déclencheur posé sur cette même plateforme.
  const tooClose = zoneMap.entities.some(
    (e) => e.type !== 'spawn' && Math.abs(e.x - centerX) < 1.5 && Math.abs(e.y - (row - 1)) < 1.5,
  );
  if (tooClose) return;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const srcWidth = scene.textures.get(pick.key).source[0]?.width ?? TILE_SIZE;
  const maxWidthPx = width * TILE_SIZE * 0.75;
  const scale = Math.min(pick.scale, maxWidthPx / srcWidth);

  const px = centerX * TILE_SIZE;
  const py = row * TILE_SIZE;
  sprites.push(scene.add.image(px, py, pick.key).setOrigin(0.5, 1).setScale(scale).setDepth(-5));
}
