import Phaser from 'phaser';
import { TILE_SIZE, TEX, PALETTES } from '@/utils/Constants';
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
  widthPx: number;
  heightPx: number;
}

/**
 * Construit une zone à partir de sa grille de tuiles + liste d'entités.
 * Les tuiles de gate (C/V/D/S/L) sont matérialisées uniquement si le joueur
 * ne possède pas encore le pouvoir correspondant (ou si le Mode Admin est actif,
 * auquel cas rien ne bloque — cf. GameScene / PowerSystem.has()).
 */
export function buildZone(scene: Phaser.Scene, zoneMap: ZoneMap, powers: PowerSystem, wallTint?: number): BuiltZone {
  const wallTex = zoneMap.palette === 'ACT_1' ? TEX.WALL_ACT1 : TEX.WALL_ACT2;
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
        case '#': {
          const tile = solidGroup.create(px, py, wallTex) as Phaser.GameObjects.Sprite;
          if (wallTint !== undefined) tile.setTint(wallTint);
          break;
        }
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

  return {
    solidGroup,
    breakableGroup,
    hiddenGroup,
    dashGateGroup,
    shadowWallGroup,
    lightObstacleGroup,
    spawn,
    entityMarkers,
    widthPx: zoneMap.cols * TILE_SIZE,
    heightPx: zoneMap.rows * TILE_SIZE,
  };
}
