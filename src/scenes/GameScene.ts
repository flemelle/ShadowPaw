import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH } from '@/utils/Constants';
import { buildZone, getZoneMap, listZoneIds, type BuiltZone } from '@/systems/LevelLoader';
import { CameraSystem } from '@/systems/CameraSystem';
import { Player } from '@/entities/Player';
import { NPC } from '@/entities/NPC';
import levelsData from '@/data/levels.json';
import type { ZoneEntity } from '@/utils/Types';
import { EventBus, GameEvents } from '@/utils/EventBus';
import {
  powerSystem,
  dialogSystem,
  puzzleSystem,
  gameState,
  persistProgress,
  startTestMode,
} from '@/systems/GameState';

const INTERACT_RANGE = 52;

/** Scène principale : charge une zone, gère la traversée liée aux pouvoirs, le HUD et les transitions. */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cameraSystem!: CameraSystem;
  private built!: BuiltZone;
  private npcs: NPC[] = [];
  private hud!: Phaser.GameObjects.Container;
  private powerIconTexts: Phaser.GameObjects.Text[] = [];
  private zoneLabel!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private testBanner?: Phaser.GameObjects.Text;
  private debugZoneMenu?: Phaser.GameObjects.Container;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyN!: Phaser.Input.Keyboard.Key;
  private keyF1!: Phaser.Input.Keyboard.Key;
  private pauseMenu?: Phaser.GameObjects.Container;
  private dialogActive = false;
  private puzzleActive = false;
  private defeatedThisZone = new Set<string>();

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    this.dialogActive = false;
    this.puzzleActive = false;
    this.defeatedThisZone = new Set();
    this.loadZone(gameState.currentZone);

    const kb = this.input.keyboard!;
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyN = kb.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.keyF1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1);

    this.buildHUD();

    EventBus.on(GameEvents.DIALOG_END, this.onDialogEnd, this);
    EventBus.on(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
    EventBus.on(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DIALOG_END, this.onDialogEnd, this);
      EventBus.off(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
      EventBus.off(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
    });
  }

  private loadZone(zoneId: string): void {
    this.npcs.forEach((n) => n.destroy());
    this.npcs = [];

    const zoneMap = getZoneMap(zoneId);
    gameState.currentZone = zoneId;
    this.built = buildZone(this, zoneMap, powerSystem);

    if (this.player) this.player.destroy();
    this.player = new Player(this, this.built.spawn.x, this.built.spawn.y, powerSystem);
    this.player.setNoclip(powerSystem.isTestMode() && this.player.isNoclip());

    this.cameraSystem = new CameraSystem(this);
    this.cameraSystem.setupForZone(zoneMap.cols, zoneMap.rows, this.player);

    [
      this.built.solidGroup,
      this.built.breakableGroup,
      this.built.hiddenGroup,
      this.built.dashGateGroup,
      this.built.shadowWallGroup,
      this.built.lightObstacleGroup,
    ].forEach((group) => this.physics.add.collider(this.player, group));

    this.built.entityMarkers.forEach(({ entity, sprite }) => {
      if (entity.type === 'npc') {
        this.npcs.push(new NPC(this, sprite, entity, powerSystem));
        return;
      }
      if (entity.type === 'zone_exit' || entity.type === 'ending_trigger') {
        this.physics.add.overlap(this.player, sprite, () => this.handleAutoTrigger(entity));
      }
    });

    if (this.zoneLabel) this.updateZoneLabel();
    if (this.testBanner) this.testBanner.setVisible(powerSystem.isTestMode());
  }

  update(time: number): void {
    if (this.dialogActive || this.puzzleActive) return;

    this.player.update(time);

    if (powerSystem.isTestMode() && Phaser.Input.Keyboard.JustDown(this.keyN)) {
      this.player.setNoclip(!this.player.isNoclip());
      this.toast(this.player.isNoclip() ? 'Noclip activé' : 'Noclip désactivé');
    }
    if (powerSystem.isTestMode() && Phaser.Input.Keyboard.JustDown(this.keyF1)) {
      this.toggleDebugZoneMenu();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.togglePauseMenu();
    }

    this.npcs.forEach((npc) => npc.update(this.player.x, this.player.y));

    this.updateInteractPrompt();
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.tryInteract();
    }

    this.updatePowerIcons();
  }

  // ---------- Interactions ----------

  private nearestInteractable(): { entity: ZoneEntity; sprite: Phaser.GameObjects.Sprite } | null {
    let best: { entity: ZoneEntity; sprite: Phaser.GameObjects.Sprite; dist: number } | null = null;
    for (const marker of this.built.entityMarkers) {
      if (marker.entity.type === 'npc') continue;
      if (marker.entity.type === 'zone_exit' || marker.entity.type === 'ending_trigger') continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.sprite.x, marker.sprite.y);
      if (dist <= INTERACT_RANGE && (!best || dist < best.dist)) {
        best = { ...marker, dist };
      }
    }
    return best;
  }

  private nearestNPC(): NPC | null {
    return this.npcs.find((n) => n.isInRange(this.player.x, this.player.y)) ?? null;
  }

  private updateInteractPrompt(): void {
    const npc = this.nearestNPC();
    const other = this.nearestInteractable();
    if (npc || other) {
      this.promptText.setVisible(true);
      this.promptText.setPosition(this.player.x, this.player.y - 46);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private tryInteract(): void {
    const npc = this.nearestNPC();
    if (npc) {
      this.startDialog(npc.data.dialogTree);
      return;
    }
    const target = this.nearestInteractable();
    if (!target) return;

    switch (target.entity.type) {
      case 'boss_arena':
        this.handleBossArena(target.entity, target.sprite);
        break;
      case 'puzzle_trigger':
        this.startPuzzle(target.entity.puzzleId);
        break;
      case 'power_altar':
        this.handlePowerAltar(target.entity, target.sprite);
        break;
      default:
        break;
    }
  }

  private handleBossArena(entity: Extract<ZoneEntity, { type: 'boss_arena' }>, sprite: Phaser.GameObjects.Sprite): void {
    const defeated = gameState.defeatedBosses.has(entity.bossId) || this.defeatedThisZone.has(entity.bossId);
    if (defeated) {
      this.toast('Cette arène est déjà vidée de son gardien.');
      return;
    }
    if (entity.requiresCombo && !powerSystem.isTestMode()) {
      this.toast(`Combo requis pour affronter ce gardien : ${entity.requiresCombo}`);
      return;
    }
    // Le combat n'est pas implémenté ici (hors scope) : la victoire est actée directement.
    gameState.defeatedBosses.add(entity.bossId);
    this.defeatedThisZone.add(entity.bossId);
    sprite.setTint(0x555555);
    if (entity.grantsPower) {
      powerSystem.unlock(entity.grantsPower);
      this.toast(`Gardien vaincu — Pouvoir obtenu : ${powerSystem.getDef(entity.grantsPower)?.name}`);
    } else {
      this.toast('Gardien vaincu.');
    }
    persistProgress(this.player.x, this.player.y);
  }

  private handlePowerAltar(entity: Extract<ZoneEntity, { type: 'power_altar' }>, sprite: Phaser.GameObjects.Sprite): void {
    if (entity.requiresPower && !powerSystem.has(entity.requiresPower)) {
      this.toast('Il te manque un pouvoir pour approcher cet autel.');
      return;
    }
    if (entity.grantsPower) powerSystem.unlock(entity.grantsPower);
    if (entity.pivotEvent) {
      this.toast('Hikari no Ne absorbée... Malakar surgit et corrompt la Source. L\'Acte 2 commence.');
    } else {
      this.toast('Énergie absorbée.');
    }
    sprite.setTint(0xffe27a);
    persistProgress(this.player.x, this.player.y);
  }

  private handleAutoTrigger(entity: ZoneEntity): void {
    if (entity.type === 'zone_exit') {
      const bossOk =
        !entity.requiresBossDefeated ||
        powerSystem.isTestMode() ||
        gameState.defeatedBosses.has(entity.requiresBossDefeated) ||
        this.defeatedThisZone.has(entity.requiresBossDefeated);
      const altarOk = !entity.requiresAltar || powerSystem.isTestMode() || powerSystem.has('eclat_lumiere');
      if (!bossOk) {
        this.toast('Le passage reste bloqué — le gardien de cette zone est toujours debout.');
        return;
      }
      if (!altarOk) {
        this.toast("Il reste quelque chose à faire ici avant de partir.");
        return;
      }
      this.transitionToZone(entity.targetZone);
    } else if (entity.type === 'ending_trigger') {
      const bossOk = !entity.requiresBossDefeated || powerSystem.isTestMode() || gameState.defeatedBosses.has(entity.requiresBossDefeated) || this.defeatedThisZone.has(entity.requiresBossDefeated);
      if (!bossOk) {
        this.toast('Malakar attend encore d\'être affronté.');
        return;
      }
      const ending = dialogSystem.resolveEnding(puzzleSystem.getCollectedShards().length);
      this.scene.start(SCENE_KEYS.END, { ending });
    }
  }

  private transitionToZone(targetZone: string): void {
    persistProgress(this.player.x, this.player.y);
    this.cameraSystem.fadeOutIn(300, () => this.loadZone(targetZone));
  }

  // ---------- Dialogue ----------

  private startDialog(treeId: string): void {
    this.dialogActive = true;
    this.player.setVelocity(0, 0);
    this.scene.launch(SCENE_KEYS.DIALOG, { treeId });
  }

  private onDialogEnd(): void {
    this.dialogActive = false;
    this.scene.stop(SCENE_KEYS.DIALOG);
  }

  // ---------- Puzzle ----------

  private startPuzzle(puzzleId: string): void {
    this.puzzleActive = true;
    this.player.setVelocity(0, 0);
    this.scene.launch(SCENE_KEYS.PUZZLE, { puzzleId });
  }

  private onPuzzleSolved(): void {
    persistProgress(this.player.x, this.player.y);
  }

  private onPuzzleExit(): void {
    this.puzzleActive = false;
    this.scene.stop(SCENE_KEYS.PUZZLE);
  }

  // ---------- HUD ----------

  private buildHUD(): void {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    this.zoneLabel = this.add.text(16, 12, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#e8e2f0',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 4 },
    });
    this.hud.add(this.zoneLabel);
    this.updateZoneLabel();

    this.toastText = this.add
      .text(GAME_WIDTH / 2, 60, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffe27a',
        backgroundColor: '#000000aa',
        padding: { x: 10, y: 6 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.hud.add(this.toastText);

    this.promptText = this.add
      .text(0, 0, 'Appuyer sur E', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setVisible(false);

    if (powerSystem.isTestMode()) {
      this.testBanner = this.add.text(
        16,
        44,
        'MODE TEST — F1: chapitres · N: noclip · ESC: menu',
        { fontFamily: 'monospace', fontSize: '13px', color: '#4ae08a', backgroundColor: '#00000080', padding: { x: 8, y: 4 } },
      );
      this.hud.add(this.testBanner);
    }
  }

  private updateZoneLabel(): void {
    const zoneMeta = levelsData.zones.find((z) => z.id === gameState.currentZone);
    this.zoneLabel.setText(zoneMeta ? `${zoneMeta.chapterTitle} — ${zoneMeta.name}` : gameState.currentZone);
  }

  private updatePowerIcons(): void {
    const unlocked = powerSystem.getUnlocked();
    if (this.powerIconTexts.length === unlocked.length) return;
    this.powerIconTexts.forEach((t) => t.destroy());
    this.powerIconTexts = unlocked.map((id, i) => {
      const def = powerSystem.getDef(id);
      const t = this.add
        .text(16 + i * 36, 76, def?.icon ?? '?', { fontFamily: 'monospace', fontSize: '24px' })
        .setScrollFactor(0);
      this.hud.add(t);
      return t;
    });
  }

  private toast(message: string): void {
    this.toastText.setText(message);
    this.toastText.setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2200, duration: 500 });
  }

  // ---------- Pause / debug menus ----------

  private togglePauseMenu(): void {
    if (this.pauseMenu) {
      this.pauseMenu.destroy();
      this.pauseMenu = undefined;
      return;
    }
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, 360, GAME_WIDTH, 720, 0x0d0a16, 0.85);
    const title = this.add.text(GAME_WIDTH / 2, 260, 'Pause', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#d8b34a',
    }).setOrigin(0.5);
    const resume = this.add
      .text(GAME_WIDTH / 2, 330, 'Reprendre (ESC)', { fontFamily: 'monospace', fontSize: '20px', color: '#e8e2f0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePauseMenu());
    const quit = this.add
      .text(GAME_WIDTH / 2, 380, 'Quitter vers le menu', { fontFamily: 'monospace', fontSize: '20px', color: '#c56b6b' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!powerSystem.isTestMode()) persistProgress(this.player.x, this.player.y);
        this.scene.start(SCENE_KEYS.MENU);
      });
    container.add([overlay, title, resume, quit]);
    this.pauseMenu = container;
  }

  private toggleDebugZoneMenu(): void {
    if (this.debugZoneMenu) {
      this.debugZoneMenu.destroy();
      this.debugZoneMenu = undefined;
      return;
    }
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, 360, GAME_WIDTH, 720, 0x0d0a16, 0.9);
    container.add(overlay);
    const title = this.add
      .text(GAME_WIDTH / 2, 100, 'Mode Test — Sauter à un chapitre', { fontFamily: 'monospace', fontSize: '24px', color: '#d8b34a' })
      .setOrigin(0.5);
    container.add(title);

    listZoneIds().forEach((zoneId, i) => {
      const meta = levelsData.zones.find((z) => z.id === zoneId);
      const label = this.add
        .text(GAME_WIDTH / 2, 150 + i * 48, meta ? `${meta.chapterTitle} — ${meta.name}` : zoneId, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#e8e2f0',
          backgroundColor: '#1a1428',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      label.on('pointerover', () => label.setColor('#d8b34a'));
      label.on('pointerout', () => label.setColor('#e8e2f0'));
      label.on('pointerdown', () => {
        startTestMode(zoneId);
        container.destroy();
        this.debugZoneMenu = undefined;
        this.loadZone(zoneId);
      });
      container.add(label);
    });
    this.debugZoneMenu = container;
  }
}
