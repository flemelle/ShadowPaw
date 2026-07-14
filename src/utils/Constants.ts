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
 * Mode Admin : accessible depuis le menu principal ou via `?admin=1` dans l'URL.
 * Débloque tous les pouvoirs, désactive les gates de progression et ajoute
 * un sélecteur de zone + noclip pour explorer librement les niveaux.
 */
export const TEST_MODE_QUERY_FLAG = 'admin';

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

/**
 * Assets réels (musique, SFX, décors parallax) — cf. ACKNOWLEDGEMENTS.md pour
 * les sources et licences. Servis statiquement depuis /public/assets.
 */
export const ASSET_BASE = 'assets';

export const MUSIC_KEYS = {
  MENU: 'music_menu',
  ZONE1: 'music_zone1',
  ZONE2: 'music_zone2',
  ZONE3: 'music_zone3',
  ZONE4: 'music_zone4',
  ZONE5: 'music_zone5',
  ZONE6: 'music_zone6',
  ZONE7: 'music_zone7',
  ZONE8: 'music_zone8',
  ENDING_A: 'music_ending_a',
} as const;

/** Une piste par zone ("Fin B" réutilise le thème de la Zone 5 comme leitmotiv de la corruption). */
export const ZONE_MUSIC: Record<ZoneId, string> = {
  zone1_portes_velkhar: MUSIC_KEYS.ZONE1,
  zone2_antre_velours_noir: MUSIC_KEYS.ZONE2,
  zone3_velkhar_foyer_ombres: MUSIC_KEYS.ZONE3,
  zone4_seikuji_quietude: MUSIC_KEYS.ZONE4,
  zone5_seikuji_corrompu: MUSIC_KEYS.ZONE5,
  zone6_jardins_oublies: MUSIC_KEYS.ZONE6,
  zone7_salle_miroirs: MUSIC_KEYS.ZONE7,
  zone8_vide_entre_deux: MUSIC_KEYS.ZONE8,
};

export const SFX_KEYS = {
  UI_HOVER: 'sfx_ui_hover',
  UI_CONFIRM: 'sfx_ui_confirm',
  UI_SELECT: 'sfx_ui_select',
  UI_CANCEL: 'sfx_ui_cancel',
  DIALOG_ADVANCE: 'sfx_dialog_advance',
  PAUSE_OPEN: 'sfx_pause_open',
  PAUSE_CLOSE: 'sfx_pause_close',
  POWER_UNLOCK: 'sfx_power_unlock',
  COMBO_TRIGGER: 'sfx_combo_trigger',
  PUZZLE_SOLVED: 'sfx_puzzle_solved',
  PUZZLE_FAIL: 'sfx_puzzle_fail',
  BOSS_DEFEATED: 'sfx_boss_defeated',
  PIVOT_STING: 'sfx_pivot_sting',
  PIVOT_ABSORB: 'sfx_pivot_absorb',
  ENDING_POSITIVE: 'sfx_ending_positive',
  ENDING_NEGATIVE: 'sfx_ending_negative',
  SHARD_COLLECT: 'sfx_shard_collect',
  DASH: 'sfx_dash',
  ZONE_TRANSITION: 'sfx_zone_transition',
  SHADOW_FORM: 'sfx_shadow_form',
} as const;

export const FOOTSTEP_VARIANTS = {
  ACT_1: ['sfx_footstep_gravel_1', 'sfx_footstep_gravel_2', 'sfx_footstep_gravel_3', 'sfx_footstep_gravel_4'],
  ACT_2: ['sfx_footstep_grass_1', 'sfx_footstep_grass_2', 'sfx_footstep_grass_3', 'sfx_footstep_grass_4'],
} as const;

/** Décor parallax par zone — cf. ParallaxBackground. `null` = pas de décor peint (ambiance procédurale seule). */
export const BG_KEYS = {
  FOREST: 'forest',
  STRINGSTAR: 'stringstar',
} as const;

export const ZONE_BACKGROUND: Record<ZoneId, keyof typeof BG_KEYS | null> = {
  zone1_portes_velkhar: 'FOREST',
  zone2_antre_velours_noir: null,
  zone3_velkhar_foyer_ombres: null,
  zone4_seikuji_quietude: 'STRINGSTAR',
  zone5_seikuji_corrompu: 'STRINGSTAR',
  zone6_jardins_oublies: 'FOREST',
  zone7_salle_miroirs: 'STRINGSTAR',
  zone8_vide_entre_deux: 'STRINGSTAR',
};

/** Zones où la super­position de corruption (ombre grandissante) réagit aux éclats collectés. */
export const CORRUPTED_ZONES: ZoneId[] = [
  'zone5_seikuji_corrompu',
  'zone6_jardins_oublies',
  'zone7_salle_miroirs',
  'zone8_vide_entre_deux',
];

/** Identité visuelle par zone — teinte des tuiles solides + wash d'ambiance (cf. message.txt, tableau des zones). */
export interface ZoneAmbiance {
  wallTint: number;
  washColor: number;
  washAlpha: number;
  pulse?: boolean;
}

export const ZONE_AMBIANCE: Record<ZoneId, ZoneAmbiance> = {
  // Nuit, torches violettes
  zone1_portes_velkhar: { wallTint: 0x6a3fb5, washColor: 0x4a2f7a, washAlpha: 0.12 },
  // Obscurité presque totale, chaînes
  zone2_antre_velours_noir: { wallTint: 0x241a33, washColor: 0x0a0712, washAlpha: 0.35 },
  // Vide noir, énergie sombre pulsante
  zone3_velkhar_foyer_ombres: { wallTint: 0x4a1f5c, washColor: 0x6a1f6a, washAlpha: 0.22, pulse: true },
  // Blanc et doré, silence absolu
  zone4_seikuji_quietude: { wallTint: 0xb8a06a, washColor: 0xffe9b0, washAlpha: 0.1 },
  // Mélange lumière brisée / ombre envahissante
  zone5_seikuji_corrompu: { wallTint: 0x8a6a8a, washColor: 0x3a1f5c, washAlpha: 0.28 },
  // Végétation corrompue
  zone6_jardins_oublies: { wallTint: 0x3a5c3a, washColor: 0x2a4a2a, washAlpha: 0.22 },
  // Réflexions, illusions
  zone7_salle_miroirs: { wallTint: 0x4a7fae, washColor: 0x3a5f8a, washAlpha: 0.2 },
  // Décor abstrait, vide
  zone8_vide_entre_deux: { wallTint: 0x2a2038, washColor: 0x0a0612, washAlpha: 0.4 },
};
