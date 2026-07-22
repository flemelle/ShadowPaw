import Phaser from 'phaser';
import { TILE_SIZE } from '@/utils/Constants';

/** Niveau de zoom par défaut en jeu — dézoomé pour laisser voir davantage de plateformes autour du joueur. */
export const GAMEPLAY_ZOOM = 1.4;

/** Configure la caméra principale pour suivre le joueur dans les limites d'une zone. */
export class CameraSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  setupForZone(cols: number, rows: number, target: Phaser.GameObjects.GameObject, zoom = GAMEPLAY_ZOOM): void {
    const cam = this.scene.cameras.main;
    cam.setZoom(zoom);
    cam.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    cam.startFollow(target as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, true, 0.14, 0.14);
    cam.setDeadzone(80, 60);
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
