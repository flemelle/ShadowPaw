import Phaser from 'phaser';
import { TILE_SIZE } from '@/utils/Constants';

/** Niveau de zoom par défaut en jeu — dézoomé pour laisser voir davantage de plateformes autour du joueur. */
export const GAMEPLAY_ZOOM = 1.4;

type FollowTarget = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

/**
 * Caméra principale : suit le joueur horizontalement en continu (via le follow natif de
 * Phaser), mais verticalement à la main dans `update()` — le sol reste ancré tout en bas de
 * l'écran tant que le joueur reste dans la moitié basse, la caméra ne remontant que s'il
 * dépasse la moitié de l'écran vers le haut.
 *
 * Important : `cam.scrollY` n'est PAS la coordonnée monde du haut de l'écran dès que le zoom
 * n'est pas 1. En interne, Phaser calcule `midY = scrollY + cam.height / 2` (avec la hauteur
 * NON zoomée) puis dérive la vue affichée à partir de ce point milieu et de la hauteur
 * RÉELLEMENT visible (`cam.height / zoom`) — cf. `Camera.preRender()` / `centerOnY()`. Confondre
 * les deux décale silencieusement toute la caméra de `(hauteur/2)·(1 − 1/zoom)` (≈103px ici) :
 * `scrollYForMidY()` ci-dessous fait la conversion correctement une bonne fois pour toutes.
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
    cam.scrollY = this.scrollYForMidY(this.restMidY());
  }

  /** Convertit un point milieu vertical (monde) voulu en `scrollY` — cf. commentaire de classe. */
  private scrollYForMidY(midY: number): number {
    return midY - this.scene.cameras.main.height / 2;
  }

  /** Point milieu vertical "au repos" : le bas de la zone (le sol) affleure le bas de l'écran. */
  private restMidY(): number {
    const cam = this.scene.cameras.main;
    const viewHalfHeight = cam.height / cam.zoom / 2;
    return this.worldHeight - viewHalfHeight;
  }

  /** À appeler à chaque frame depuis la scène : suivi vertical asymétrique (cf. commentaire de classe). */
  update(): void {
    if (!this.target) return;
    const cam = this.scene.cameras.main;
    // Le point de comparaison ne dépend que de la position du joueur, jamais du scrollY courant :
    // comparer au scrollY courant créait une boucle de rétroaction (le moindre saut faisait
    // osciller le joueur autour du seuil d'une frame à l'autre, chaque flip relançant la caméra
    // vers une cible différente — le "sautillement"). `Math.min` retombe naturellement sur le
    // repos tant que le joueur reste sous la moitié de l'écran, et suit sans à-coup au-delà.
    const desiredMidY = Math.min(this.restMidY(), this.target.y);
    const desired = this.scrollYForMidY(desiredMidY);
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
