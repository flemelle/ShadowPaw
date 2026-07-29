export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const TILE_SIZE = 32;

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PROLOGUE: 'PrologueScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  DIALOG: 'DialogScene',
  TUTORIAL: 'TutorialScene',
  PUZZLE: 'PuzzleScene',
  ENDING_CUTSCENE: 'EndingCutsceneScene',
  END: 'EndScene',
} as const;

export const ACTS = {
  ACT_1: 1,
  ACT_2: 2,
} as const;

/** Vies de départ + marge sous le bas de la carte au-delà de laquelle une chute est mortelle. */
export const LIVES_START = 3;
export const FALL_DEATH_MARGIN = 120;

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
  'zone9_epilogue',
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

/** Zone bonus hors progression (cf. GameState.enterEpilogue) — un havre paisible, sans combat,
 * réunissant les PNJ et les créatures sauvées, accessible depuis l'écran de fin plutôt que par
 * un zone_exit normal. Exclue de listZoneIds() (cf. LevelLoader) : jamais listée comme un
 * "chapitre" au même titre que les 8 zones de la trame, dans les sélecteurs de zone admin. */
export const EPILOGUE_ZONE_ID: ZoneId = 'zone9_epilogue';

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
  BREAKABLE: 'tex_breakable',
  HIDDEN: 'tex_hidden',
  DASH_GATE: 'tex_dash_gate',
  SHADOW_WALL: 'tex_shadow_wall',
  LIGHT_OBSTACLE: 'tex_light_obstacle',
  PLAYER_IDLE: 'tex_player_idle',
  PLAYER_WALK: 'tex_player_walk',
  PLAYER_GLOW: 'tex_player_glow',
  NPC: 'tex_npc',
  NPC_PORTRAIT: 'tex_npc_portrait',
  BOSS_ARENA: 'tex_boss_arena',
  ZONE_EXIT: 'tex_zone_exit',
  PUZZLE_TRIGGER: 'tex_puzzle_trigger',
  POWER_ALTAR: 'tex_power_altar',
  SHARD: 'tex_shard',
  LIFE_PICKUP: 'tex_life_pickup',
  PARTICLE: 'tex_particle',
  ENEMY: 'tex_enemy',
  FLOOR_EPILOGUE: 'tex_floor_epilogue',
  MOB_CAT: 'tex_mob_cat',
  MOB_SKULL: 'tex_mob_skull',
  MOB_BOAR: 'tex_mob_boar',
  RESCUE_CAT: 'tex_rescue_cat',
  RESCUE_CAT_RUN: 'tex_rescue_cat_run',
  CATGIRL_BOSS: 'tex_catgirl_boss',
  BOSS_SAMURAI: 'tex_boss_samurai',
  BOSS_STONE_GUARDIAN: 'tex_boss_stone_guardian',
  UI_PANEL: 'tex_ui_panel',
  UI_ICON_PLAY: 'tex_ui_icon_play',
  UI_ICON_PAUSE: 'tex_ui_icon_pause',
  ADMIN_ICON: 'tex_admin_icon',
  POWER_ICON_CLAWS: 'tex_power_icon_claws',
  POWER_ICON_VISION: 'tex_power_icon_vision',
  POWER_ICON_DASH: 'tex_power_icon_dash',
  POWER_ICON_SHADOW: 'tex_power_icon_shadow',
  POWER_ICON_LIGHT: 'tex_power_icon_light',
  CAT_DECOR_BLACK: 'tex_cat_decor_black',
  CAT_DECOR_BROWN: 'tex_cat_decor_brown',
  CAT_DECOR_WHITE: 'tex_cat_decor_white',
  GHOST_CAT_BLUE: 'tex_ghost_cat_blue',
  GHOST_CAT_RED: 'tex_ghost_cat_red',
  PLAYER_ATTACK_FX: 'tex_player_attack_fx',
  HIT_IMPACT_FX: 'tex_hit_impact_fx',
  DASH_IMPACT_FX: 'tex_dash_impact_fx',
  BOSS_TELEGRAPH_FX: 'tex_boss_telegraph_fx',
  BOSS_SHADOW_ORB_FX: 'tex_boss_shadow_orb_fx',
  BOSS_SHOCKWAVE_FX: 'tex_boss_shockwave_fx',
  NPC_TOZEN: 'tex_npc_tozen',
  NPC_RYO_SPIRIT: 'tex_npc_ryo_spirit',
  NPC_VEILLEUR: 'tex_npc_veilleur',
  NPC_ECHO_HIKARI: 'tex_npc_echo_hikari',
  NPC_REFLET: 'tex_npc_reflet',
  NPC_MALAKAR: 'tex_npc_malakar',
} as const;

/**
 * Assets réels (musique, SFX, décors parallax) — cf. ACKNOWLEDGEMENTS.md pour
 * les sources et licences. Servis statiquement depuis /public/assets.
 */
export const ASSET_BASE = 'assets';

/**
 * Textures de mob/boss/PNJ réelles (pas générées) — cf. ACKNOWLEDGEMENTS.md. `MOB_TEX_BY_BG`
 * fait correspondre le look d'un mob au thème visuel de sa zone plutôt qu'un sprite unique
 * partout : chat d'ombre dans les zones cimetière, crâne dans les zones temple/abstraites,
 * sanglier dans la forêt.
 */
export const REAL_TEX_PATHS: Record<string, string> = {
  [TEX.PLAYER_IDLE]: `${ASSET_BASE}/images/creatures/player_idle.png`,
  [TEX.PLAYER_WALK]: `${ASSET_BASE}/images/creatures/player_walk.png`,
  [TEX.MOB_CAT]: `${ASSET_BASE}/images/creatures/mob_cat.png`,
  [TEX.MOB_SKULL]: `${ASSET_BASE}/images/creatures/skull_enemy.png`,
  [TEX.MOB_BOAR]: `${ASSET_BASE}/images/creatures/boar_idle.png`,
  [TEX.RESCUE_CAT]: `${ASSET_BASE}/images/creatures/rescue_cat_idle.png`,
  [TEX.RESCUE_CAT_RUN]: `${ASSET_BASE}/images/creatures/rescue_cat_run.png`,
  [TEX.CATGIRL_BOSS]: `${ASSET_BASE}/images/bosses/catgirl_idle.png`,
  [TEX.BOSS_SAMURAI]: `${ASSET_BASE}/images/bosses/samurai_idle.png`,
  [TEX.UI_PANEL]: `${ASSET_BASE}/images/ui/panel_wood.png`,
  [TEX.UI_ICON_PLAY]: `${ASSET_BASE}/images/ui/btn_play_light.png`,
  [TEX.UI_ICON_PAUSE]: `${ASSET_BASE}/images/ui/btn_pause_light.png`,
  [TEX.ADMIN_ICON]: `${ASSET_BASE}/images/ui/icon_admin_cat.png`,
  [TEX.POWER_ICON_CLAWS]: `${ASSET_BASE}/images/ui/power_icon_claws.png`,
  [TEX.POWER_ICON_VISION]: `${ASSET_BASE}/images/ui/power_icon_vision.png`,
  [TEX.POWER_ICON_DASH]: `${ASSET_BASE}/images/ui/power_icon_dash.png`,
  [TEX.POWER_ICON_SHADOW]: `${ASSET_BASE}/images/ui/power_icon_shadow.png`,
  [TEX.POWER_ICON_LIGHT]: `${ASSET_BASE}/images/ui/power_icon_light.png`,
  [TEX.CAT_DECOR_BLACK]: `${ASSET_BASE}/images/decor/cat_wild_black.png`,
  [TEX.CAT_DECOR_BROWN]: `${ASSET_BASE}/images/decor/cat_wild_brown.png`,
  [TEX.CAT_DECOR_WHITE]: `${ASSET_BASE}/images/decor/cat_wild_white.png`,
  [TEX.GHOST_CAT_BLUE]: `${ASSET_BASE}/images/bosses/ghost_cat_blue_idle.png`,
  [TEX.GHOST_CAT_RED]: `${ASSET_BASE}/images/bosses/ghost_cat_red_idle.png`,
  [TEX.PLAYER_ATTACK_FX]: `${ASSET_BASE}/images/creatures/player_attack_fx.png`,
  [TEX.HIT_IMPACT_FX]: `${ASSET_BASE}/images/creatures/hit_impact_fx.png`,
  [TEX.DASH_IMPACT_FX]: `${ASSET_BASE}/images/creatures/dash_impact_fx.png`,
  [TEX.BOSS_TELEGRAPH_FX]: `${ASSET_BASE}/images/creatures/boss_telegraph_fx.png`,
  [TEX.BOSS_SHADOW_ORB_FX]: `${ASSET_BASE}/images/creatures/boss_shadow_orb_fx.png`,
  [TEX.BOSS_SHOCKWAVE_FX]: `${ASSET_BASE}/images/creatures/boss_shockwave_fx.png`,
  [TEX.NPC_TOZEN]: `${ASSET_BASE}/images/creatures/npc_tozen.png`,
  [TEX.NPC_RYO_SPIRIT]: `${ASSET_BASE}/images/creatures/npc_ryo_spirit.png`,
  [TEX.NPC_VEILLEUR]: `${ASSET_BASE}/images/creatures/npc_veilleur.png`,
  [TEX.NPC_ECHO_HIKARI]: `${ASSET_BASE}/images/creatures/npc_echo_hikari.png`,
  [TEX.NPC_REFLET]: `${ASSET_BASE}/images/creatures/npc_reflet.png`,
  [TEX.NPC_MALAKAR]: `${ASSET_BASE}/images/creatures/npc_malakar.png`,
};

/**
 * Chats sauvages décoratifs (pack "Free"/AllCats, cf. ACKNOWLEDGEMENTS.md) dispersés un peu
 * partout sur la carte — purement décoratifs (traversables, en arrière-plan derrière le
 * gameplay, cf. GameScene.loadZone), sans dialogue ni interaction.
 */
export const CAT_DECOR_VARIANTS = [
  { texture: TEX.CAT_DECOR_BLACK, animKey: 'anim_cat_decor_black_idle' },
  { texture: TEX.CAT_DECOR_BROWN, animKey: 'anim_cat_decor_brown_idle' },
  { texture: TEX.CAT_DECOR_WHITE, animKey: 'anim_cat_decor_white_idle' },
];

/** Résout un `EntityCatDecor.variant` (index libre, cf. gen-zones.mjs) sur son texture+animKey. */
export function getCatDecorVariant(variant: number): (typeof CAT_DECOR_VARIANTS)[number] {
  return CAT_DECOR_VARIANTS[variant % CAT_DECOR_VARIANTS.length];
}

/**
 * Habillage des PNJ (AllCats, cf. ACKNOWLEDGEMENTS.md) selon le préfixe de leur arbre de
 * dialogue (cf. dialogues.json, stable à travers les zones où le même personnage réapparaît —
 * "tozen_zone1_intro"/"tozen_zone2_hint"/"tozen_zone3_hint" sont tous Tozen). Un PNJ dont aucun
 * préfixe ne correspond garde le marqueur générique (cercle cyan).
 */
export const NPC_SKINS: { prefix: string; texture: string; animKey: string; frameSize?: number; scale?: number }[] = [
  { prefix: 'tozen', texture: TEX.NPC_TOZEN, animKey: 'anim_npc_tozen_idle' },
  { prefix: 'ryo_spirit', texture: TEX.NPC_RYO_SPIRIT, animKey: 'anim_npc_ryo_spirit_idle' },
  { prefix: 'veilleur', texture: TEX.NPC_VEILLEUR, animKey: 'anim_npc_veilleur_idle' },
  { prefix: 'echo_hikari', texture: TEX.NPC_ECHO_HIKARI, animKey: 'anim_npc_echo_hikari_idle' },
  { prefix: 'reflet', texture: TEX.NPC_REFLET, animKey: 'anim_npc_reflet_idle' },
  { prefix: 'malakar', texture: TEX.NPC_MALAKAR, animKey: 'anim_npc_malakar_idle' },
  // Créatures sauvées retrouvées dans l'épilogue (cf. EntityNPC.requiresRescued) — même skin que
  // sur la carte (ThreeColorFree, cf. ACKNOWLEDGEMENTS.md), pas de variante par chat : c'est le
  // dialogue de chacune (référençant sa zone d'origine) qui les distingue, pas l'apparence.
  { prefix: 'rescue_cat_epilogue', texture: TEX.RESCUE_CAT, animKey: 'anim_rescue_cat_idle' },
  // Portrait de dialogue du boss "Maître Aveugle" (cf. BOSS_DEFS) — même texture que le combat,
  // mais en frame 40x40 (pas 32x32 comme les PNJ ci-dessus), d'où le frameSize explicite ; son
  // animation (10 frames, pas les 7 génériques ci-dessous) est créée à part dans le bloc boss de
  // BootScene, que la boucle générique plus bas laisse intacte (cf. son garde-fou anims.exists).
  // `scale` fait exception à la mise à l'échelle "192px standard" des autres PNJ ci-dessus (cf.
  // DialogScene) : demandé identique à sa taille de combat (BOSS_DEFS.boss_maitre_aveugle.scale,
  // dupliqué ici — BOSS_DEFS est déclaré plus bas dans ce fichier, inutilisable ici directement).
  { prefix: 'boss_maitre_aveugle', texture: TEX.BOSS_SAMURAI, animKey: 'anim_samurai_idle', frameSize: 40, scale: 6.8 / 3 },
];

export function getNpcSkin(dialogTree: string): { texture: string; animKey: string; frameSize?: number; scale?: number } | null {
  return NPC_SKINS.find((s) => dialogTree.startsWith(s.prefix)) ?? null;
}

/**
 * Icônes réelles (RPG Effect All Free, teintes encore inutilisées de `Part 16/766.png` — cf.
 * ACKNOWLEDGEMENTS.md) pour la barre de pouvoirs du HUD, à la place de l'émoji générique utilisé
 * jusqu'ici (`PowerDef.icon`, resté tel quel pour le mini-tutoriel d'un pouvoir, cf.
 * TutorialContent.ts, hors scope ici).
 */
export const POWER_ICON_TEX: Record<string, string> = {
  griffes_renforcees: TEX.POWER_ICON_CLAWS,
  vision_feline: TEX.POWER_ICON_VISION,
  dash_fantome: TEX.POWER_ICON_DASH,
  forme_ombre: TEX.POWER_ICON_SHADOW,
  eclat_lumiere: TEX.POWER_ICON_LIGHT,
};

// Réassigné après vérification visuelle en jeu (screenshots) : un crâne flottant contre le ciel
// bleu/doré serein des zones STRINGSTAR (temple de la Quiétude, Salle des Miroirs) lisait comme
// une erreur de thème (mort/charogne dans un décor apaisé), alors qu'un crâne au milieu des
// pierres tombales des zones GRAVEYARD est un pairing évident. Le chat d'ombre, silhouette sombre
// bien plus neutre, se lit à l'inverse comme "esprit corrompu" dans un ciel clair sans détonner.
export const MOB_TEX_BY_BG: Record<'FOREST' | 'STRINGSTAR' | 'GRAVEYARD' | 'NONE' | 'PINE_HILLS', string> = {
  GRAVEYARD: TEX.MOB_SKULL,
  FOREST: TEX.MOB_BOAR,
  STRINGSTAR: TEX.MOB_CAT,
  NONE: TEX.MOB_SKULL,
  // Jamais utilisée en pratique (l'épilogue ne place aucun `mob`, cf. zone9_epilogue.json) —
  // juste pour satisfaire l'exhaustivité du Record maintenant que PINE_HILLS existe.
  PINE_HILLS: TEX.MOB_BOAR,
};

/** Clés des animations d'idle enregistrées au Boot (cf. BootScene.ts) pour les textures ci-dessus. */
export const ANIM_KEYS = {
  PLAYER_IDLE: 'anim_player_idle',
  PLAYER_WALK: 'anim_player_walk',
  PLAYER_JUMP: 'anim_player_jump',
  PLAYER_DASH: 'anim_player_dash',
  PLAYER_ATTACK_POSE: 'anim_player_attack_pose',
  BOAR_IDLE: 'anim_boar_idle',
  RESCUE_CAT_IDLE: 'anim_rescue_cat_idle',
  RESCUE_CAT_RUN: 'anim_rescue_cat_run',
  CATGIRL_IDLE: 'anim_catgirl_idle',
  SAMURAI_IDLE: 'anim_samurai_idle',
  GHOST_CAT_BLUE_IDLE: 'anim_ghost_cat_blue_idle',
  GHOST_CAT_RED_IDLE: 'anim_ghost_cat_red_idle',
  PLAYER_ATTACK_SWIPE: 'anim_player_attack_swipe',
  HIT_IMPACT: 'anim_hit_impact',
  DASH_IMPACT: 'anim_dash_impact',
  BOSS_TELEGRAPH: 'anim_boss_telegraph',
  BOSS_SHADOW_ORB: 'anim_boss_shadow_orb',
  BOSS_SHOCKWAVE: 'anim_boss_shockwave',
} as const;

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

/**
 * Chemins des pistes de musique, utilisés pour un chargement paresseux : seul
 * `menu.ogg` est précargé au Boot (~5 Mo). Les pistes de zone (~45 Mo au total)
 * ne sont chargées qu'à l'entrée en jeu, zone par zone, pour que le menu
 * s'affiche vite — sans quoi un clic pendant le (long) chargement initial ne
 * fait rien, ce qui se lit comme "le bouton ne marche pas".
 */
export const MUSIC_PATHS: Record<string, string> = {
  [MUSIC_KEYS.MENU]: `${ASSET_BASE}/audio/music/menu.ogg`,
  [MUSIC_KEYS.ZONE1]: `${ASSET_BASE}/audio/music/zone1.ogg`,
  [MUSIC_KEYS.ZONE2]: `${ASSET_BASE}/audio/music/zone2.ogg`,
  [MUSIC_KEYS.ZONE3]: `${ASSET_BASE}/audio/music/zone3.ogg`,
  [MUSIC_KEYS.ZONE4]: `${ASSET_BASE}/audio/music/zone4.ogg`,
  [MUSIC_KEYS.ZONE5]: `${ASSET_BASE}/audio/music/zone5.ogg`,
  [MUSIC_KEYS.ZONE6]: `${ASSET_BASE}/audio/music/zone6.ogg`,
  [MUSIC_KEYS.ZONE7]: `${ASSET_BASE}/audio/music/zone7.ogg`,
  [MUSIC_KEYS.ZONE8]: `${ASSET_BASE}/audio/music/zone8.ogg`,
  [MUSIC_KEYS.ENDING_A]: `${ASSET_BASE}/audio/music/ending_a.ogg`,
};

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
  zone9_epilogue: MUSIC_KEYS.ENDING_A,
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
  // Pas de fichiers dédiés (aucun asset combat n'existe, cf. ACKNOWLEDGEMENTS.md) : clés propres
  // mais rechargeant les MÊMES .wav que ci-dessus (cf. BootScene.ts), dont le grain convient déjà
  // à l'usage (whoosh, impact, ping, échec).
  ATTACK_SWING: 'sfx_attack_swing',
  ENEMY_HIT: 'sfx_enemy_hit',
  ENEMY_DEFEATED: 'sfx_enemy_defeated',
  PLAYER_HURT: 'sfx_player_hurt',
} as const;

export const FOOTSTEP_VARIANTS = {
  ACT_1: ['sfx_footstep_gravel_1', 'sfx_footstep_gravel_2', 'sfx_footstep_gravel_3', 'sfx_footstep_gravel_4'],
  ACT_2: ['sfx_footstep_grass_1', 'sfx_footstep_grass_2', 'sfx_footstep_grass_3', 'sfx_footstep_grass_4'],
} as const;

/** Décor parallax par zone — cf. ParallaxBackground. `null` = pas de décor peint (ambiance procédurale seule). */
export const BG_KEYS = {
  FOREST: 'forest',
  STRINGSTAR: 'stringstar',
  GRAVEYARD: 'graveyard',
  PINE_HILLS: 'pinehills',
} as const;

export const ZONE_BACKGROUND: Record<ZoneId, keyof typeof BG_KEYS | null> = {
  // Les 3 zones du Domaine de Velkhar partagent un même décor peint (nuit, lune,
  // cimetière/dojo en ruines) pour une cohérence de lieu — cf. ACKNOWLEDGEMENTS.md.
  zone1_portes_velkhar: 'GRAVEYARD',
  zone2_antre_velours_noir: 'GRAVEYARD',
  zone3_velkhar_foyer_ombres: 'GRAVEYARD',
  zone4_seikuji_quietude: 'STRINGSTAR',
  zone5_seikuji_corrompu: 'STRINGSTAR',
  zone6_jardins_oublies: 'FOREST',
  zone7_salle_miroirs: 'STRINGSTAR',
  // Décor abstrait : aucun fond peint, seul le voile de couleur (ZONE_AMBIANCE) habille le vide.
  zone8_vide_entre_deux: null,
  zone9_epilogue: 'PINE_HILLS',
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
  // wallTint = couleur dominante du fond peint de la zone (calculée depuis les assets, cf.
  // scripts/gen-floor-textures.py) composée avec le washColor ci-dessous — pas un accent choisi
  // à la main : le sol/les plateformes doivent lire comme appartenant au décor, pas comme une
  // couleur qui lui est étrangère.
  // Nuit, torches violettes
  zone1_portes_velkhar: { wallTint: 0x151631, washColor: 0x4a2f7a, washAlpha: 0.12 },
  // Obscurité presque totale, chaînes
  zone2_antre_velours_noir: { wallTint: 0x0d0f20, washColor: 0x0a0712, washAlpha: 0.35 },
  // Vide noir, énergie sombre pulsante
  zone3_velkhar_foyer_ombres: { wallTint: 0x221636, washColor: 0x6a1f6a, washAlpha: 0.22, pulse: true },
  // Blanc et doré, silence absolu
  zone4_seikuji_quietude: { wallTint: 0x6093c4, washColor: 0xffe9b0, washAlpha: 0.1 },
  // Mélange lumière brisée / ombre envahissante
  zone5_seikuji_corrompu: { wallTint: 0x486ba8, washColor: 0x3a1f5c, washAlpha: 0.28 },
  // Végétation corrompue
  zone6_jardins_oublies: { wallTint: 0x4b626c, washColor: 0x2a4a2a, washAlpha: 0.22 },
  // Réflexions, illusions
  zone7_salle_miroirs: { wallTint: 0x4a81ba, washColor: 0x3a5f8a, washAlpha: 0.2 },
  // Décor abstrait, vide
  zone8_vide_entre_deux: { wallTint: 0x0a0612, washColor: 0x0a0612, washAlpha: 0.4 },
  // Havre de l'épilogue : crépuscule chaleureux (Pine Hills), pas de pénombre à combattre.
  zone9_epilogue: { wallTint: 0x8a6a3a, washColor: 0xffb84a, washAlpha: 0.12 },
};

/**
 * Textures de sol/plateformes par zone — tuile réelle (Stringstar Fields, cf.
 * ACKNOWLEDGEMENTS.md) pré-teintée hors-ligne avec la couleur `wallTint`
 * ci-dessus (scripts/gen-floor-textures.py), plutôt qu'un aplat généré au Boot.
 */
export const ZONE_FLOOR_TEX: Record<ZoneId, string> = {
  zone1_portes_velkhar: 'tex_floor_zone1',
  zone2_antre_velours_noir: 'tex_floor_zone2',
  zone3_velkhar_foyer_ombres: 'tex_floor_zone3',
  zone4_seikuji_quietude: 'tex_floor_zone4',
  zone5_seikuji_corrompu: 'tex_floor_zone5',
  zone6_jardins_oublies: 'tex_floor_zone6',
  zone7_salle_miroirs: 'tex_floor_zone7',
  zone8_vide_entre_deux: 'tex_floor_zone8',
  zone9_epilogue: TEX.FLOOR_EPILOGUE,
};

/** Zones assez sombres ("Ombre") pour que Kiba émette une aura de lumière autour de lui. */
export const DARK_ZONES: ZoneId[] = [
  'zone2_antre_velours_noir',
  'zone3_velkhar_foyer_ombres',
  'zone8_vide_entre_deux',
];

/** Décors (Stringstar Fields / Graveyard pack, cf. ACKNOWLEDGEMENTS.md) dispersés dans les zones ayant un décor peint. */
export const DECOR_KEYS = {
  TREE_BIG: 'decor_tree_big',
  TREE_SMALL: 'decor_tree_small',
  BUSH_ROUND: 'decor_bush_round',
  ROCK: 'decor_rock',
  PLATFORM_PLANK: 'decor_platform_plank',
  GRAVEYARD_STATUE: 'decor_graveyard_statue',
  GRAVEYARD_BRUSH: 'decor_graveyard_brush',
  FOREST_GRASS_LEAFY: 'decor_forest_grass_leafy',
  FOREST_GRASS_SPIKY: 'decor_forest_grass_spiky',
} as const;

export const DECOR_PATHS: Record<string, string> = {
  [DECOR_KEYS.TREE_BIG]: `${ASSET_BASE}/images/decor/tree_big.png`,
  [DECOR_KEYS.TREE_SMALL]: `${ASSET_BASE}/images/decor/tree_small.png`,
  [DECOR_KEYS.BUSH_ROUND]: `${ASSET_BASE}/images/decor/bush_round.png`,
  [DECOR_KEYS.ROCK]: `${ASSET_BASE}/images/decor/rock.png`,
  [DECOR_KEYS.PLATFORM_PLANK]: `${ASSET_BASE}/images/decor/platform_plank.png`,
  [DECOR_KEYS.GRAVEYARD_STATUE]: `${ASSET_BASE}/images/decor/graveyard_statue.png`,
  [DECOR_KEYS.GRAVEYARD_BRUSH]: `${ASSET_BASE}/images/decor/graveyard_brush.png`,
  [DECOR_KEYS.FOREST_GRASS_LEAFY]: `${ASSET_BASE}/images/decor/forest_grass_leafy.png`,
  [DECOR_KEYS.FOREST_GRASS_SPIKY]: `${ASSET_BASE}/images/decor/forest_grass_spiky.png`,
};

/**
 * Pool de décors par thème de fond (cf. BG_KEYS / ZONE_BACKGROUND) — placés au sol, sans
 * collision. `small: true` marque les décors assez compacts pour tenir sur une plateforme
 * flottante (cf. `placePlatformDecor` dans LevelLoader.ts) ; les autres ne sont posés qu'au sol.
 */
export const DECOR_SETS: Record<'FOREST' | 'STRINGSTAR' | 'GRAVEYARD' | 'PINE_HILLS', { key: string; scale: number; small?: boolean }[]> = {
  FOREST: [
    { key: DECOR_KEYS.TREE_SMALL, scale: 1 },
    { key: DECOR_KEYS.BUSH_ROUND, scale: 1.1, small: true },
    { key: DECOR_KEYS.ROCK, scale: 1, small: true },
    // Touffes d'herbe (Pixel Art Tiles and Backgrounds - Woods, cf. ACKNOWLEDGEMENTS.md) —
    // décor au sol supplémentaire, assez compact pour aussi tenir sur une plateforme.
    { key: DECOR_KEYS.FOREST_GRASS_LEAFY, scale: 1.6, small: true },
    { key: DECOR_KEYS.FOREST_GRASS_SPIKY, scale: 1.8, small: true },
  ],
  STRINGSTAR: [
    { key: DECOR_KEYS.TREE_BIG, scale: 0.85 },
    { key: DECOR_KEYS.TREE_SMALL, scale: 0.9 },
    { key: DECOR_KEYS.BUSH_ROUND, scale: 1.1, small: true },
    { key: DECOR_KEYS.ROCK, scale: 0.9, small: true },
  ],
  // Cimetière du Domaine de Velkhar : statues et broussailles mortes plutôt que les
  // arbres/rochers "Stringstar" utilisés ailleurs, pour rester cohérent avec le fond peint.
  GRAVEYARD: [
    { key: DECOR_KEYS.GRAVEYARD_STATUE, scale: 0.95 },
    { key: DECOR_KEYS.GRAVEYARD_BRUSH, scale: 1.1, small: true },
    { key: DECOR_KEYS.ROCK, scale: 0.9, small: true },
  ],
  // Pine Hills n'a pas ses propres props au sol (juste des calques de fond peints) — réutilise
  // les décors génériques bois/forêt, thématiquement cohérents avec ses pins et ses collines.
  PINE_HILLS: [
    { key: DECOR_KEYS.TREE_SMALL, scale: 1 },
    { key: DECOR_KEYS.BUSH_ROUND, scale: 1.1, small: true },
    { key: DECOR_KEYS.FOREST_GRASS_LEAFY, scale: 1.6, small: true },
  ],
};

/**
 * Comportement de combat par boss (cf. message.txt, tableau des boss, pour le gimmick visé) :
 * - `slow_slam` : lent, rayon de contact large ("attaques de zone").
 * - `erratic_fast` : rapide, change de direction sans prévenir.
 * - `mirror` : reproduit la position horizontale récente du joueur avec un délai (~1s).
 * - `phases` / `phases3` : devient plus rapide/dangereux sous un seuil de PV (2 ou 3 paliers).
 * `musicRate` : aucune piste dédiée par boss n'existe (10 pistes déjà toutes utilisées pour les
 * zones/menu/fin, cf. ACKNOWLEDGEMENTS.md) — la musique de la zone en cours est rejouée à un
 * régime (vitesse/hauteur) distinct par boss pendant le combat, pour une identité audible propre
 * à chacun sans nécessiter un nouveau fichier.
 */
export interface BossDef {
  name: string;
  hp: number;
  speed: number;
  pattern: 'slow_slam' | 'erratic_fast' | 'mirror' | 'phases' | 'phases3';
  musicRate: number;
  dialogTree?: string;
  /** Sprite réel (+ animation d'idle) pour ce boss précis — sinon TEX.ENEMY générique teinté rouge. */
  texture?: string;
  animKey?: string;
  /** Échelle du sprite en combat — sinon 1.7 par défaut (cf. Enemy.ts), calibrée sur les sprites
   * de boss existants (48-64px). Un boss dont le sprite source est petit/discret une fois recadré
   * (ex. le samouraï, 40x40) peut vouloir un multiplicateur propre plutôt que se fondre à la même
   * taille que les autres malgré une source différente. */
  scale?: number;
  /** Corps physique resserré sur le contenu opaque réel de la frame (avant échelle), plutôt que la
   * frame entière — sans ça, la marge transparente autour du personnage (ex. le samouraï, dont la
   * frame 40x40 ne contient qu'un contenu de 24x34) se fait passer pour du corps, décalant
   * visiblement les pieds du bas RÉEL du corps une fois posé au sol (même idée que le corps
   * resserré du pattern 'phases3' ci-dessous, généralisée à n'importe quel boss). */
  bodyFit?: { width: number; height: number; offsetX: number; offsetY: number };
}

export const BOSS_DEFS: Record<string, BossDef> = {
  boss_gardien_de_pierre: { name: 'Le Gardien de Pierre', hp: 6, speed: 30, pattern: 'slow_slam', musicRate: 0.9, dialogTree: 'boss_gardien_de_pierre_pre_fight', texture: TEX.BOSS_STONE_GUARDIAN },
  // Vieux samouraï aux yeux clos (FREE_Samurai 2D Pixel Art, cf. ACKNOWLEDGEMENTS.md) — se lit
  // "aveugle" sans le moindre artifice de teinte, contrairement au recyclage précédent du crâne.
  boss_maitre_aveugle: {
    name: 'Maître Aveugle',
    hp: 7,
    speed: 95,
    pattern: 'erratic_fast',
    musicRate: 1.15,
    dialogTree: 'boss_maitre_aveugle_pre_fight',
    texture: TEX.BOSS_SAMURAI,
    animKey: ANIM_KEYS.SAMURAI_IDLE,
    scale: 6.8 / 3,
    bodyFit: { width: 24, height: 34, offsetX: 8, offsetY: 4 },
  },
  // Le "double" de Kiba prend le visage d'une chatte-ninja miroir plutôt que le losange générique.
  boss_ombre_jumelle: { name: "L'Ombre Jumelle", hp: 8, speed: 70, pattern: 'mirror', musicRate: 0.95, dialogTree: 'boss_ombre_jumelle_pre_fight', texture: TEX.CATGIRL_BOSS, animKey: ANIM_KEYS.CATGIRL_IDLE },
  boss_velkhar_ancien: { name: "Velkhar l'Ancien", hp: 10, speed: 50, pattern: 'phases', musicRate: 1.08, dialogTree: 'boss_velkhar_ancien_pre_fight' },
  boss_jardinier_corrompu: { name: 'Le Jardinier Corrompu', hp: 11, speed: 35, pattern: 'slow_slam', musicRate: 1.02, dialogTree: 'boss_jardinier_corrompu_pre_fight' },
  // Esprit-chat spectral bleu (BLUE/RED Aseprite pack, cf. ACKNOWLEDGEMENTS.md) plutôt que le
  // losange générique : la teinte froide/éthérée se lit bien comme un double "de lumière".
  boss_double_de_lumiere: { name: 'Le Double de Lumière', hp: 12, speed: 75, pattern: 'mirror', musicRate: 1.18, dialogTree: 'boss_double_de_lumiere_pre_fight', texture: TEX.GHOST_CAT_BLUE, animKey: ANIM_KEYS.GHOST_CAT_BLUE_IDLE },
  // Boss final : variante rouge du même esprit-chat, la plus menaçante — cohérente avec Malakar
  // comme source de la corruption dont les doubles/esprits des autres boss ne sont que des échos.
  boss_malakar_final: { name: 'Malakar, Sensei de l\'Ombre', hp: 18, speed: 60, pattern: 'phases3', musicRate: 0.85, dialogTree: 'malakar_zone8_pre_boss', texture: TEX.GHOST_CAT_RED, animKey: ANIM_KEYS.GHOST_CAT_RED_IDLE },
};
