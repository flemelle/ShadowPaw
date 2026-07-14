import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, MUSIC_KEYS, SFX_KEYS } from '@/utils/Constants';
import { SaveSystem } from '@/systems/SaveSystem';
import { ParallaxBackground } from '@/systems/ParallaxBackground';
import { audioManager } from '@/systems/AudioManager';
import { toggleFullscreen, isFullscreen } from '@/utils/Fullscreen';
import { ScrollableList } from '@/utils/ScrollableList';
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
  private zoneList?: ScrollableList;
  private background?: ParallaxBackground;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private creditsBox?: Phaser.GameObjects.Container;

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
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

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

  update(): void {
    if (!this.keyEsc) return;
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.zoneListContainer) this.closeZoneSelect();
      else if (this.creditsBox) this.closeCredits();
    }
    if (this.zoneList) {
      if (this.keyUp.isDown) this.zoneList.scrollBy(-12);
      if (this.keyDown.isDown) this.zoneList.scrollBy(12);
    }
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

    const fsLabel = () => (isFullscreen(this) ? '🡼 Quitter plein écran' : '⛶ Plein écran');
    const fsBtn = this.add
      .text(GAME_WIDTH - 24, 52, fsLabel(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7fa0',
        backgroundColor: '#00000080',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    fsBtn.on('pointerdown', () => {
      toggleFullscreen(this);
      fsBtn.setText(fsLabel());
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
      this.closeZoneSelect();
      return;
    }

    const container = this.add.container(0, 0);
    this.zoneListContainer = container;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PANEL_BG, 0.92);
    container.add(overlay);

    const title = this.add
      .text(GAME_WIDTH / 2, 70, 'Mode Admin — Choisir un chapitre', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: ACCENT,
      })
      .setOrigin(0.5);
    container.add(title);

    const listWidth = 620;
    const listHeight = 480;
    const itemHeight = 58;
    const listX = GAME_WIDTH / 2 - listWidth / 2;
    const listY = 120;

    const items = levelsData.zones.map((zone) => ({
      label: `${zone.chapterTitle}\n${zone.name}`,
      onHover: () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
      onClick: () => {
        audioManager.play(this, SFX_KEYS.UI_CONFIRM);
        startTestMode(zone.id);
        this.scene.start(SCENE_KEYS.GAME);
      },
    }));

    this.zoneList = new ScrollableList(this, {
      x: listX,
      y: listY,
      width: listWidth,
      height: listHeight,
      itemHeight,
      items,
      textColor: TEXT_COLOR,
      hoverColor: ACCENT,
    });
    container.add(this.zoneList.root);

    const hint = this.zoneList.isScrollable
      ? '↑↓ ou molette : défiler · Échap : fermer'
      : 'Échap : fermer';
    const hintText = this.add
      .text(GAME_WIDTH / 2, listY + listHeight + 24, hint, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7fa0',
      })
      .setOrigin(0.5);
    container.add(hintText);

    const closeBtn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, 'Fermer', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#c56b6b',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeZoneSelect());
    container.add(closeBtn);
  }

  private closeZoneSelect(): void {
    audioManager.play(this, SFX_KEYS.UI_CANCEL);
    this.zoneList?.destroy();
    this.zoneList = undefined;
    this.zoneListContainer?.destroy();
    this.zoneListContainer = undefined;
  }

  private showCredits(): void {
    const box = this.add.container(0, 0);
    this.creditsBox = box;
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PANEL_BG, 0.95);
    const text = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 20,
        'Shadowpaw\n\nUn projet Metroidvania 2D dark fantasy\nPhaser 3 · TypeScript · Vite\n\n' +
          'Musique : AlkaKrab — 10 Medieval Tracks\nSFX : 400 Sounds Pack\n' +
          'Décors : Free Pixel Art Forest (Eder Muniz) · Stringstar Fields\n' +
          '(voir ACKNOWLEDGEMENTS.md)',
        { fontFamily: 'monospace', fontSize: '18px', color: TEXT_COLOR, align: 'center' },
      )
      .setOrigin(0.5);
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, 'Clic ou Échap : fermer', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7fa0',
      })
      .setOrigin(0.5);
    box.add([overlay, text, hint]);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.closeCredits());
  }

  private closeCredits(): void {
    audioManager.play(this, SFX_KEYS.UI_CANCEL);
    this.creditsBox?.destroy();
    this.creditsBox = undefined;
  }
}
