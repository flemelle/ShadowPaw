/**
 * Profils structurels par zone + constantes de saut — portés depuis scripts/gen-zones.mjs
 * (source de vérité historique, toujours utilisée pour re-générer les tuiles statiques de
 * secours) vers TypeScript pour que le CLIENT puisse aussi : (a) informer le prompt envoyé à
 * l'IA de génération de zone des contraintes structurelles/de saut à respecter, et (b) faire
 * tourner le générateur procédural (cf. ProceduralZoneGenerator.ts) comme repli local si l'IA
 * échoue, sans dépendre du script Node (qui utilise `fs`, indisponible dans le navigateur).
 *
 * Toute zone qui change ici doit rester cohérente avec scripts/gen-zones.mjs — les deux copies
 * ne peuvent pas partager un seul module (l'un tourne sous Node à la construction des assets
 * statiques, l'autre est bundlé par Vite pour le navigateur), d'où la duplication assumée.
 */

export interface PlatformConfig {
  count: number;
  width: [number, number];
  heightAbove: [number, number];
}

export interface ZoneProfile {
  cols: number;
  rows: number;
  ceilingGap: number;
  seed: number;
  pitChance: number;
  pitWidth: [number, number];
  plat: PlatformConfig;
  gateChar: string;
  gateSpots: number[];
  undulate: boolean;
  /** false uniquement sur les tout premiers niveaux (zone1/zone2) — pas de tours en hauteur
   * avant que le joueur ait acquis les bases. Absent (undefined) ⇒ autorisé. */
  allowTowers?: boolean;
  /** true uniquement pour la Salle des Miroirs (zone7) — moitié gauche générée puis reflétée. */
  mirror?: boolean;
  entityFracs: Record<string, number>;
}

/** Cf. entities/Player.ts (MOVE_SPEED/JUMP_SPEED) et main.ts (gravity.y) — seule source de
 * vérité pour la physique de saut, à tenir synchronisée avec ces deux fichiers. */
export const JUMP_PHYSICS = {
  MOVE_SPEED: 200,
  JUMP_SPEED: 480,
  GRAVITY_Y: 900,
} as const;

/**
 * Portée maximale d'un saut en course : temps de vol 2*JUMP_SPEED/GRAVITY_Y à MOVE_SPEED px/s,
 * en tuiles de 32px. Une fosse plus large est mathématiquement infranchissable au jugé, quel
 * que soit le doigté du joueur — c'est la règle d'accessibilité que le validateur applique aux
 * layouts générés par l'IA (cf. ZoneValidator.ts), qu'importe la géométrie exacte imaginée.
 */
export const MAX_JUMP_TILES =
  (2 * JUMP_PHYSICS.JUMP_SPEED) / JUMP_PHYSICS.GRAVITY_Y * JUMP_PHYSICS.MOVE_SPEED / 32;

/** Marge conservatrice utilisée par le générateur procédural (fosses, jamais au maximum théorique). */
export const MAX_SAFE_PIT_WIDTH = 4;

/** Légende des caractères de la grille de tuiles (cf. Types.ts ZoneMap.tiles, LevelLoader.ts). */
export const TILE_LEGEND: Record<string, string> = {
  '.': 'vide / air',
  '#': 'sol solide',
  C: 'paroi fissurée — nécessite griffes_renforcees pour être détruite',
  V: 'passage caché — révélé par vision_feline (solide sinon)',
  D: 'grille — traversable en dash via dash_fantome',
  S: 'matière fine — traversable en intangibilité via forme_ombre',
  L: 'obstacle d\'ombre corrompue — détruit par eclat_lumiere',
};

export const ZONE_PROFILES: Record<string, ZoneProfile> = {
  zone1_portes_velkhar: {
    cols: 130, rows: 14, ceilingGap: 3, seed: 101,
    pitChance: 0.06, pitWidth: [3, 4],
    plat: { count: 18, width: [4, 6], heightAbove: [2, 2] },
    gateChar: 'C', gateSpots: [],
    undulate: true,
    allowTowers: false,
    entityFracs: { spawn: 0.03, npc0: 0.15, zone_exit0: 0.97 },
  },
  zone2_antre_velours_noir: {
    cols: 145, rows: 15, ceilingGap: 5, seed: 202,
    pitChance: 0.11, pitWidth: [3, 4],
    plat: { count: 34, width: [2, 3], heightAbove: [2, 2] },
    gateChar: 'C', gateSpots: [0.25, 0.5, 0.78],
    undulate: true,
    allowTowers: false,
    entityFracs: { spawn: 0.03, npc0: 0.2, zone_exit0: 0.97 },
  },
  zone3_velkhar_foyer_ombres: {
    cols: 145, rows: 19, ceilingGap: 3, seed: 303,
    pitChance: 0.1, pitWidth: [3, 4],
    plat: { count: 30, width: [3, 5], heightAbove: [2, 2] },
    gateChar: 'V', gateSpots: [0.3, 0.65],
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.22, npc1: 0.4, zone_exit0: 0.97 },
  },
  zone4_seikuji_quietude: {
    cols: 160, rows: 16, ceilingGap: 3, seed: 404,
    pitChance: 0.05, pitWidth: [3, 4],
    plat: { count: 26, width: [4, 7], heightAbove: [2, 2] },
    gateChar: 'D', gateSpots: [0.2, 0.4, 0.6, 0.8],
    undulate: false,
    entityFracs: { spawn: 0.03, npc0: 0.1, power_altar0: 0.92, zone_exit0: 0.98 },
  },
  zone5_seikuji_corrompu: {
    cols: 160, rows: 15, ceilingGap: 3, seed: 505,
    pitChance: 0.12, pitWidth: [3, 4],
    plat: { count: 34, width: [2, 6], heightAbove: [2, 2] },
    gateChar: 'L', gateSpots: [0.3, 0.6],
    undulate: true,
    entityFracs: { spawn: 0.03, npc0: 0.15, puzzle_trigger0: 0.5, zone_exit0: 0.97 },
  },
  zone6_jardins_oublies: {
    cols: 190, rows: 16, ceilingGap: 3, seed: 606,
    pitChance: 0.08, pitWidth: [3, 4],
    plat: { count: 30, width: [4, 7], heightAbove: [2, 2] },
    gateChar: 'L', gateSpots: [0.25, 0.55],
    undulate: true,
    entityFracs: { spawn: 0.02, npc0: 0.08, puzzle_trigger0: 0.2, puzzle_trigger1: 0.4, puzzle_trigger2: 0.6, zone_exit0: 0.97 },
  },
  zone7_salle_miroirs: {
    cols: 190, rows: 16, ceilingGap: 3, seed: 707,
    pitChance: 0.08, pitWidth: [3, 4],
    plat: { count: 17, width: [3, 5], heightAbove: [2, 2] },
    gateChar: 'S', gateSpots: [0.35, 0.7],
    undulate: false,
    mirror: true,
    entityFracs: { spawn: 0.02, npc0: 0.1, puzzle_trigger0: 0.22, puzzle_trigger1: 0.42, puzzle_trigger2: 0.62, zone_exit0: 0.97 },
  },
  zone8_vide_entre_deux: {
    cols: 130, rows: 14, ceilingGap: 3, seed: 808,
    pitChance: 0.2, pitWidth: [3, 4],
    plat: { count: 20, width: [2, 4], heightAbove: [2, 2] },
    gateChar: 'S', gateSpots: [],
    undulate: false,
    entityFracs: { spawn: 0.03, puzzle_trigger0: 0.25, npc0: 0.55, boss_arena0: 0.85, ending_trigger0: 0.97 },
  },
};

/** 5 mobs par zone, tier croissant de gauche à droite (cf. entities/Enemy.ts mobHp/mobSpeed). */
export const MOB_FRACS = [0.18, 0.34, 0.5, 0.66, 0.82] as const;

export const CAPTIVE_FRAC: Record<string, number> = {
  zone2_antre_velours_noir: 0.62,
  zone3_velkhar_foyer_ombres: 0.52,
  zone4_seikuji_quietude: 0.72,
  zone6_jardins_oublies: 0.46,
  zone7_salle_miroirs: 0.52,
  zone8_vide_entre_deux: 0.68,
};

export const CAT_DECOR_FRACS = [0.08, 0.93] as const;
export const CAT_DECOR_VARIANT_COUNT = 3;
