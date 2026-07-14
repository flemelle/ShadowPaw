import Phaser from 'phaser';
import { TILE_SIZE } from '@/utils/Constants';

/** Configure la caméra principale pour suivre le joueur dans les limites d'une zone. */
export class CameraSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  setupForZone(cols: number, rows: number, target: Phaser.GameObjects.GameObject): void {
    const cam = this.scene.cameras.main;
    cam.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    cam.startFollow(target as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, true, 0.12, 0.12);
    cam.setDeadzone(120, 80);
  }

  fadeOutIn(durationMs = 300, onMid?: () => void): void {
    const cam = this.scene.cameras.main;
    cam.fadeOut(durationMs, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      onMid?.();
      cam.fadeIn(durationMs, 0, 0, 0);
    });
  }
}
