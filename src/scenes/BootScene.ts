import Phaser from 'phaser';
import {
  SCENE_KEYS,
  TEX,
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  ASSET_BASE,
  MUSIC_KEYS,
  SFX_KEYS,
  FOOTSTEP_VARIANTS,
  ZONE_FLOOR_TEX,
  DECOR_PATHS,
} from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';

const FOREST_LAYER_INDICES = Array.from({ length: 12 }, (_, i) => i);

/**
 * Charge les assets réels (musique, SFX, décors parallax — cf. ACKNOWLEDGEMENTS.md)
 * et génère les textures de gameplay procéduralement (silhouettes de tuiles/marqueurs,
 * volontairement simples : l'art de personnage/combat reste hors scope).
 */
export class BootScene extends Phaser.Scene {
  private progressBox!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    this.buildLoadingBar();

    // --- Musique du menu seulement ici (~5 Mo) : les pistes de zone (~45 Mo) sont
    // chargées à la demande par AudioManager.playMusic(), pour que le menu soit
    // interactif au plus vite (cf. Constants.MUSIC_PATHS).
    this.load.audio(MUSIC_KEYS.MENU, `${ASSET_BASE}/audio/music/menu.ogg`);

    // --- SFX ---
    const sfxFile: Record<string, string> = {
      [SFX_KEYS.UI_HOVER]: 'ui_hover',
      [SFX_KEYS.UI_CONFIRM]: 'ui_confirm',
      [SFX_KEYS.UI_SELECT]: 'ui_select',
      [SFX_KEYS.UI_CANCEL]: 'ui_cancel',
      [SFX_KEYS.DIALOG_ADVANCE]: 'dialog_advance',
      [SFX_KEYS.PAUSE_OPEN]: 'pause_open',
      [SFX_KEYS.PAUSE_CLOSE]: 'pause_close',
      [SFX_KEYS.POWER_UNLOCK]: 'power_unlock',
      [SFX_KEYS.COMBO_TRIGGER]: 'combo_trigger',
      [SFX_KEYS.PUZZLE_SOLVED]: 'puzzle_solved',
      [SFX_KEYS.PUZZLE_FAIL]: 'puzzle_fail',
      [SFX_KEYS.BOSS_DEFEATED]: 'boss_defeated',
      [SFX_KEYS.PIVOT_STING]: 'pivot_sting',
      [SFX_KEYS.PIVOT_ABSORB]: 'pivot_absorb',
      [SFX_KEYS.ENDING_POSITIVE]: 'ending_positive',
      [SFX_KEYS.ENDING_NEGATIVE]: 'ending_negative',
      [SFX_KEYS.SHARD_COLLECT]: 'shard_collect',
      [SFX_KEYS.DASH]: 'dash',
      [SFX_KEYS.ZONE_TRANSITION]: 'zone_transition',
      [SFX_KEYS.SHADOW_FORM]: 'shadow_form',
    };
    Object.entries(sfxFile).forEach(([key, file]) => {
      this.load.audio(key, `${ASSET_BASE}/audio/sfx/${file}.wav`);
    });
    [...FOOTSTEP_VARIANTS.ACT_1, ...FOOTSTEP_VARIANTS.ACT_2].forEach((key) => {
      const file = key.replace('sfx_', '');
      this.load.audio(key, `${ASSET_BASE}/audio/sfx/${file}.wav`);
    });

    // --- Décors parallax ---
    FOREST_LAYER_INDICES.forEach((i) => {
      const n = String(i).padStart(2, '0');
      this.load.image(`bg_forest_${n}`, `${ASSET_BASE}/images/backgrounds/forest/layer_${n}.png`);
    });
    ['00', '01', '02'].forEach((n) => {
      this.load.image(`bg_stringstar_${n}`, `${ASSET_BASE}/images/backgrounds/stringstar/layer_${n}.png`);
    });

    // --- Textures de sol par zone (pré-teintées, cf. Constants.ZONE_FLOOR_TEX) ---
    Object.entries(ZONE_FLOOR_TEX).forEach(([zoneId, texKey]) => {
      const n = zoneId.match(/^zone(\d)/)?.[1];
      this.load.image(texKey, `${ASSET_BASE}/images/tiles/floor_zone${n}.png`);
    });

    // --- Décors dispersés dans les niveaux ---
    Object.entries(DECOR_PATHS).forEach(([key, path]) => {
      this.load.image(key, path);
    });
  }

  create(): void {
    this.progressBox.destroy();
    this.progressBar.destroy();
    this.progressLabel.destroy();

    audioManager.attach(this);

    this.generateTileTexture(TEX.BREAKABLE, 0x8a5a2e, true);
    this.generateTileTexture(TEX.HIDDEN, 0x2a2a3a, false, 0.35);
    this.generateTileTexture(TEX.DASH_GATE, 0x3fb5b0, true);
    this.generateTileTexture(TEX.SHADOW_WALL, 0x5a2e8a, false, 0.55);
    this.generateTileTexture(TEX.LIGHT_OBSTACLE, 0xd8b34a, true);

    this.generatePlayerTexture();
    this.generateGlowTexture();
    this.generateMarkerTexture(TEX.NPC, 0x4ac9e0, 'circle');
    this.generateMarkerTexture(TEX.BOSS_ARENA, 0xd63b3b, 'diamond');
    this.generateMarkerTexture(TEX.ZONE_EXIT, 0x4ae08a, 'arrow');
    this.generateMarkerTexture(TEX.PUZZLE_TRIGGER, 0xd8b34a, 'square');
    this.generateMarkerTexture(TEX.POWER_ALTAR, 0xffffff, 'star');
    this.generateMarkerTexture(TEX.SHARD, 0xffe27a, 'shard');

    const particle = this.make.graphics({ x: 0, y: 0 });
    particle.fillStyle(0xffffff, 1);
    particle.fillCircle(4, 4, 4);
    particle.generateTexture(TEX.PARTICLE, 8, 8);
    particle.destroy();

    this.scene.start(SCENE_KEYS.MENU);
  }

  private buildLoadingBar(): void {
    this.cameras.main.setBackgroundColor(0x05040a);
    const barW = 480;
    const barH = 20;
    const x = GAME_WIDTH / 2 - barW / 2;
    const y = GAME_HEIGHT / 2;

    this.add
      .text(GAME_WIDTH / 2, y - 50, 'SHADOWPAW', { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#d8b34a' })
      .setOrigin(0.5);

    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(2, 0xd8b34a, 0.8);
    this.progressBox.strokeRect(x, y, barW, barH);

    this.progressBar = this.add.graphics();
    this.progressLabel = this.add
      .text(GAME_WIDTH / 2, y + 34, 'Chargement...', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7fa0' })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xd8b34a, 1);
      this.progressBar.fillRect(x + 3, y + 3, (barW - 6) * value, barH - 6);
      this.progressLabel.setText(`Chargement... ${Math.round(value * 100)}%`);
    });
  }

  private generateTileTexture(key: string, color: number, hatch = false, alpha = 1): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, alpha);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0x000000, 0.25);
    g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    if (hatch) {
      g.lineStyle(2, 0x000000, 0.2);
      g.lineBetween(0, TILE_SIZE, TILE_SIZE, 0);
      g.lineBetween(0, TILE_SIZE / 2, TILE_SIZE / 2, 0);
      g.lineBetween(TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, TILE_SIZE / 2);
    }
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  private generatePlayerTexture(): void {
    const w = 22;
    const h = 30;
    const g = this.make.graphics({ x: 0, y: 0 });
    // Moitié gauche : chat gris. Moitié droite : ombre violette. (dualité de Kiba)
    g.fillStyle(0x9a9aa5, 1);
    g.fillRoundedRect(0, 0, w / 2, h, 4);
    g.fillStyle(0x5a2e8a, 1);
    g.fillRoundedRect(w / 2, 0, w / 2, h, 4);
    g.fillStyle(0xdedede, 1);
    g.fillCircle(w / 2, 6, 3);
    g.generateTexture(TEX.PLAYER, w, h);
    g.destroy();
  }

  /** Halo doux (dégradé radial approximé par cercles superposés) — aura de lumière de Kiba dans les zones sombres. */
  private generateGlowTexture(): void {
    const size = 160;
    const cx = size / 2;
    const cy = size / 2;
    const g = this.make.graphics({ x: 0, y: 0 });
    const steps = 24;
    for (let i = steps; i >= 1; i--) {
      const r = (i / steps) * (size / 2);
      const alpha = (1 - i / steps) * 0.4;
      g.fillStyle(0xffe9b0, alpha);
      g.fillCircle(cx, cy, r);
    }
    g.generateTexture(TEX.PLAYER_GLOW, size, size);
    g.destroy();
  }

  private generateMarkerTexture(key: string, color: number, shape: 'circle' | 'diamond' | 'arrow' | 'square' | 'star' | 'shard'): void {
    const size = 28;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 0.9);
    g.lineStyle(2, 0xffffff, 0.8);
    const c = size / 2;
    switch (shape) {
      case 'circle':
        g.fillCircle(c, c, c - 2);
        g.strokeCircle(c, c, c - 2);
        break;
      case 'diamond':
        g.beginPath();
        g.moveTo(c, 2);
        g.lineTo(size - 2, c);
        g.lineTo(c, size - 2);
        g.lineTo(2, c);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'arrow':
        g.beginPath();
        g.moveTo(4, 4);
        g.lineTo(size - 4, c);
        g.lineTo(4, size - 4);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'square':
        g.fillRoundedRect(3, 3, size - 6, size - 6, 4);
        g.strokeRoundedRect(3, 3, size - 6, size - 6, 4);
        break;
      case 'star':
      case 'shard':
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? c - 2 : c / 2.4;
          const px = c + r * Math.cos(ang);
          const py = c + r * Math.sin(ang);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
