import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '@/utils/Constants';
import { SaveSystem } from '@/systems/SaveSystem';
import levelsData from '@/data/levels.json';
import {
  startNewGame,
  continueGame,
  startTestMode,
  isTestModeRequestedFromURL,
} from '@/systems/GameState';

const PANEL_BG = 0x0d0a16;
const ACCENT = '#d8b34a';
const TEXT_COLOR = '#e8e2f0';

/** Écran titre : Jouer / Continuer / Mode Test (exploration libre des niveaux) / Crédits. */
export class MenuScene extends Phaser.Scene {
  private zoneListContainer?: Phaser.GameObjects.Container;

  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05040a);

    if (isTestModeRequestedFromURL()) {
      startTestMode();
      this.scene.start(SCENE_KEYS.GAME);
      return;
    }

    this.add
      .text(GAME_WIDTH / 2, 140, 'SHADOWPAW', {
        fontFamily: 'Georgia, serif',
        fontSize: '72px',
        color: ACCENT,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#5a2e8a', 20, true, true);

    this.add
      .text(GAME_WIDTH / 2, 200, 'Un Metroidvania dark fantasy', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    const hasSave = SaveSystem.hasSave();
    let y = 300;
    this.makeButton(y, 'Nouvelle partie', () => {
      startNewGame();
      this.scene.start(SCENE_KEYS.GAME);
    });
    y += 64;

    if (hasSave) {
      this.makeButton(y, 'Continuer', () => {
        continueGame();
        this.scene.start(SCENE_KEYS.GAME);
      });
      y += 64;
    }

    this.makeButton(y, 'Mode Test — explorer librement', () => this.openZoneSelect());
    y += 64;

    this.makeButton(y, 'Crédits', () => this.showCredits());

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Astuce : ajoutez ?test=1 à l’URL pour lancer le Mode Test directement.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8a7fa0',
      })
      .setOrigin(0.5);
  }

  private makeButton(y: number, label: string, onClick: () => void): void {
    const btn = this.add
      .text(GAME_WIDTH / 2, y, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: TEXT_COLOR,
        backgroundColor: '#1a1428',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor(ACCENT));
    btn.on('pointerout', () => btn.setColor(TEXT_COLOR));
    btn.on('pointerdown', onClick);
  }

  /** Mode Test : sélection du chapitre/zone à explorer, tous pouvoirs débloqués, sans sauvegarde. */
  private openZoneSelect(): void {
    if (this.zoneListContainer) {
      this.zoneListContainer.destroy();
      this.zoneListContainer = undefined;
      return;
    }

    const container = this.add.container(0, 0);
    this.zoneListContainer = container;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PANEL_BG, 0.92);
    container.add(overlay);

    const title = this.add
      .text(GAME_WIDTH / 2, 90, 'Mode Test — Choisir un chapitre', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: ACCENT,
      })
      .setOrigin(0.5);
    container.add(title);

    const cols = 2;
    const startX = GAME_WIDTH / 2 - 300;
    const startY = 160;
    levelsData.zones.forEach((zone, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * 620;
      const y = startY + row * 90;

      const label = this.add
        .text(x, y, `${zone.chapterTitle}\n${zone.name}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: TEXT_COLOR,
          backgroundColor: '#1a1428',
          padding: { x: 14, y: 8 },
          align: 'left',
        })
        .setInteractive({ useHandCursor: true });

      label.on('pointerover', () => label.setColor(ACCENT));
      label.on('pointerout', () => label.setColor(TEXT_COLOR));
      label.on('pointerdown', () => {
        startTestMode(zone.id);
        this.scene.start(SCENE_KEYS.GAME);
      });
      container.add(label);
    });

    const closeBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Fermer', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#c56b6b',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      container.destroy();
      this.zoneListContainer = undefined;
    });
    container.add(closeBtn);
  }

  private showCredits(): void {
    const box = this.add.container(0, 0);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PANEL_BG, 0.95);
    const text = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        'Shadowpaw\n\nUn projet Metroidvania 2D dark fantasy\nPhaser 3 · TypeScript · Vite\n\n(clic pour fermer)',
        { fontFamily: 'monospace', fontSize: '20px', color: TEXT_COLOR, align: 'center' },
      )
      .setOrigin(0.5);
    box.add([overlay, text]);
    overlay.setInteractive();
    overlay.on('pointerdown', () => box.destroy());
  }
}
