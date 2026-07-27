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
  /** Pouvoir transmis à la fin du dialogue (une seule fois) — remplace l'ancien octroi par
   * combat de boss dans les zones qui n'ont plus de boss (cf. GameScene.onDialogEnd). */
  grantsPower?: PowerId;
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

export interface EntityMob {
  type: 'mob';
  x: number;
  y: number;
  /** 1-5, difficulté croissante au sein de sa propre zone (cf. gen-zones.mjs). */
  tier: number;
}

export interface EntityCaptive {
  type: 'captive';
  x: number;
  y: number;
  /** Identifiant stable (persisté dans rescuedCreatures, choisit son dialogue de remerciement). */
  id: string;
}

export interface EntityCatDecor {
  type: 'cat_decor';
  x: number;
  y: number;
  /** Index dans CAT_DECOR_VARIANTS (cf. Constants.ts) — juste une variété visuelle. */
  variant: number;
}

export interface EntityZoneExit {
  type: 'zone_exit';
  x: number;
  y: number;
  targetZone: ZoneId | string;
  requiresBossDefeated?: string;
  requiresAltar?: string;
  /** Remplace requiresBossDefeated dans les zones sans boss : le pouvoir transmis par le PNJ
   * de la zone (cf. EntityNPC.grantsPower) fait office de jalon de progression à la place. */
  requiresPower?: PowerId;
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
  | EntityEndingTrigger
  | EntityMob
  | EntityCaptive
  | EntityCatDecor;

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
  rescuedCreatures?: string[];
  endingsReached?: string[];
  hasCheckpoint?: boolean;
  /** Dispositions de zone déjà générées cette partie (IA ou repli procédural, cf.
   * systems/ZoneGenerator.ts) — indispensable pour que le checkpoint (playerX/Y) reste valide
   * après un rechargement : régénérer une disposition DIFFÉRENTE au même endroit pourrait
   * emmurer ou faire tomber le joueur dans du vide qui n'existait pas la fois précédente. */
  generatedZones?: Record<string, ZoneMap>;
  collectedShards: string[];
  dialogFlags: Record<string, boolean>;
  solvedPuzzles: string[];
  testMode: boolean;
  playerX: number;
  playerY: number;
}
