import Phaser from 'phaser';

/** Bascule le plein écran via la Fullscreen API du navigateur (nécessite un geste utilisateur). */
export function toggleFullscreen(scene: Phaser.Scene): void {
  if (!scene.scale.fullscreen.available) return;
  scene.scale.toggleFullscreen();
}

export function isFullscreen(scene: Phaser.Scene): boolean {
  return scene.scale.isFullscreen;
}
