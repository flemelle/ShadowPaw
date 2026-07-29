import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, MUSIC_KEYS, SFX_KEYS, ZONE_MUSIC, TEX, ANIM_KEYS, NPC_SKINS } from '@/utils/Constants';
import type { EndingCondition } from '@/systems/DialogSystem';
import { audioManager } from '@/systems/AudioManager';
import { gameState } from '@/systems/GameState';
import { Button } from '@/utils/Button';

interface EndingCutsceneData {
  ending: EndingCondition & { id: string };
}

interface CutsceneSlide {
  /** Couche de fond pleine (ciel/scène peinte) — doit toujours couvrir tout l'écran seule. */
  bgKey: string;
  /** Couche d'appoint optionnelle (silhouette avec zones transparentes) superposée à bgKey. */
  fgKey?: string;
  tint?: number;
  lines: string[];
  /** L'esprit de Ryo apparaît au centre (Fin A uniquement — cf. SLIDES_A). */
  showRyoSpirit?: boolean;
  /** Les créatures sauvées en cours de route (cf. gameState.rescuedCreatures) apparaissent une à
   * une — présent dans LES DEUX fins pour ne jamais les oublier, seul le ton du texte diffère
   * (retrouvailles pour la Fin A, simple mise à l'abri pour la Fin B). */
  showRescuedCats?: boolean;
}

const RYO_SKIN = NPC_SKINS.find((s) => s.prefix === 'ryo_spirit')!;

const SLIDES_A: CutsceneSlide[] = [
  {
    bgKey: 'bg_graveyard_01',
    tint: 0x4a3f7a,
    lines: [
      'Kiba refuse de détruire Malakar. Il puise dans la Lumière et l\'Ombre à la fois —',
      "la seule arme qu'aucun des deux camps n'avait jamais osé porter.",
    ],
  },
  {
    bgKey: 'bg_graveyard_01',
    tint: 0x8a7fc0,
    lines: [
      "La corruption se retire de lui comme une marée. Ce qui reste face à Kiba",
      "n'est plus un ennemi — juste un vieux chat, enfin las de porter l'Ombre seul.",
    ],
  },
  {
    bgKey: 'bg_stringstar_00',
    lines: [
      "Hikari no Ne, la lumière éternelle, revient emplir le Domaine de Velkhar.",
      "Le Clan de l'Ombre n'a plus de maître à servir, ni de rituel à achever.",
    ],
  },
  {
    bgKey: 'bg_stringstar_01',
    lines: ['Quelque part, un esprit longtemps retenu se sent enfin libre.', 'Ryo peut enfin partir.'],
    showRyoSpirit: true,
  },
  {
    bgKey: 'bg_forest_11',
    fgKey: 'bg_forest_09',
    lines: ["Kiba redescend de Seikūji seul... mais pas tout à fait."],
    showRescuedCats: true,
  },
];

const SLIDES_B: CutsceneSlide[] = [
  {
    bgKey: 'bg_graveyard_01',
    tint: 0x3a1018,
    lines: [
      'Sans la Lumière complète, la purification échoue.', "L'Ombre de Malakar ne recule pas — elle appelle."],
  },
  {
    bgKey: 'bg_graveyard_01',
    tint: 0x1a0810,
    lines: [
      'Kiba cède. Ce qui reste de lui se referme comme une porte.',
      "Le Clan a enfin l'héritier qu'il attendait.",
    ],
  },
  {
    bgKey: 'bg_forest_11',
    fgKey: 'bg_forest_09',
    tint: 0xb0a8c0,
    lines: [
      "Plus loin, loin du Domaine, les créatures qu'il a libérées ne sauront jamais",
      'ce qu\'il est devenu. Elles, au moins, sont enfin en sécurité.',
    ],
    showRescuedCats: true,
  },
];

/**
 * Cinématique jouée juste avant l'écran de résultats (cf. EndScene) — une par fin, dans le même
 * esprit que PrologueScene (fondu de décors + texte qui avance au clic/Espace) mais avec en plus
 * quelques sprites de mise en scène (esprit de Ryo, créatures sauvées) qu'un simple décor peint
 * ne peut pas montrer.
 */
export class EndingCutsceneScene extends Phaser.Scene {
  private slides: CutsceneSlide[] = [];
  private slideIndex = 0;
  private bgImage?: Phaser.GameObjects.Image;
  private fgImage?: Phaser.GameObjects.Image;
  private narrationText!: Phaser.GameObjects.Text;
  private continueHint!: Phaser.GameObjects.Text;
  private continueButton?: Button;
  private busy = false;
  private ending!: EndingCondition & { id: string };
  private extraSprites: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.ENDING_CUTSCENE);
  }

  create(data: EndingCutsceneData): void {
    this.ending = data.ending;
    const isEndingA = data.ending.id === 'ending_a_equilibre';
    this.slides = isEndingA ? SLIDES_A : SLIDES_B;
    this.slideIndex = 0;
    this.busy = false;
    this.bgImage = undefined;
    this.fgImage = undefined;
    this.extraSprites = [];

    audioManager.playMusic(this, isEndingA ? MUSIC_KEYS.ENDING_A : ZONE_MUSIC.zone5_seikuji_corrompu);
    this.time.delayedCall(400, () => {
      audioManager.play(this, isEndingA ? SFX_KEYS.ENDING_POSITIVE : SFX_KEYS.ENDING_NEGATIVE, { volume: 0.5 });
    });

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

    new Button(this, GAME_WIDTH - 90, 40, 'Passer', {
      fontSize: '14px',
      minWidth: 110,
      textColor: '#8a7fa0',
      onClick: () => this.finish(),
    });

    // Écouteurs d'événements plutôt qu'un `Key` sondé via `JustDown` en update() (cf. Prologue) :
    // juste après un `scene.start()` depuis GameScene, l'objet `Key` d'une touche déjà utilisée
    // ailleurs (Espace via Player.spaceKey) peut rester sourd aux appuis suivants pendant que les
    // événements `keydown-*`/`pointerdown`, eux, continuent d'arriver normalement.
    this.input.keyboard!.on('keydown-SPACE', () => this.advance());
    this.input.keyboard!.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', (_p: unknown, targets: unknown[]) => {
      if (targets.length > 0) return; // clic sur un bouton : laissé à son propre handler
      this.advance();
    });

    this.renderSlide();
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
    const slide = this.slides[this.slideIndex];
    this.busy = true;

    const nextBg = this.addCoverImage(slide.bgKey, -10, slide.tint);
    const nextFg = slide.fgKey ? this.addCoverImage(slide.fgKey, -9, slide.tint) : undefined;

    const oldBg = this.bgImage;
    const oldFg = this.fgImage;
    this.bgImage = nextBg;
    this.fgImage = nextFg;

    this.extraSprites.forEach((s) => s.destroy());
    this.extraSprites = [];

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

    if (slide.showRyoSpirit) this.renderRyoSpirit();
    if (slide.showRescuedCats) this.renderRescuedCats();

    const isLast = this.slideIndex === this.slides.length - 1;
    this.continueHint.setVisible(!isLast);
    if (isLast && !this.continueButton) {
      this.continueButton = new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Continuer ▸', {
        minWidth: 220,
        onClick: () => this.finish(),
      });
    }
  }

  private renderRyoSpirit(): void {
    const sprite = this.add
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, RYO_SKIN.texture)
      .setDepth(-8)
      .setAlpha(0)
      .setScale(3);
    sprite.play(RYO_SKIN.animKey);
    this.tweens.add({ targets: sprite, alpha: 0.92, y: sprite.y - 14, duration: 1600, ease: 'sine.inOut' });
    this.extraSprites.push(sprite);
  }

  /** Une créature sauvée par entrée dans `gameState.rescuedCreatures` — jamais un chiffre à zéro
   * mis en scène : si rien n'a été secouru, la ligne de narration seule suffit (cf. SLIDES_A/B). */
  private renderRescuedCats(): void {
    const count = gameState.rescuedCreatures.size;
    if (count === 0) return;
    const spacing = 70;
    const startX = GAME_WIDTH / 2 - ((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const targetX = startX + i * spacing;
      const fromLeft = i % 2 === 0;
      const sprite = this.add
        .sprite(fromLeft ? -80 : GAME_WIDTH + 80, GAME_HEIGHT - 190, TEX.RESCUE_CAT)
        .setDepth(-8)
        .setScale(2.6);
      sprite.play(ANIM_KEYS.RESCUE_CAT_IDLE);
      this.tweens.add({ targets: sprite, x: targetX, duration: 900, delay: 300 + i * 220, ease: 'cubic.out' });
      this.extraSprites.push(sprite);
    }
  }

  private advance(): void {
    if (this.busy) return;
    if (this.slideIndex >= this.slides.length - 1) {
      this.finish();
      return;
    }
    this.slideIndex += 1;
    this.renderSlide();
  }

  private finish(): void {
    this.scene.start(SCENE_KEYS.END, { ending: this.ending });
  }
}
