import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '@/utils/Constants';
import { dialogSystem } from '@/systems/GameState';
import { EventBus, GameEvents } from '@/utils/EventBus';
import type { DialogNode } from '@/systems/DialogSystem';

interface DialogSceneData {
  treeId: string;
}

/** Overlay de dialogue PNJ : texte + choix, pilotée par DialogSystem (arbre + flags). */
export class DialogScene extends Phaser.Scene {
  private boxText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private continueHint!: Phaser.GameObjects.Text;
  private treeId!: string;
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SCENE_KEYS.DIALOG);
  }

  create(data: DialogSceneData): void {
    this.treeId = data.treeId;
    const tree = dialogSystem.trees[this.treeId];

    const boxY = GAME_HEIGHT - 170;
    this.add.rectangle(GAME_WIDTH / 2, boxY, GAME_WIDTH - 80, 220, 0x0d0a16, 0.95).setStrokeStyle(2, 0xd8b34a);

    this.nameText = this.add.text(100, boxY - 90, tree?.displayName ?? '???', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b34a',
    });

    this.boxText = this.add.text(100, boxY - 55, '', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e8e2f0',
      wordWrap: { width: GAME_WIDTH - 200 },
      lineSpacing: 6,
    });

    this.continueHint = this.add
      .text(GAME_WIDTH - 100, boxY + 80, 'Espace ▸', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7fa0' })
      .setOrigin(1, 0.5);

    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const node = dialogSystem.start(this.treeId);
    this.renderNode(node);
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keySpace) && this.choiceTexts.length === 0) {
      this.advanceWithoutChoice();
    }
  }

  private advanceWithoutChoice(): void {
    // Pas de choix affiché : le nœud courant n'en propose qu'un implicite ou aucun -> on ferme.
    this.endDialog();
  }

  private renderNode(node: DialogNode | null): void {
    this.clearChoices();
    if (!node) {
      this.endDialog();
      return;
    }

    this.boxText.setText(node.lines.join('\n\n'));

    if (node.choices && node.choices.length > 0) {
      this.continueHint.setVisible(false);
      node.choices.forEach((choice, i) => {
        const t = this.add
          .text(120, GAME_HEIGHT - 90 + i * 26, `▸ ${choice.text}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#e8e2f0',
          })
          .setInteractive({ useHandCursor: true });
        t.on('pointerover', () => t.setColor('#d8b34a'));
        t.on('pointerout', () => t.setColor('#e8e2f0'));
        t.on('pointerdown', () => {
          const next = dialogSystem.choose(i);
          this.renderNode(next);
        });
        this.choiceTexts.push(t);
      });
    } else {
      this.continueHint.setVisible(true);
    }
  }

  private clearChoices(): void {
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];
  }

  private endDialog(): void {
    EventBus.emit(GameEvents.DIALOG_END, this.treeId);
  }
}
