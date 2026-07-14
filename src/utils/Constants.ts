export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const TILE_SIZE = 32;

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  DIALOG: 'DialogScene',
  PUZZLE: 'PuzzleScene',
  END: 'EndScene',
} as const;

export const ACTS = {
  ACT_1: 1,
  ACT_2: 2,
} as const;

/** Identifiants des 8 zones, dans l'ordre de progression normale. */
export const ZONE_IDS = [
  'zone1_portes_velkhar',
  'zone2_antre_velours_noir',
  'zone3_velkhar_foyer_ombres',
  'zone4_seikuji_quietude',
  'zone5_seikuji_corrompu',
  'zone6_jardins_oublies',
  'zone7_salle_miroirs',
  'zone8_vide_entre_deux',
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export const POWER_IDS = [
  'griffes_renforcees',
  'vision_feline',
  'dash_fantome',
  'forme_ombre',
  'eclat_lumiere',
] as const;

export type PowerId = (typeof POWER_IDS)[number];

export const COMBO_IDS = [
  'nova_equilibre',
  'voile_verite',
  'lame_duale',
  'ancrage',
] as const;

export type ComboId = (typeof COMBO_IDS)[number];

/** Palette par acte — utilisée pour teinter les tiles générées et le fond. */
export const PALETTES = {
  ACT_1: { bg: 0x0b0710, wall: 0x2e1f4d, accent: 0x6a3fb5, hazard: 0x1a0f2e },
  ACT_2: { bg: 0x120e1a, wall: 0x3a2f55, accent: 0xd8b34a, hazard: 0x4a3f2a },
} as const;

export const SAVE_KEY = 'shadowpaw_save_v1';

export const KEYS = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  JUMP: 'UP',
  DOWN: 'DOWN',
  ACTION: 'E',
  DASH: 'SHIFT',
  SHADOW_FORM: 'Q',
  LIGHT: 'F',
  PAUSE: 'ESC',
  DEBUG_TOGGLE: 'F1',
} as const;

/**
 * Mode Test : accessible depuis le menu principal ou via `?test=1` dans l'URL.
 * Débloque tous les pouvoirs, désactive les gates de progression et ajoute
 * un sélecteur de zone + noclip pour explorer librement les niveaux.
 */
export const TEST_MODE_QUERY_FLAG = 'test';

/** Clés des textures générées procéduralement au Boot (aucun asset externe requis). */
export const TEX = {
  WALL_ACT1: 'tex_wall_act1',
  WALL_ACT2: 'tex_wall_act2',
  BREAKABLE: 'tex_breakable',
  HIDDEN: 'tex_hidden',
  DASH_GATE: 'tex_dash_gate',
  SHADOW_WALL: 'tex_shadow_wall',
  LIGHT_OBSTACLE: 'tex_light_obstacle',
  PLAYER: 'tex_player',
  NPC: 'tex_npc',
  BOSS_ARENA: 'tex_boss_arena',
  ZONE_EXIT: 'tex_zone_exit',
  PUZZLE_TRIGGER: 'tex_puzzle_trigger',
  POWER_ALTAR: 'tex_power_altar',
  SHARD: 'tex_shard',
  PARTICLE: 'tex_particle',
} as const;
