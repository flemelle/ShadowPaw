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
    // Le point de comparaison (target.y - viewHalfHeight) ne dépend que de la position du
    // joueur, jamais du scrollY courant : comparer au scrollY courant (comme avant) créait une
    // boucle de rétroaction — le moindre saut faisait osciller le joueur autour du seuil d'une
    // frame à l'autre, chaque flip relançant la caméra vers une cible différente (le "sautillement").
    // `Math.min` retombe naturellement sur `rest` tant que le joueur reste sous la moitié de
    // l'écran, et suit sans à-coup au-delà — aucun branchement nécessaire.
    const desired = Math.min(this.restScrollY(), this.target.y - viewHalfHeight);
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, desired, 0.14);
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
