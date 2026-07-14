import Phaser from 'phaser';
import type { EntityNPC } from '@/utils/Types';
import type { PowerSystem } from '@/systems/PowerSystem';

const INTERACT_RANGE = 48;

/**
 * PNJ interactif : marqueur + indicateur de proximité + déclenchement de dialogue.
 * Ne gère aucune IA ni combat — seulement la présence et l'ouverture du dialogue.
 */
export class NPC {
  readonly prompt: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly marker: Phaser.GameObjects.Sprite,
    readonly data: EntityNPC,
    private readonly powers: PowerSystem,
  ) {
    this.prompt = scene.add
      .text(marker.x, marker.y - 26, 'E', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    if (data.requiresPower) {
      marker.setVisible(this.powers.has(data.requiresPower));
    }
  }

  isAvailable(): boolean {
    return !this.data.requiresPower || this.powers.has(this.data.requiresPower);
  }

  update(playerX: number, playerY: number): void {
    if (this.data.requiresPower) {
      const visible = this.powers.has(this.data.requiresPower);
      this.marker.setVisible(visible);
      if (!visible) {
        this.prompt.setVisible(false);
        return;
      }
    }
    const dist = Phaser.Math.Distance.Between(playerX, playerY, this.marker.x, this.marker.y);
    this.prompt.setVisible(dist <= INTERACT_RANGE);
  }

  isInRange(playerX: number, playerY: number): boolean {
    if (!this.isAvailable()) return false;
    return Phaser.Math.Distance.Between(playerX, playerY, this.marker.x, this.marker.y) <= INTERACT_RANGE;
  }

  destroy(): void {
    this.prompt.destroy();
  }
}
