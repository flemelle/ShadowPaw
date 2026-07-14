import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '@/utils/Constants';
import { puzzleSystem, powerSystem } from '@/systems/GameState';
import { EventBus, GameEvents } from '@/utils/EventBus';
import type { PuzzleDef } from '@/systems/PuzzleSystem';

interface PuzzleSceneData {
  puzzleId: string;
}

const CELL = 56;

/**
 * Overlay des puzzles de l'Acte 2 (miroirs, équilibre, zones inversées, éclats).
 * Les combos (Lame Duale, Ancrage...) se déclenchent normalement en jeu en maintenant
 * deux pouvoirs actifs ; ici, un bouton "Simuler le combo" permet de tester la résolution
 * sans dépendre du timing exact des touches — pratique aussi en Mode Test.
 */
export class PuzzleScene extends Phaser.Scene {
  private def!: PuzzleDef;
  private rotations: Record<string, number> = {};
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SCENE_KEYS.PUZZLE);
  }

  create(data: PuzzleSceneData): void {
    const def = puzzleSystem.getDef(data.puzzleId);
    if (!def) {
      this.exit();
      return;
    }
    this.def = def;
    this.rotations = {};
    def.mirrors?.forEach((m) => (this.rotations[m.id] = m.rotation));

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0a16, 0.94);
    this.add
      .text(GAME_WIDTH / 2, 40, def.name, { fontFamily: 'monospace', fontSize: '26px', color: '#d8b34a' })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 74, def.description, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#c9c2d9',
        wordWrap: { width: GAME_WIDTH - 200 },
        align: 'center',
      })
      .setOrigin(0.5, 0);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, '', { fontFamily: 'monospace', fontSize: '16px', color: '#4ae08a' })
      .setOrigin(0.5);

    this.graphics = this.add.graphics();

    if (puzzleSystem.isSolved(def.id)) {
      this.statusText.setText('Déjà résolu.');
    }

    switch (def.type) {
      case 'mirror':
        this.setupMirrorPuzzle();
        break;
      case 'equilibrium':
        this.setupEquilibriumPuzzle();
        break;
      case 'inverted_zone':
        this.setupInvertedZonePuzzle();
        break;
      case 'shard_puzzle':
        this.setupShardPuzzle();
        break;
    }

    this.addCloseButton();

    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) this.exit();
  }

  // ---------- Mirror ----------

  private setupMirrorPuzzle(): void {
    if (!this.def.grid || !this.def.source || !this.def.receiver) return;
    const originX = GAME_WIDTH / 2 - (this.def.grid.cols * CELL) / 2;
    const originY = 130;

    const toScreen = (gx: number, gy: number) => ({ x: originX + gx * CELL + CELL / 2, y: originY + gy * CELL + CELL / 2 });

    // Grille
    this.graphics.lineStyle(1, 0x3a2f55, 0.6);
    for (let x = 0; x <= this.def.grid.cols; x++) {
      this.graphics.lineBetween(originX + x * CELL, originY, originX + x * CELL, originY + this.def.grid.rows * CELL);
    }
    for (let y = 0; y <= this.def.grid.rows; y++) {
      this.graphics.lineBetween(originX, originY + y * CELL, originX + this.def.grid.cols * CELL, originY + y * CELL);
    }

    const srcPos = toScreen(this.def.source.x, this.def.source.y);
    this.add.text(srcPos.x, srcPos.y, '✦', { fontSize: '28px', color: '#ffe27a' }).setOrigin(0.5);
    const recvPos = toScreen(this.def.receiver.x, this.def.receiver.y);
    this.add.text(recvPos.x, recvPos.y, '◎', { fontSize: '28px', color: '#4ae08a' }).setOrigin(0.5);

    this.def.mirrors?.forEach((m) => {
      const pos = toScreen(m.x, m.y);
      const label = this.add
        .text(pos.x, pos.y, this.mirrorGlyph(this.rotations[m.id]), { fontSize: '30px', color: '#d8b34a' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => {
        this.rotations[m.id] = ((this.rotations[m.id] + 90) % 360) as number;
        label.setText(this.mirrorGlyph(this.rotations[m.id]));
        this.redrawBeam();
      });
    });

    this.redrawBeam();
  }

  private mirrorGlyph(rotation: number): string {
    return rotation === 45 || rotation === 225 ? '/' : '\\';
  }

  private redrawBeam(): void {
    if (!this.def.grid || !this.def.source) return;
    const { path, solved } = puzzleSystem.traceMirrorBeam(this.def.id, this.rotations);
    const originX = GAME_WIDTH / 2 - (this.def.grid.cols * CELL) / 2;
    const originY = 130;
    const toScreen = (gx: number, gy: number) => ({ x: originX + gx * CELL + CELL / 2, y: originY + gy * CELL + CELL / 2 });

    this.graphics.lineStyle(3, solved ? 0x4ae08a : 0xffe27a, 0.9);
    path.forEach(([gx, gy], i) => {
      const p = toScreen(gx, gy);
      if (i === 0) this.graphics.moveTo(p.x, p.y);
      else this.graphics.lineTo(p.x, p.y);
    });
    this.graphics.strokePath();

    if (solved) {
      this.statusText.setText('Faisceau aligné — puzzle résolu !');
      this.time.delayedCall(900, () => this.exit());
    }
  }

  // ---------- Equilibrium ----------

  private setupEquilibriumPuzzle(): void {
    this.add
      .text(GAME_WIDTH / 2, 200, 'Maintenez Dash fantôme + Éclat de Lumière (combo Ancrage) pour figer la plateforme.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e8e2f0',
        wordWrap: { width: GAME_WIDTH - 300 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.addSimulateComboButton('ancrage', () => {
      const ok = puzzleSystem.solveEquilibrium(this.def.id, 'ancrage');
      this.statusText.setText(ok ? 'Plateforme figée — puzzle résolu !' : 'Combo requis non actif.');
      if (ok) this.time.delayedCall(900, () => this.exit());
    });
  }

  // ---------- Inverted zone ----------

  private setupInvertedZonePuzzle(): void {
    this.add
      .text(GAME_WIDTH / 2, 200, 'Ici, la lumière blesse et l\'ombre protège. Traverser avec Forme ombre active.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e8e2f0',
        wordWrap: { width: GAME_WIDTH - 300 },
        align: 'center',
      })
      .setOrigin(0.5);
    const btn = this.add
      .text(GAME_WIDTH / 2, 260, 'Traverser en Forme ombre', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e8e2f0',
        backgroundColor: '#1a1428',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      const ok = puzzleSystem.solveInvertedZone(this.def.id, powerSystem.has('forme_ombre'));
      this.statusText.setText(ok ? 'Traversée réussie — éclat révélé !' : 'Il te faut Forme ombre pour cela.');
      if (ok) this.time.delayedCall(900, () => this.exit());
    });
  }

  // ---------- Shard puzzle ----------

  private setupShardPuzzle(): void {
    const requiredCombo = this.def.requiresCombo;
    const requiredShards = this.def.requiresShardCount;
    const reqLine = requiredCombo
      ? `Combo requis : ${requiredCombo}`
      : requiredShards !== undefined
        ? `Éclats déjà collectés requis : ${requiredShards}`
        : '';
    this.add
      .text(GAME_WIDTH / 2, 200, reqLine, { fontFamily: 'monospace', fontSize: '16px', color: '#e8e2f0' })
      .setOrigin(0.5);

    if (requiredCombo) {
      this.addSimulateComboButton(requiredCombo, () => {
        const ok = puzzleSystem.solveShardPuzzle(this.def.id, { comboActive: requiredCombo });
        this.statusText.setText(ok ? 'Éclat révélé !' : 'Combo requis non actif.');
        if (ok) this.time.delayedCall(900, () => this.exit());
      });
    } else {
      const btn = this.add
        .text(GAME_WIDTH / 2, 260, 'Tenter', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#e8e2f0',
          backgroundColor: '#1a1428',
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        const ok = puzzleSystem.solveShardPuzzle(this.def.id, { shardCount: puzzleSystem.getCollectedShards().length });
        this.statusText.setText(ok ? 'Éclat révélé !' : 'Condition non remplie.');
        if (ok) this.time.delayedCall(900, () => this.exit());
      });
    }
  }

  private addSimulateComboButton(comboId: string, onSolved: () => void): void {
    const btn = this.add
      .text(GAME_WIDTH / 2, 260, `Simuler le combo (${comboId})`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e8e2f0',
        backgroundColor: '#1a1428',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onSolved);
  }

  private addCloseButton(): void {
    const btn = this.add
      .text(GAME_WIDTH - 40, 40, '✕', { fontFamily: 'monospace', fontSize: '22px', color: '#c56b6b' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.exit());
  }

  private exit(): void {
    EventBus.emit(GameEvents.PUZZLE_EXIT);
  }
}
