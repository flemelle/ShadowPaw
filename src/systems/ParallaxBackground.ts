import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/utils/Constants';
import { GAMEPLAY_ZOOM } from '@/systems/CameraSystem';
import type { ZoneAmbiance } from '@/utils/Constants';

interface LayerSpec {
  key: string;
  scrollFactor: number;
  alpha?: number;
  blend?: Phaser.BlendModes;
  tint?: number;
}

/**
 * Décors peints (Free Pixel Art Forest — Eder Muniz / Stringstar Fields) — cf.
 * ACKNOWLEDGEMENTS.md. Ordonnés du plus lointain au plus proche, chaque couche
 * utilise un scrollFactor réduit pour l'effet de parallax et se répète en
 * TileSprite pour couvrir toute la largeur de la zone.
 */
const FOREST_LAYERS: LayerSpec[] = [
  { key: 'bg_forest_11', scrollFactor: 0.02 },
  { key: 'bg_forest_10', scrollFactor: 0.04 },
  { key: 'bg_forest_02', scrollFactor: 0.08 },
  { key: 'bg_forest_01', scrollFactor: 0.12 },
  { key: 'bg_forest_00', scrollFactor: 0.15 },
  { key: 'bg_forest_09', scrollFactor: 0.2 },
  { key: 'bg_forest_08', scrollFactor: 0.28 },
  { key: 'bg_forest_06', scrollFactor: 0.34 },
  { key: 'bg_forest_04', scrollFactor: 0.34, alpha: 0.45, blend: Phaser.BlendModes.ADD },
  { key: 'bg_forest_05', scrollFactor: 0.42 },
  { key: 'bg_forest_03', scrollFactor: 0.5 },
  { key: 'bg_forest_07', scrollFactor: 0.5, alpha: 0.45, blend: Phaser.BlendModes.ADD },
];

const STRINGSTAR_LAYERS: LayerSpec[] = [
  { key: 'bg_stringstar_00', scrollFactor: 0.03 },
  { key: 'bg_stringstar_01', scrollFactor: 0.08 },
  { key: 'bg_stringstar_02', scrollFactor: 0.16 },
];

/**
 * Domaine de Velkhar (nuit, cimetière, lune) — pack ajouté ultérieurement, en bien plus
 * haute résolution que Stringstar Fields (768x416+ contre 288x180), cf. ACKNOWLEDGEMENTS.md.
 * Remplace le mauvais accord Forest/vide utilisé jusqu'ici pour les zones 1-3 de l'Acte 1.
 */
const GRAVEYARD_LAYERS: LayerSpec[] = [
  { key: 'bg_graveyard_00', scrollFactor: 0.04 },
  { key: 'bg_graveyard_01', scrollFactor: 0.12 },
  { key: 'bg_graveyard_02', scrollFactor: 0.26 },
  { key: 'bg_graveyard_03', scrollFactor: 0.4 },
];

/** Havre de l'épilogue (cf. GameState.EPILOGUE_ZONE_ID) — pack "Pine Hills" (cf.
 * ACKNOWLEDGEMENTS.md), ciel crépusculaire chaleureux plutôt que la nuit/l'ombre du reste du jeu. */
const PINE_HILLS_LAYERS: LayerSpec[] = [
  { key: 'bg_pinehills_00', scrollFactor: 0.02 },
  { key: 'bg_pinehills_01', scrollFactor: 0.04 },
  { key: 'bg_pinehills_02', scrollFactor: 0.06 },
  { key: 'bg_pinehills_03', scrollFactor: 0.08 },
  { key: 'bg_pinehills_04', scrollFactor: 0.1 },
  { key: 'bg_pinehills_05', scrollFactor: 0.12 },
  { key: 'bg_pinehills_06', scrollFactor: 0.16 },
  { key: 'bg_pinehills_07', scrollFactor: 0.24 },
  { key: 'bg_pinehills_08', scrollFactor: 0.32 },
  { key: 'bg_pinehills_09', scrollFactor: 0.42 },
  { key: 'bg_pinehills_10', scrollFactor: 0.48 },
  { key: 'bg_pinehills_11', scrollFactor: 0.52 },
  { key: 'bg_pinehills_12', scrollFactor: 0.56 },
  { key: 'bg_pinehills_13', scrollFactor: 0.62 },
];

export const BACKGROUND_SETS: Record<'FOREST' | 'STRINGSTAR' | 'GRAVEYARD' | 'PINE_HILLS', LayerSpec[]> = {
  FOREST: FOREST_LAYERS,
  STRINGSTAR: STRINGSTAR_LAYERS,
  GRAVEYARD: GRAVEYARD_LAYERS,
  PINE_HILLS: PINE_HILLS_LAYERS,
};

export class ParallaxBackground {
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private corruption?: Phaser.GameObjects.Rectangle;
  private wash?: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    set: 'FOREST' | 'STRINGSTAR' | 'GRAVEYARD' | 'PINE_HILLS' | null,
    zoneWidthPx: number,
    withCorruptionOverlay: boolean,
    ambiance?: ZoneAmbiance,
    // Zoom de LA CAMÉRA QUI AFFICHE ce fond — GAMEPLAY_ZOOM (1.4) par défaut pour GameScene,
    // mais 1 pour un usage hors gameplay (ex. MenuScene, dont la caméra n'est pas dézoomée) :
    // sans ce paramètre, le calcul supposait TOUJOURS une caméra à GAMEPLAY_ZOOM et affichait
    // les calques ~30% plus petits que l'écran partout ailleurs, laissant un vide en bas.
    cameraZoom: number = GAMEPLAY_ZOOM,
  ) {
    if (set) {
      const specs = BACKGROUND_SETS[set];
      // Marge généreuse des deux côtés pour qu'aucun bord ne soit découvert, quel que soit
      // le scrollFactor de la couche ou la largeur de la zone (nos zones restent < GAME_WIDTH).
      const margin = GAME_WIDTH + zoneWidthPx / 2;
      specs.forEach((spec, i) => {
        const tex = scene.textures.get(spec.key);
        const srcH = tex.source[0]?.height ?? GAME_HEIGHT;
        // Échelle qui fait tenir la composition d'origine (ciel en haut, sol en bas) exactement
        // dans la hauteur d'écran — ne JAMAIS la modifier pour "surcadrer" verticalement : ces
        // images ne sont pas conçues pour se répéter à la verticale (bandes de ciel à plat), un
        // rééchantillonnage recentré fait apparaître une tranche différente = bandes de couleur
        // qui jurent. Le suivi vertical de la caméra (scrollFactorY ci-dessous) suffit à éviter
        // le vide en haut/bas sur nos zones, plus courtes que GAME_HEIGHT en pixels monde.
        // Divisé par cameraZoom : la caméra grossit tout ce qu'elle affiche, donc sans cette
        // compensation l'image rendait `cameraZoom`x plus grande (ou plus petite) que
        // "exactement un écran" — assez pour pousser le premier plan hors du cadre (zoom>1) ou
        // laisser un vide en bas (zoom=1, cf. Menu) plutôt que de tenir exactement à l'écran.
        const scale = GAME_HEIGHT / srcH / cameraZoom;
        const tileW = (GAME_WIDTH + 2 * margin) / scale;

        const layer = scene.add.tileSprite(-margin, 0, tileW, srcH, spec.key).setOrigin(0, 0);
        layer.setScale(scale);
        layer.setScrollFactor(spec.scrollFactor, spec.scrollFactor);
        layer.setDepth(-100 + i);
        if (spec.alpha !== undefined) layer.setAlpha(spec.alpha);
        if (spec.blend !== undefined) layer.setBlendMode(spec.blend);
        if (spec.tint !== undefined) layer.setTint(spec.tint);
        this.layers.push(layer);
      });
    }

    if (ambiance) {
      this.wash = scene.add
        .rectangle(0, 0, scene.scale.width, scene.scale.height, ambiance.washColor, ambiance.washAlpha)
        .setOrigin(0, 0)
        .setScrollFactor(0, 0)
        .setDepth(-20);
      if (ambiance.pulse) {
        scene.tweens.add({
          targets: this.wash,
          alpha: Math.min(0.6, ambiance.washAlpha + 0.18),
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
    }

    if (withCorruptionOverlay) {
      this.corruption = scene.add
        .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x3a1f5c, 0.35)
        .setOrigin(0, 0)
        .setScrollFactor(0, 0)
        .setDepth(-10);
    }
  }

  /** 0 = corruption totale, 1 = totalement purifié (les éclats de Hikari no Ne repoussent l'ombre). */
  setPurificationLevel(t: number): void {
    if (!this.corruption) return;
    this.corruption.setAlpha(Phaser.Math.Clamp(0.45 * (1 - t), 0, 0.45));
  }

  /** Objets à exclure de la caméra UI (ils appartiennent au monde, pas au HUD). */
  getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [...this.layers, ...(this.corruption ? [this.corruption] : []), ...(this.wash ? [this.wash] : [])];
  }

  destroy(): void {
    this.layers.forEach((l) => l.destroy());
    this.corruption?.destroy();
    this.wash?.destroy();
  }
}
