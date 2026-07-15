import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, SFX_KEYS } from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';
import { keyBindings } from '@/systems/KeyBindings';
import { EventBus, GameEvents } from '@/utils/EventBus';
import { Button } from '@/utils/Button';
import type { TutorialStep } from '@/systems/TutorialContent';

interface TutorialSceneData {
  steps: TutorialStep[];
}

const BOX_WIDTH = 780;
const BOX_MIN_HEIGHT = 200;
const BOX_MAX_HEIGHT = GAME_HEIGHT - 120;
const BOX_X = GAME_WIDTH / 2 - BOX_WIDTH / 2;
const TEXT_X = BOX_X + 130;
const TEXT_WIDTH = BOX_WIDTH - 170;
const HEADER_H = 70;
const FOOTER_H = 70;

/**
 * Petite popup pédagogique (contrôles de base au tout début d'une partie, puis un mini
 * tutoriel à chaque nouveau pouvoir acquis) — volontairement distincte visuellement de
 * DialogScene (boîte centrée plutôt qu'ancrée en bas) pour ne jamais se confondre avec
 * une réplique de PNJ. Toujours lancée par-dessus GameScene (scene.launch, jamais stop).
 * La hauteur s'ajuste au contenu (cf. DialogScene) : un pouvoir avec 3 lignes de texte
 * ne doit jamais déborder d'une boîte pensée pour l'intro, plus courte.
 */
export class TutorialScene extends Phaser.Scene {
  private steps: TutorialStep[] = [];
  private stepIndex = 0;
  private boxBg!: Phaser.GameObjects.Graphics;
  private iconText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private skipHint!: Phaser.GameObjects.Text;
  private nextButton!: Button;
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SCENE_KEYS.TUTORIAL);
  }

  create(data: TutorialSceneData): void {
    this.steps = data.steps;
    this.stepIndex = 0;

    const container = this.add.container(0, 0);

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 0.55);
    container.add(dim);

    this.boxBg = this.add.graphics();
    container.add(this.boxBg);

    this.iconText = this.add.text(BOX_X + 46, GAME_HEIGHT / 2, '', { fontSize: '64px' }).setOrigin(0.5);
    container.add(this.iconText);

    this.titleText = this.add.text(TEXT_X, 0, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#d8b34a',
    });
    container.add(this.titleText);

    this.bodyText = this.add.text(TEXT_X, 0, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#e8e2f0',
      wordWrap: { width: TEXT_WIDTH },
      lineSpacing: 8,
    });
    container.add(this.bodyText);

    this.counterText = this.add
      .text(BOX_X + BOX_WIDTH - 20, 0, '', { fontFamily: 'monospace', fontSize: '13px', color: '#8a7fa0' })
      .setOrigin(1, 0);
    container.add(this.counterText);

    this.skipHint = this.add
      .text(BOX_X + 20, 0, 'Échap : passer', { fontFamily: 'monospace', fontSize: '13px', color: '#8a7fa0' })
      .setOrigin(0, 0.5);
    container.add(this.skipHint);

    this.nextButton = new Button(this, BOX_X + BOX_WIDTH - 130, 0, '', {
      fontSize: '18px',
      minWidth: 210,
      onHover: () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
      onClick: () => this.advance(),
    });
    container.add(this.nextButton.container);

    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.finish());

    this.renderStep();
  }

  update(): void {
    const confirmPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) || keyBindings.justDown('interact') || keyBindings.justDown('jump');
    if (confirmPressed) this.advance();
  }

  private renderStep(): void {
    const step = this.steps[this.stepIndex];
    audioManager.play(this, SFX_KEYS.DIALOG_ADVANCE, { volume: 0.3 });

    this.bodyText.setText(step.lines.join('\n\n'));
    const textH = this.bodyText.height;
    const boxHeight = Phaser.Math.Clamp(HEADER_H + textH + FOOTER_H, BOX_MIN_HEIGHT, BOX_MAX_HEIGHT);
    const boxY = GAME_HEIGHT / 2 - boxHeight / 2;

    this.boxBg.clear();
    this.boxBg.fillStyle(0x0d0a16, 0.97);
    this.boxBg.fillRoundedRect(BOX_X, boxY, BOX_WIDTH, boxHeight, 14);
    this.boxBg.lineStyle(2, 0xd8b34a, 1);
    this.boxBg.strokeRoundedRect(BOX_X, boxY, BOX_WIDTH, boxHeight, 14);

    this.iconText.setText(step.icon).setPosition(BOX_X + 46, boxY + boxHeight / 2);
    this.titleText.setText(step.title).setPosition(TEXT_X, boxY + 28);
    this.bodyText.setPosition(TEXT_X, boxY + HEADER_H);
    this.counterText.setText(`${this.stepIndex + 1} / ${this.steps.length}`).setPosition(BOX_X + BOX_WIDTH - 20, boxY + 20);
    this.skipHint.setPosition(BOX_X + 20, boxY + boxHeight - 18);
    this.nextButton.setLabel(this.stepIndex === this.steps.length - 1 ? "C'est compris ✓" : 'Suivant ▸');
    this.nextButton.setPosition(BOX_X + BOX_WIDTH - 130, boxY + boxHeight - 34);
  }

  private advance(): void {
    audioManager.play(this, SFX_KEYS.UI_SELECT, { volume: 0.5 });
    if (this.stepIndex >= this.steps.length - 1) {
      this.finish();
      return;
    }
    this.stepIndex += 1;
    this.renderStep();
  }

  private finish(): void {
    EventBus.emit(GameEvents.TUTORIAL_END);
  }
}
