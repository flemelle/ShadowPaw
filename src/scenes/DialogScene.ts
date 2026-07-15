import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, SFX_KEYS, TEX } from '@/utils/Constants';
import { dialogSystem } from '@/systems/GameState';
import { audioManager } from '@/systems/AudioManager';
import { EventBus, GameEvents } from '@/utils/EventBus';
import { keyBindings } from '@/systems/KeyBindings';
import type { DialogNode } from '@/systems/DialogSystem';

interface DialogSceneData {
  treeId: string;
}

const BOX_WIDTH = GAME_WIDTH - 80;
const BOX_BOTTOM = GAME_HEIGHT - 40;
const BOX_MIN_HEIGHT = 170;
const BOX_MAX_HEIGHT = GAME_HEIGHT - 160;
const TEXT_X = 100;
const TEXT_WIDTH = BOX_WIDTH - 200;
const CHOICE_LINE_H = 30;

/**
 * Overlay de dialogue PNJ : texte + choix, pilotée par DialogSystem (arbre + flags).
 * La case grandit vers le haut selon la longueur du texte/nombre de choix (plutôt qu'une
 * hauteur fixe) pour ne jamais laisser le contenu déborder de son cadre.
 */
export class DialogScene extends Phaser.Scene {
  private boxBg!: Phaser.GameObjects.Graphics;
  private boxText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private continueHint!: Phaser.GameObjects.Text;
  private playerPortrait!: Phaser.GameObjects.Image;
  private npcPortrait!: Phaser.GameObjects.Image;
  private treeId!: string;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private selectedChoice = 0;

  constructor() {
    super(SCENE_KEYS.DIALOG);
  }

  create(data: DialogSceneData): void {
    this.treeId = data.treeId;
    const tree = dialogSystem.trees[this.treeId];

    // Silhouettes en grand de part et d'autre de la case — Kiba à gauche, le PNJ à
    // droite — ajoutées avant le fond de la case pour rester visuellement "derrière" elle.
    this.playerPortrait = this.add.image(10, BOX_BOTTOM, TEX.PLAYER_PORTRAIT).setOrigin(0, 1).setAlpha(0.92);
    this.npcPortrait = this.add.image(GAME_WIDTH - 10, BOX_BOTTOM, TEX.NPC_PORTRAIT).setOrigin(1, 1).setAlpha(0.92);

    this.boxBg = this.add.graphics();

    this.nameText = this.add.text(TEXT_X, 0, tree?.displayName ?? '???', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b34a',
    });

    this.boxText = this.add.text(TEXT_X, 0, '', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e8e2f0',
      wordWrap: { width: TEXT_WIDTH },
      lineSpacing: 6,
    });

    this.continueHint = this.add
      .text(GAME_WIDTH - 100, 0, 'Espace ▸', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7fa0' })
      .setOrigin(1, 0.5);

    // DialogScene est toujours lancée par-dessus GameScene (scene.launch, jamais stop), dont
    // les touches keyBindings restent donc actives et à jour : pas besoin (et surtout pas
    // question) de rappeler keyBindings.attach ici, ça réassignerait le singleton partagé à
    // cette scène et casserait sa lecture par GameScene une fois le dialogue refermé.
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    const node = dialogSystem.start(this.treeId);
    this.renderNode(node);
  }

  update(): void {
    const confirmPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) || keyBindings.justDown('interact') || keyBindings.justDown('jump');

    if (this.choiceTexts.length === 0) {
      if (confirmPressed) this.advanceWithoutChoice();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.setSelectedChoice((this.selectedChoice + 1) % this.choiceTexts.length);
    } else if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.setSelectedChoice((this.selectedChoice - 1 + this.choiceTexts.length) % this.choiceTexts.length);
    } else if (confirmPressed) {
      this.confirmChoice(this.selectedChoice);
    }
  }

  private advanceWithoutChoice(): void {
    // Pas de choix affiché : le nœud courant n'en propose qu'un implicite ou aucun -> on ferme.
    this.endDialog();
  }

  private setSelectedChoice(index: number): void {
    this.selectedChoice = index;
    this.choiceTexts.forEach((t, i) => t.setColor(i === index ? '#d8b34a' : '#e8e2f0'));
    audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 });
  }

  private confirmChoice(index: number): void {
    audioManager.play(this, SFX_KEYS.UI_SELECT);
    const next = dialogSystem.choose(index);
    this.renderNode(next);
  }

  private renderNode(node: DialogNode | null): void {
    this.clearChoices();
    if (!node) {
      this.endDialog();
      return;
    }

    audioManager.play(this, SFX_KEYS.DIALOG_ADVANCE, { volume: 0.4 });
    this.boxText.setText(node.lines.join('\n\n'));

    const choiceCount = node.choices?.length ?? 0;
    // Hauteur nécessaire : header (nom) + texte + choix éventuels + marges — jamais moins
    // que BOX_MIN_HEIGHT, jamais plus que BOX_MAX_HEIGHT (au-delà, on tronquerait plutôt
    // que de recouvrir le HUD ; la longueur des dialogues.json reste bien en-deçà en pratique).
    const headerH = 46;
    const textH = this.boxText.height;
    const choicesH = choiceCount > 0 ? choiceCount * CHOICE_LINE_H + 30 : 30;
    const contentH = headerH + textH + choicesH + 32;
    const boxHeight = Phaser.Math.Clamp(contentH, BOX_MIN_HEIGHT, BOX_MAX_HEIGHT);
    const boxTop = BOX_BOTTOM - boxHeight;

    this.boxBg.clear();
    this.boxBg.fillStyle(0x0d0a16, 0.95);
    this.boxBg.fillRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, boxTop, BOX_WIDTH, boxHeight);
    this.boxBg.lineStyle(2, 0xd8b34a, 1);
    this.boxBg.strokeRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, boxTop, BOX_WIDTH, boxHeight);

    this.nameText.setPosition(TEXT_X, boxTop + 18);
    this.boxText.setPosition(TEXT_X, boxTop + 18 + headerH);

    if (choiceCount > 0) {
      this.selectedChoice = 0;
      const choicesTop = this.boxText.y + textH + 16;
      node.choices!.forEach((choice, i) => {
        const t = this.add
          .text(TEXT_X + 20, choicesTop + i * CHOICE_LINE_H, `▸ ${choice.text}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: i === 0 ? '#d8b34a' : '#e8e2f0',
          })
          .setInteractive({ useHandCursor: true });
        t.on('pointerover', () => this.setSelectedChoice(i));
        t.on('pointerout', () => t.setColor(i === this.selectedChoice ? '#d8b34a' : '#e8e2f0'));
        t.on('pointerdown', () => this.confirmChoice(i));
        this.choiceTexts.push(t);
      });
      this.continueHint.setText('↑↓ choisir · Espace/E valider');
      this.continueHint.setPosition(GAME_WIDTH - 100, boxTop + boxHeight - 18);
      this.continueHint.setVisible(true);
    } else {
      this.continueHint.setText('Espace/E ▸');
      this.continueHint.setPosition(GAME_WIDTH - 100, BOX_BOTTOM - 24);
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
