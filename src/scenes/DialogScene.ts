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
// Taille fixe, quel que soit le contenu — cf. retour : une case qui grandissait avec le texte
// finissait par cacher les silhouettes de part et d'autre. Le texte trop long pour la fenêtre
// se scrolle (molette ou ↑↓ hors choix) plutôt que d'agrandir la case.
const BOX_HEIGHT = 220;
const BOX_TOP = BOX_BOTTOM - BOX_HEIGHT;
const TEXT_X = 100;
const TEXT_WIDTH = BOX_WIDTH - 200;
const TEXT_VIEWPORT_TOP = BOX_TOP + 50;
const TEXT_VIEWPORT_HEIGHT = 92;
const CHOICES_TOP = TEXT_VIEWPORT_TOP + TEXT_VIEWPORT_HEIGHT + 14;
const CHOICE_LINE_H = 26;
const SCROLL_STEP = 24;

/**
 * Overlay de dialogue PNJ : texte + choix, pilotée par DialogSystem (arbre + flags).
 */
export class DialogScene extends Phaser.Scene {
  private boxText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private continueHint!: Phaser.GameObjects.Text;
  private scrollHint!: Phaser.GameObjects.Text;
  private playerPortrait!: Phaser.GameObjects.Image;
  private npcPortrait!: Phaser.GameObjects.Image;
  private treeId!: string;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private selectedChoice = 0;
  private textScroll = 0;
  private maxTextScroll = 0;

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

    const boxBg = this.add.graphics();
    boxBg.fillStyle(0x0d0a16, 0.95);
    boxBg.fillRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, BOX_TOP, BOX_WIDTH, BOX_HEIGHT);
    boxBg.lineStyle(2, 0xd8b34a, 1);
    boxBg.strokeRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, BOX_TOP, BOX_WIDTH, BOX_HEIGHT);

    this.nameText = this.add.text(TEXT_X, BOX_TOP + 18, tree?.displayName ?? '???', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b34a',
    });

    this.boxText = this.add.text(TEXT_X, TEXT_VIEWPORT_TOP, '', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e8e2f0',
      wordWrap: { width: TEXT_WIDTH },
      lineSpacing: 6,
    });

    // Fenêtre de texte fixe : au-delà de TEXT_VIEWPORT_HEIGHT, le texte est découpé par ce
    // masque plutôt que de déborder de la case — cf. scrollText()/le défilement molette/↑↓.
    const maskShape = this.make.graphics({ x: 0, y: 0 }).setVisible(false);
    maskShape.fillRect(TEXT_X, TEXT_VIEWPORT_TOP, TEXT_WIDTH, TEXT_VIEWPORT_HEIGHT);
    this.boxText.setMask(maskShape.createGeometryMask());

    // Positionné dans le coin haut-droit de la case plutôt qu'au ras du texte : une ligne
    // qui s'étend jusqu'au bord droit de la fenêtre le chevaucherait sinon visuellement.
    this.scrollHint = this.add
      .text(GAME_WIDTH / 2 + BOX_WIDTH / 2 - 16, BOX_TOP + 16, '▼ molette / ↑↓', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#d8b34a',
      })
      .setOrigin(1, 0)
      .setVisible(false);

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
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollText(dy > 0 ? SCROLL_STEP : -SCROLL_STEP));

    const node = dialogSystem.start(this.treeId);
    this.renderNode(node);
  }

  update(): void {
    const confirmPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) || keyBindings.justDown('interact') || keyBindings.justDown('jump');

    if (this.choiceTexts.length === 0) {
      // Pas de choix à naviguer : ↑↓ font défiler la réplique en cours à la place.
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) this.scrollText(SCROLL_STEP);
      else if (Phaser.Input.Keyboard.JustDown(this.keyUp)) this.scrollText(-SCROLL_STEP);
      else if (confirmPressed) this.advanceWithoutChoice();
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

  private scrollText(deltaY: number): void {
    if (this.maxTextScroll <= 0) return;
    this.textScroll = Phaser.Math.Clamp(this.textScroll + deltaY, 0, this.maxTextScroll);
    this.boxText.setY(TEXT_VIEWPORT_TOP - this.textScroll);
    this.scrollHint.setVisible(this.textScroll < this.maxTextScroll);
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
    this.textScroll = 0;
    this.boxText.setY(TEXT_VIEWPORT_TOP);
    this.maxTextScroll = Math.max(0, this.boxText.height - TEXT_VIEWPORT_HEIGHT);
    this.scrollHint.setVisible(this.maxTextScroll > 0);

    const choiceCount = node.choices?.length ?? 0;
    if (choiceCount > 0) {
      this.selectedChoice = 0;
      node.choices!.forEach((choice, i) => {
        const t = this.add
          .text(TEXT_X + 20, CHOICES_TOP + i * CHOICE_LINE_H, `▸ ${choice.text}`, {
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
      this.continueHint.setPosition(GAME_WIDTH - 100, BOX_BOTTOM - 18);
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
