import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, MUSIC_KEYS } from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';
import { Button } from '@/utils/Button';

export const PROLOGUE_SEEN_KEY = 'shadowpaw_prologue_seen_v1';

interface Slide {
  /** Couche de fond pleine (ciel/scène peinte) — doit toujours couvrir tout l'écran seule. */
  bgKey: string;
  /** Couche d'appoint optionnelle (silhouette avec zones transparentes) superposée à bgKey. */
  fgKey?: string;
  tint?: number;
  lines: string[];
}

const SLIDES: Slide[] = [
  {
    bgKey: 'bg_graveyard_00',
    tint: 0xd8c9a0,
    lines: [
      "Il y a bien longtemps, une civilisation de chats aujourd'hui disparue bâtit un",
      'temple au sommet du monde connu, pour y abriter une lumière éternelle : Hikari no Ne.',
    ],
  },
  {
    bgKey: 'bg_graveyard_01',
    lines: [
      "Dans l'ombre du Domaine de Velkhar, un clan s'est levé — voué à un rituel",
      'interdit qui transforme ses sujets en ombres parfaites, vidées de tout le reste.',
    ],
  },
  {
    // bg_forest_11 = ciel plein (base) ; bg_forest_09 = ligne d'arbres avec zones
    // transparentes — seule, cette dernière rendrait un écran presque noir (cf.
    // ParallaxBackground, ces calques sont pensés pour être empilés, jamais seuls).
    bgKey: 'bg_forest_11',
    fgKey: 'bg_forest_09',
    lines: [
      'Kiba, jeune chat de ce même Clan, part sur les traces de son maître disparu, Ryo —',
      'sans savoir que son destin est déjà lié à la Source elle-même.',
    ],
  },
  {
    bgKey: 'bg_graveyard_00',
    tint: 0xcbb3e8,
    lines: [
      'Ce qu\'il découvrira au sommet de Seikūji changera à jamais l\'équilibre',
      "entre l'Ombre et la Lumière.",
    ],
  },
];

/**
 * Prologue narratif, montré une seule fois, au tout premier lancement du jeu (avant même
 * le menu — cf. BootScene.create(), gate sur PROLOGUE_SEEN_KEY en localStorage, indépendant
 * de la sauvegarde de progression). Uniquement du texte + des décors déjà chargés en fondu :
 * pas de personnage animé (hors périmètre, cf. message.txt).
 */
export class PrologueScene extends Phaser.Scene {
  private slideIndex = 0;
  private bgImage?: Phaser.GameObjects.Image;
  private fgImage?: Phaser.GameObjects.Image;
  private narrationText!: Phaser.GameObjects.Text;
  private continueHint!: Phaser.GameObjects.Text;
  private startButton?: Button;
  private busy = false;
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SCENE_KEYS.PROLOGUE);
  }

  create(): void {
    this.slideIndex = 0;
    audioManager.playMusic(this, MUSIC_KEYS.MENU);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 130, GAME_WIDTH, 260, 0x05040a, 0.75).setDepth(-4);

    this.narrationText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 130, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e8e2f0',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 240 },
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(-3);

    this.continueHint = this.add
      .text(GAME_WIDTH - 32, GAME_HEIGHT - 32, 'Espace / Clic ▸', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7fa0',
      })
      .setOrigin(1, 1);

    new Button(this, GAME_WIDTH - 90, 40, "Passer l'intro", {
      fontSize: '14px',
      minWidth: 130,
      textColor: '#8a7fa0',
      onClick: () => this.finish(),
    });

    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.finish());
    this.input.on('pointerdown', (_p: unknown, targets: unknown[]) => {
      if (targets.length > 0) return; // clic sur un bouton : laissé à son propre handler
      this.advance();
    });

    this.renderSlide();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) this.advance();
  }

  private addCoverImage(key: string, depth: number, tint?: number): Phaser.GameObjects.Image {
    const tex = this.textures.get(key);
    const srcW = tex.source[0]?.width ?? GAME_WIDTH;
    const srcH = tex.source[0]?.height ?? GAME_HEIGHT;
    const scale = Math.max(GAME_WIDTH / srcW, GAME_HEIGHT / srcH);
    const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setScale(scale).setDepth(depth).setAlpha(0);
    if (tint !== undefined) img.setTint(tint);
    return img;
  }

  private renderSlide(): void {
    const slide = SLIDES[this.slideIndex];
    this.busy = true;

    const nextBg = this.addCoverImage(slide.bgKey, -10, slide.tint);
    const nextFg = slide.fgKey ? this.addCoverImage(slide.fgKey, -9, slide.tint) : undefined;

    const oldBg = this.bgImage;
    const oldFg = this.fgImage;
    this.bgImage = nextBg;
    this.fgImage = nextFg;

    this.narrationText.setAlpha(0);
    this.narrationText.setText(slide.lines.join('\n'));

    this.tweens.add({ targets: nextFg ? [nextBg, nextFg] : nextBg, alpha: 1, duration: 900, ease: 'sine.inOut' });
    this.tweens.add({
      targets: this.narrationText,
      alpha: 1,
      duration: 900,
      delay: 200,
      ease: 'sine.inOut',
      onComplete: () => {
        this.busy = false;
      },
    });
    [oldBg, oldFg].forEach((old) => {
      if (old) this.tweens.add({ targets: old, alpha: 0, duration: 900, onComplete: () => old.destroy() });
    });

    const isLast = this.slideIndex === SLIDES.length - 1;
    this.continueHint.setVisible(!isLast);
    if (isLast && !this.startButton) {
      this.startButton = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, "Commencer l'aventure ▸", {
        minWidth: 260,
        onClick: () => this.finish(),
      });
    }
  }

  private advance(): void {
    if (this.busy) return;
    if (this.slideIndex >= SLIDES.length - 1) {
      this.finish();
      return;
    }
    this.slideIndex += 1;
    this.renderSlide();
  }

  private finish(): void {
    localStorage.setItem(PROLOGUE_SEEN_KEY, '1');
    this.scene.start(SCENE_KEYS.MENU);
  }
}
