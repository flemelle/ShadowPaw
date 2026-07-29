import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, SFX_KEYS, TEX, ANIM_KEYS, getNpcSkin } from '@/utils/Constants';
import { dialogSystem } from '@/systems/GameState';
import { audioManager } from '@/systems/AudioManager';
import { EventBus, GameEvents } from '@/utils/EventBus';
import { keyBindings } from '@/systems/KeyBindings';
import { GAMEPLAY_ZOOM } from '@/systems/CameraSystem';
import type { DialogChoice, DialogNode } from '@/systems/DialogSystem';

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
  private playerPortrait!: Phaser.GameObjects.Sprite;
  private npcPortrait!: Phaser.GameObjects.Sprite;
  private treeId!: string;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private selectedChoice = 0;
  private textScroll = 0;
  private maxTextScroll = 0;
  private currentChoices: DialogChoice[] = [];
  private npcDisplayName = '???';
  /** Non-null pendant le bref instant où la case affiche la réplique de Kiba qu'on vient de
   *  choisir (cf. confirmChoice) : le prochain appui confirme et enchaîne sur ce callback. */
  private afterOwnLine: (() => void) | null = null;

  constructor() {
    super(SCENE_KEYS.DIALOG);
  }

  create(data: DialogSceneData): void {
    this.treeId = data.treeId;
    const tree = dialogSystem.trees[this.treeId];
    this.npcDisplayName = tree?.displayName ?? '???';

    // Silhouettes en grand de part et d'autre de la case — Kiba à gauche, le PNJ à
    // droite — ajoutées avant le fond de la case pour rester visuellement "derrière" elle.
    // Une seule visible à la fois (cf. renderNode/showOwnLine) : celle qui parle réellement.
    // Kiba affiche son vrai sprite idle (cf. entities/Player) plutôt que l'ancienne silhouette
    // procédurale générique — cohérent avec le skin réel désormais affiché côté PNJ ci-dessous.
    this.playerPortrait = this.add
      .sprite(10, BOX_TOP + 40, TEX.PLAYER_IDLE)
      .setOrigin(0, 1)
      .setAlpha(0.92)
      .setScale(6)
      .play(ANIM_KEYS.PLAYER_IDLE);
    // PNJ dont le préfixe d'arbre de dialogue a un skin réel (cf. NPC_SKINS, même identifiant que
    // celui affiché dans le monde, cf. LevelLoader.markerTexFor) : sa skin apparaît ici agrandie,
    // au lieu de la silhouette générique de moine encapuchonné qui servait jusqu'ici pour tous les
    // PNJ sans distinction.
    const skin = getNpcSkin(this.treeId);
    if (skin) {
      // La silhouette générique (220x360, ancrée en bas de case) dépasse la case par le haut d'une
      // hauteur qui ne montre que sa capuche — proportionné pour ELLE. Une frame réelle (32x32) n'a
      // pas la même répartition verticale (le contenu utile est TOUTE la frame, pas juste un
      // sommet) : ancrée pareil, elle resterait presque entièrement cachée derrière la case et ne
      // laisserait dépasser que le sommet des oreilles. Ancrée plus haut à la place (juste sous le
      // bord haut de la case) pour que le skin reste presque entièrement visible au-dessus d'elle.
      // Taille affichée cohérente (~192px) quelle que soit la frame source : 6x pour les PNJ en
      // 32x32, moins pour une frame plus grande — sauf `scale` explicite (cf. NPC_SKINS), pour un
      // boss dont le portrait doit plutôt matcher sa propre taille de combat que ce standard. Dans
      // ce cas-là, le multiplicateur de GameScene (GAMEPLAY_ZOOM) doit aussi s'appliquer : `scale`
      // seul ne reproduit que la taille du sprite lui-même, pas son agrandissement à l'écran par la
      // caméra de jeu (zoomée), que cette scène (caméra à 1x) n'a pas — sans lui, un skin "matché"
      // sur sa taille de combat restait quand même visiblement plus petit ici qu'en jeu.
      this.npcPortrait = this.add
        .sprite(GAME_WIDTH - 10, BOX_TOP + 40, skin.texture)
        .setOrigin(1, 1)
        .setAlpha(0.92)
        .setScale(skin.scale ? skin.scale * GAMEPLAY_ZOOM : 192 / (skin.frameSize ?? 32))
        .play(skin.animKey);
    } else {
      this.npcPortrait = this.add.sprite(GAME_WIDTH - 10, BOX_BOTTOM, TEX.NPC_PORTRAIT).setOrigin(1, 1).setAlpha(0.92);
    }

    const boxBg = this.add.graphics();
    boxBg.fillStyle(0x0d0a16, 0.95);
    boxBg.fillRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, BOX_TOP, BOX_WIDTH, BOX_HEIGHT);
    boxBg.lineStyle(2, 0xd8b34a, 1);
    boxBg.strokeRect(GAME_WIDTH / 2 - BOX_WIDTH / 2, BOX_TOP, BOX_WIDTH, BOX_HEIGHT);

    this.nameText = this.add.text(TEXT_X, BOX_TOP + 18, this.npcDisplayName, {
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

    if (this.afterOwnLine) {
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) this.scrollText(SCROLL_STEP);
      else if (Phaser.Input.Keyboard.JustDown(this.keyUp)) this.scrollText(-SCROLL_STEP);
      else if (confirmPressed) {
        const advance = this.afterOwnLine;
        this.afterOwnLine = null;
        advance();
      }
      return;
    }

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
    const choice = this.currentChoices[index];
    // Les choix entre parenthèses ("(Partir)", "(Combat)") sont des indications de mise en
    // scène, pas une réplique de Kiba : on enchaîne directement sans le faire "parler" pour
    // une simple action. Une vraie réplique passe d'abord par showOwnLine (cf. plus bas).
    const isSpokenLine = choice != null && !choice.text.startsWith('(');
    const advance = () => this.renderNode(dialogSystem.choose(index));
    if (isSpokenLine) this.showOwnLine(choice.text, advance);
    else advance();
  }

  /** Bascule brièvement la case sur la réplique de Kiba qu'on vient de choisir, lui seul visible. */
  private showOwnLine(text: string, onDone: () => void): void {
    this.clearChoices();
    this.npcPortrait.setVisible(false);
    this.playerPortrait.setVisible(true);
    this.nameText.setText('Kiba');
    this.boxText.setText(text);
    this.textScroll = 0;
    this.boxText.setY(TEXT_VIEWPORT_TOP);
    this.maxTextScroll = Math.max(0, this.boxText.height - TEXT_VIEWPORT_HEIGHT);
    this.scrollHint.setVisible(this.maxTextScroll > 0);
    this.continueHint.setText('Espace/E ▸');
    this.continueHint.setPosition(GAME_WIDTH - 100, BOX_BOTTOM - 24);
    this.continueHint.setVisible(true);
    this.afterOwnLine = onDone;
  }

  private renderNode(node: DialogNode | null): void {
    this.clearChoices();
    this.nameText.setText(this.npcDisplayName);
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

    // Le PNJ est celui qui parle ici (ce sont ses lignes affichées), même quand des choix
    // apparaissent en dessous : ce sont les répliques POSSIBLES de Kiba, pas encore prononcées
    // — cf. showOwnLine, qui bascule sur son portrait seulement une fois qu'il en choisit une.
    this.npcPortrait.setVisible(true);
    this.playerPortrait.setVisible(false);

    const choiceCount = node.choices?.length ?? 0;
    this.currentChoices = node.choices ?? [];
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
