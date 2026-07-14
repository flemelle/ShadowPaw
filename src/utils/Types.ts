import type { PowerId, ZoneId } from './Constants';

export interface EntitySpawn {
  type: 'spawn';
  x: number;
  y: number;
  requiresPower?: PowerId;
}

export interface EntityNPC {
  type: 'npc';
  x: number;
  y: number;
  dialogTree: string;
  requiresPower?: PowerId;
  optional?: boolean;
}

export interface EntityBossArena {
  type: 'boss_arena';
  x: number;
  y: number;
  bossId: string;
  grantsPower?: PowerId;
  requiresCombo?: string;
  isFinalBoss?: boolean;
}

export interface EntityZoneExit {
  type: 'zone_exit';
  x: number;
  y: number;
  targetZone: ZoneId | string;
  requiresBossDefeated?: string;
  requiresAltar?: string;
}

export interface EntityShardPickup {
  type: 'shard_pickup';
  x: number;
  y: number;
  shardId: string;
}

export interface EntityPuzzleTrigger {
  type: 'puzzle_trigger';
  x: number;
  y: number;
  puzzleId: string;
}

export interface EntityPowerAltar {
  type: 'power_altar';
  x: number;
  y: number;
  altarId: string;
  requiresPower?: PowerId;
  pivotEvent?: boolean;
  grantsPower?: PowerId;
}

export interface EntityEndingTrigger {
  type: 'ending_trigger';
  x: number;
  y: number;
  requiresBossDefeated?: string;
}

export type ZoneEntity =
  | EntitySpawn
  | EntityNPC
  | EntityBossArena
  | EntityZoneExit
  | EntityShardPickup
  | EntityPuzzleTrigger
  | EntityPowerAltar
  | EntityEndingTrigger;

export interface ZoneMap {
  id: string;
  name: string;
  act: 1 | 2;
  ambiance: string;
  palette: 'ACT_1' | 'ACT_2';
  notes?: string;
  cols: number;
  rows: number;
  tiles: string[];
  entities: ZoneEntity[];
}

export interface SaveData {
  version: 1;
  currentZone: string;
  unlockedPowers: PowerId[];
  defeatedBosses: string[];
  collectedShards: string[];
  dialogFlags: Record<string, boolean>;
  solvedPuzzles: string[];
  testMode: boolean;
  playerX: number;
  playerY: number;
}
