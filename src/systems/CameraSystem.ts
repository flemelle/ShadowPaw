import Phaser from 'phaser';
import { TILE_SIZE } from '@/utils/Constants';

/** Niveau de zoom par défaut en jeu — dézoomé pour laisser voir davantage de plateformes autour du joueur. */
export const GAMEPLAY_ZOOM = 1.4;

type FollowTarget = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

/**
 * Caméra principale : suit le joueur horizontalement en continu (via le follow natif de
 * Phaser), mais verticalement à la main dans `update()` — le sol reste ancré tout en bas de
 * l'écran tant que le joueur reste dans la moitié basse, la caméra ne remontant que s'il
 * dépasse la moitié de l'écran vers le haut. Un suivi vertical natif (deadzone Phaser, toujours
 * centrée) aurait aussi buté sur `setBounds` : une fois la caméra dézoomée, la hauteur d'une
 * zone (14-19 tuiles) est plus petite que la fenêtre visible, et Phaser centre alors toute la
 * zone dans l'écran (sol flottant au milieu) plutôt que de la caler en bas.
 */
export class CameraSystem {
  private target?: FollowTarget;
  private worldHeight = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  setupForZone(cols: number, rows: number, target: FollowTarget, zoom = GAMEPLAY_ZOOM): void {
    const cam = this.scene.cameras.main;
    cam.setZoom(zoom);
    this.target = target;
    this.worldHeight = rows * TILE_SIZE;

    // Bounds verticales volontairement surdimensionnées (marge d'une fenêtre pleine de chaque
    // côté) : le suivi vertical réel est géré à la main ci-dessous, sans quoi le clamp/centrage
    // automatique de Phaser reprendrait la main sur scrollY à chaque frame dès que la zone est
    // moins haute que la fenêtre dézoomée.
    const viewportWorldHeight = cam.height / zoom;
    cam.setBounds(0, -viewportWorldHeight, cols * TILE_SIZE, this.worldHeight + viewportWorldHeight * 2);
    // lerpY à 0 : Phaser ne touche plus scrollY, laissant update() ci-dessous seul maître du suivi vertical.
    cam.startFollow(target, true, 0.14, 0);
    cam.scrollY = this.restScrollY();
  }

  /** scrollY "au repos" : le bas de la zone (le sol) affleure le bas de l'écran. */
  private restScrollY(): number {
    const cam = this.scene.cameras.main;
    return this.worldHeight - cam.height / cam.zoom;
  }

  /** À appeler à chaque frame depuis la scène : suivi vertical asymétrique (cf. commentaire de classe). */
  update(): void {
    if (!this.target) return;
    const cam = this.scene.cameras.main;
    const viewHalfHeight = cam.height / cam.zoom / 2;
    const rest = this.restScrollY();
    const midWorldY = cam.scrollY + viewHalfHeight;
    // Au-delà de la moitié haute de l'écran, la caméra suit pour garder le joueur sur cette
    // ligne ; sinon elle se détend vers `rest` (jamais plus bas, pour garder le sol en bas d'écran).
    const desiredScrollY = this.target.y < midWorldY ? this.target.y - viewHalfHeight : rest;
    const clamped = Math.min(desiredScrollY, rest);
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, clamped, 0.14);
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
