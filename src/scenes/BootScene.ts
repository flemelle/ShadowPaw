import Phaser from 'phaser';
import { SCENE_KEYS, TEX, TILE_SIZE, PALETTES } from '@/utils/Constants';

/**
 * Génère toutes les textures du jeu procéduralement (aucun asset externe requis
 * à ce stade — le pipeline Leonardo/Meshy/Blender remplacera ces placeholders).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    this.load.on('progress', () => {});
  }

  create(): void {
    this.generateTileTexture(TEX.WALL_ACT1, PALETTES.ACT_1.wall);
    this.generateTileTexture(TEX.WALL_ACT2, PALETTES.ACT_2.wall);
    this.generateTileTexture(TEX.BREAKABLE, 0x8a5a2e, true);
    this.generateTileTexture(TEX.HIDDEN, 0x2a2a3a, false, 0.35);
    this.generateTileTexture(TEX.DASH_GATE, 0x3fb5b0, true);
    this.generateTileTexture(TEX.SHADOW_WALL, 0x5a2e8a, false, 0.55);
    this.generateTileTexture(TEX.LIGHT_OBSTACLE, 0xd8b34a, true);

    this.generatePlayerTexture();
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
