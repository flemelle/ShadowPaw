import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SFX_KEYS } from '@/utils/Constants';
import { keyBindings, CONTROL_ACTIONS, ACTION_LABELS, type ControlAction } from '@/systems/KeyBindings';
import { audioManager } from '@/systems/AudioManager';
import { Button } from '@/utils/Button';

const ACCENT = '#d8b34a';
const TEXT_COLOR = '#e8e2f0';
const LISTENING_COLOR = '#4ae08a';

/**
 * Écran de remap des contrôles, utilisable en overlay depuis le menu principal
 * ou la pause en jeu (ne dépend pas d'une scène précise). Clic sur une touche
 * → capture le prochain appui clavier (Échap pour annuler) → sauvegarde.
 */
export function buildOptionsOverlay(scene: Phaser.Scene, onClose: () => void): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0a16, 0.94);
  container.add(overlay);

  const title = scene.add
    .text(GAME_WIDTH / 2, 64, 'Options — Contrôles', { fontFamily: 'monospace', fontSize: '28px', color: ACCENT })
    .setOrigin(0.5);
  container.add(title);

  const hint = scene.add
    .text(GAME_WIDTH / 2, 96, 'Clique sur une touche pour la remapper · Échap pour annuler', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8a7fa0',
    })
    .setOrigin(0.5);
  container.add(hint);

  let listening: ControlAction | null = null;
  const rowKeyTexts: Partial<Record<ControlAction, Phaser.GameObjects.Text>> = {};

  const startY = 150;
  const rowH = 54;

  CONTROL_ACTIONS.forEach((action, i) => {
    const y = startY + i * rowH;

    const label = scene.add
      .text(GAME_WIDTH / 2 - 240, y, ACTION_LABELS[action], { fontFamily: 'monospace', fontSize: '18px', color: TEXT_COLOR })
      .setOrigin(0, 0.5);
    container.add(label);

    const keyBtn = scene.add
      .text(GAME_WIDTH / 2 + 240, y, keyBindings.getKeyName(action), {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: ACCENT,
        backgroundColor: '#1a1428',
        padding: { x: 16, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    rowKeyTexts[action] = keyBtn;

    keyBtn.on('pointerover', () => {
      if (listening) return;
      keyBtn.setColor('#ffe9b0');
      audioManager.play(scene, SFX_KEYS.UI_HOVER, { volume: 0.25 });
    });
    keyBtn.on('pointerout', () => {
      if (listening !== action) keyBtn.setColor(ACCENT);
    });
    keyBtn.on('pointerdown', () => {
      if (listening) return;
      listening = action;
      keyBtn.setText('Appuyez sur une touche...');
      keyBtn.setColor(LISTENING_COLOR);
      audioManager.play(scene, SFX_KEYS.UI_SELECT);

      const handler = (event: KeyboardEvent) => {
        if (event.keyCode !== Phaser.Input.Keyboard.KeyCodes.ESC) {
          keyBindings.rebind(action, event.keyCode);
          audioManager.play(scene, SFX_KEYS.UI_CONFIRM);
        } else {
          audioManager.play(scene, SFX_KEYS.UI_CANCEL);
        }
        keyBtn.setText(keyBindings.getKeyName(action));
        keyBtn.setColor(ACCENT);
        listening = null;
      };
      scene.input.keyboard!.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, handler);
    });
    container.add(keyBtn);
  });

  const footerY = startY + CONTROL_ACTIONS.length * rowH + 36;

  const resetBtn = new Button(scene, GAME_WIDTH / 2 - 110, footerY, 'Réinitialiser', {
    onClick: () => {
      audioManager.play(scene, SFX_KEYS.UI_SELECT);
      keyBindings.resetDefaults();
      CONTROL_ACTIONS.forEach((a) => rowKeyTexts[a]?.setText(keyBindings.getKeyName(a)));
    },
    onHover: () => audioManager.play(scene, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
  });
  container.add(resetBtn.container);

  const closeBtn = new Button(scene, GAME_WIDTH / 2 + 110, footerY, 'Fermer', {
    onClick: () => {
      audioManager.play(scene, SFX_KEYS.UI_CANCEL);
      onClose();
    },
    onHover: () => audioManager.play(scene, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
  });
  container.add(closeBtn.container);

  return container;
}
