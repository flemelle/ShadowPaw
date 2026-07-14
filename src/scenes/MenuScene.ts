import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, MUSIC_KEYS, SFX_KEYS } from '@/utils/Constants';
import { SaveSystem } from '@/systems/SaveSystem';
import { ParallaxBackground } from '@/systems/ParallaxBackground';
import { audioManager } from '@/systems/AudioManager';
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

/** Écran titre : Jouer / Continuer / Mode Admin (exploration libre des niveaux) / Crédits. */
export class MenuScene extends Phaser.Scene {
  private zoneListContainer?: Phaser.GameObjects.Container;
  private background?: ParallaxBackground;

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

    this.background = new ParallaxBackground(this, 'FOREST', GAME_WIDTH, false);
    audioManager.playMusic(this, MUSIC_KEYS.MENU);

    const titleBg = this.add.rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 300, 0x05040a, 0.35).setOrigin(0.5, 0).setDepth(-1);
    titleBg.setBlendMode(Phaser.BlendModes.NORMAL);

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
    let y = 320;
    this.makeButton(y, 'Nouvelle partie', () => {
      audioManager.play(this, SFX_KEYS.UI_CONFIRM);
      startNewGame();
      this.scene.start(SCENE_KEYS.GAME);
    });
    y += 64;

    if (hasSave) {
      this.makeButton(y, 'Continuer', () => {
        audioManager.play(this, SFX_KEYS.UI_CONFIRM);
        continueGame();
        this.scene.start(SCENE_KEYS.GAME);
      });
      y += 64;
    }

    this.makeButton(y, 'Mode Admin — explorer librement', () => {
      audioManager.play(this, SFX_KEYS.UI_SELECT);
      this.openZoneSelect();
    });
    y += 64;

    this.makeButton(y, 'Crédits', () => {
      audioManager.play(this, SFX_KEYS.UI_SELECT);
      this.showCredits();
    });

    this.buildMuteToggle();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Astuce : ajoutez ?admin=1 à l’URL pour lancer le Mode Admin directement.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8a7fa0',
      })
      .setOrigin(0.5);
  }

  private buildMuteToggle(): void {
    const label = () => (audioManager.isMuted() ? '🔇 Son coupé' : '🔊 Son actif');
    const btn = this.add
      .text(GAME_WIDTH - 24, 24, label(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7fa0',
        backgroundColor: '#00000080',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      audioManager.toggleMuted();
      btn.setText(label());
    });
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

    btn.on('pointerover', () => {
      btn.setColor(ACCENT);
      audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 });
    });
    btn.on('pointerout', () => btn.setColor(TEXT_COLOR));
    btn.on('pointerdown', onClick);
  }

  /** Mode Admin : sélection du chapitre/zone à explorer, tous pouvoirs débloqués, sans sauvegarde. */
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
      .text(GAME_WIDTH / 2, 90, 'Mode Admin — Choisir un chapitre', {
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

      label.on('pointerover', () => {
        label.setColor(ACCENT);
        audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 });
      });
      label.on('pointerout', () => label.setColor(TEXT_COLOR));
      label.on('pointerdown', () => {
        audioManager.play(this, SFX_KEYS.UI_CONFIRM);
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
      audioManager.play(this, SFX_KEYS.UI_CANCEL);
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
        'Shadowpaw\n\nUn projet Metroidvania 2D dark fantasy\nPhaser 3 · TypeScript · Vite\n\n' +
          'Musique : AlkaKrab — 10 Medieval Tracks\nSFX : 400 Sounds Pack\n' +
          'Décors : Free Pixel Art Forest (Eder Muniz) · Stringstar Fields\n' +
          '(voir ACKNOWLEDGEMENTS.md)\n\n(clic pour fermer)',
        { fontFamily: 'monospace', fontSize: '18px', color: TEXT_COLOR, align: 'center' },
      )
      .setOrigin(0.5);
    box.add([overlay, text]);
    overlay.setInteractive();
    overlay.on('pointerdown', () => {
      audioManager.play(this, SFX_KEYS.UI_CANCEL);
      box.destroy();
    });
  }
}
