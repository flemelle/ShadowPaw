import Phaser from 'phaser';
import {
  SCENE_KEYS,
  GAME_WIDTH,
  GAME_HEIGHT,
  ZONE_MUSIC,
  ZONE_BACKGROUND,
  ZONE_AMBIANCE,
  CORRUPTED_ZONES,
  SFX_KEYS,
  FOOTSTEP_VARIANTS,
  LIVES_START,
  FALL_DEATH_MARGIN,
  DARK_ZONES,
  TEX,
} from '@/utils/Constants';
import type { ZoneId } from '@/utils/Constants';
import { buildZone, getZoneMap, listZoneIds, type BuiltZone } from '@/systems/LevelLoader';
import { CameraSystem } from '@/systems/CameraSystem';
import { ParallaxBackground } from '@/systems/ParallaxBackground';
import { audioManager } from '@/systems/AudioManager';
import { Player } from '@/entities/Player';
import { NPC } from '@/entities/NPC';
import levelsData from '@/data/levels.json';
import type { ZoneEntity } from '@/utils/Types';
import type { ComboDef } from '@/systems/PowerSystem';
import { EventBus, GameEvents } from '@/utils/EventBus';
import { toggleFullscreen, isFullscreen } from '@/utils/Fullscreen';
import { ScrollableList } from '@/utils/ScrollableList';
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
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private background?: ParallaxBackground;
  private playerGlow?: Phaser.GameObjects.Image;
  private built!: BuiltZone;
  private npcs: NPC[] = [];
  private hud!: Phaser.GameObjects.Container;
  private powerIconTexts: Phaser.GameObjects.Text[] = [];
  private zoneLabel!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private powerTooltip!: Phaser.GameObjects.Text;
  private testBanner?: Phaser.GameObjects.Text;
  private debugZoneMenu?: Phaser.GameObjects.Container;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyN!: Phaser.Input.Keyboard.Key;
  private keyF1!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private pauseMenu?: Phaser.GameObjects.Container;
  private zoneList?: ScrollableList;
  private dialogActive = false;
  private puzzleActive = false;
  private defeatedThisZone = new Set<string>();
  private lives = LIVES_START;
  private isDead = false;
  private isTransitioning = false;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    this.dialogActive = false;
    this.puzzleActive = false;
    this.defeatedThisZone = new Set();
    this.lives = LIVES_START;
    this.isDead = false;
    this.isTransitioning = false;
    this.loadZone(gameState.currentZone);

    const kb = this.input.keyboard!;
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyN = kb.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.keyF1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    this.buildHUD();
    this.setupUICamera();

    EventBus.on(GameEvents.DIALOG_END, this.onDialogEnd, this);
    EventBus.on(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
    EventBus.on(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
    EventBus.on(GameEvents.COMBO_TRIGGERED, this.onComboTriggered, this);
    EventBus.on(GameEvents.SHARD_COLLECTED, this.onShardCollected, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DIALOG_END, this.onDialogEnd, this);
      EventBus.off(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
      EventBus.off(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
      EventBus.off(GameEvents.COMBO_TRIGGERED, this.onComboTriggered, this);
      EventBus.off(GameEvents.SHARD_COLLECTED, this.onShardCollected, this);
    });
  }

  private loadZone(zoneId: string): void {
    this.npcs.forEach((n) => n.destroy());
    this.npcs = [];

    if (this.built) {
      [
        this.built.solidGroup,
        this.built.breakableGroup,
        this.built.hiddenGroup,
        this.built.dashGateGroup,
        this.built.shadowWallGroup,
        this.built.lightObstacleGroup,
      ].forEach((group) => group.destroy(true));
      this.built.entityMarkers.forEach(({ sprite }) => sprite.destroy());
      this.built.decorSprites.forEach((img) => img.destroy());
    }

    const zoneMap = getZoneMap(zoneId);
    gameState.currentZone = zoneId;

    this.background?.destroy();
    const bgSet = ZONE_BACKGROUND[zoneId as keyof typeof ZONE_BACKGROUND];
    const ambiance = ZONE_AMBIANCE[zoneId as ZoneId];
    const isCorrupted = CORRUPTED_ZONES.includes(zoneId as ZoneId);
    this.background = new ParallaxBackground(this, bgSet, zoneMap.cols * 32, isCorrupted, ambiance);
    if (isCorrupted) {
      this.background.setPurificationLevel(puzzleSystem.getCollectedShards().length / 5);
    }

    this.built = buildZone(this, zoneMap, powerSystem);

    const musicKey = ZONE_MUSIC[zoneId as keyof typeof ZONE_MUSIC];
    if (musicKey) audioManager.playMusic(this, musicKey);

    if (this.player) this.player.destroy();
    this.player = new Player(this, this.built.spawn.x, this.built.spawn.y, powerSystem);
    this.player.setNoclip(powerSystem.isTestMode() && this.player.isNoclip());
    this.player.setFootstepSurface(zoneMap.act === 1 ? FOOTSTEP_VARIANTS.ACT_1 : FOOTSTEP_VARIANTS.ACT_2);

    this.playerGlow?.destroy();
    this.playerGlow = undefined;
    if (DARK_ZONES.includes(zoneId as ZoneId)) {
      this.playerGlow = this.add
        .image(this.player.x, this.player.y, TEX.PLAYER_GLOW)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-1)
        .setAlpha(0.55);
      this.tweens.add({
        targets: this.playerGlow,
        scale: { from: 0.95, to: 1.15 },
        alpha: { from: 0.42, to: 0.6 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }

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

    this.syncCameraIgnoreLists();
  }

  /**
   * Deux caméras : la principale (zoomée, suit le joueur) pour le monde, une seconde
   * fixe (zoom 1) pour le HUD — sans quoi le zoom gameplay déformerait aussi l'UI.
   */
  private setupUICamera(): void {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.cameras.main.ignore(this.hud);
    this.syncCameraIgnoreLists();
  }

  private syncCameraIgnoreLists(): void {
    if (!this.uiCamera || !this.built) return;
    const worldObjects: Phaser.GameObjects.GameObject[] = [
      ...this.built.solidGroup.getChildren(),
      ...this.built.breakableGroup.getChildren(),
      ...this.built.hiddenGroup.getChildren(),
      ...this.built.dashGateGroup.getChildren(),
      ...this.built.shadowWallGroup.getChildren(),
      ...this.built.lightObstacleGroup.getChildren(),
      ...this.built.entityMarkers.map((m) => m.sprite),
      ...this.built.decorSprites,
      this.player,
      this.promptText,
    ];
    if (this.playerGlow) worldObjects.push(this.playerGlow);
    this.npcs.forEach((npc) => worldObjects.push(npc.marker, npc.prompt));
    if (this.background) worldObjects.push(...this.background.getGameObjects());
    this.uiCamera.ignore(worldObjects);
  }

  update(time: number): void {
    if (this.dialogActive || this.puzzleActive || this.isDead || this.isTransitioning) return;

    if (this.player.y > this.built.heightPx + FALL_DEATH_MARGIN) {
      this.handleFallDeath();
      return;
    }

    this.player.update(time);
    this.playerGlow?.setPosition(this.player.x, this.player.y);

    if (powerSystem.isTestMode() && Phaser.Input.Keyboard.JustDown(this.keyN)) {
      this.player.setNoclip(!this.player.isNoclip());
      this.toast(this.player.isNoclip() ? 'Noclip activé' : 'Noclip désactivé');
    }
    if (powerSystem.isTestMode() && Phaser.Input.Keyboard.JustDown(this.keyF1)) {
      this.toggleDebugZoneMenu();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.debugZoneMenu) this.toggleDebugZoneMenu();
      else this.togglePauseMenu();
    }
    if (this.debugZoneMenu && this.zoneList) {
      if (this.keyUp.isDown) this.zoneList.scrollBy(-12);
      if (this.keyDown.isDown) this.zoneList.scrollBy(12);
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
    audioManager.play(this, SFX_KEYS.BOSS_DEFEATED);
    if (entity.grantsPower) {
      this.time.delayedCall(500, () => audioManager.play(this, SFX_KEYS.POWER_UNLOCK));
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
      audioManager.play(this, SFX_KEYS.PIVOT_ABSORB);
      this.time.delayedCall(700, () => audioManager.play(this, SFX_KEYS.PIVOT_STING));
      this.toast('Hikari no Ne absorbée... Malakar surgit et corrompt la Source. L\'Acte 2 commence.');
    } else {
      audioManager.play(this, SFX_KEYS.POWER_UNLOCK);
      this.toast('Énergie absorbée.');
    }
    sprite.setTint(0xffe27a);
    persistProgress(this.player.x, this.player.y);
  }

  private handleAutoTrigger(entity: ZoneEntity): void {
    if (this.isTransitioning) return;

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
      this.isTransitioning = true;
      const ending = dialogSystem.resolveEnding(puzzleSystem.getCollectedShards().length);
      this.scene.start(SCENE_KEYS.END, { ending });
    }
  }

  /**
   * Le joueur peut chevaucher le déclencheur de sortie pendant plusieurs frames (pas
   * un simple contact ponctuel) : sans ce verrou, chaque frame relançait un nouveau
   * fondu qui annulait le précédent, et la zone suivante ne se chargeait jamais.
   */
  private transitionToZone(targetZone: string): void {
    this.isTransitioning = true;
    audioManager.play(this, SFX_KEYS.ZONE_TRANSITION);
    persistProgress(this.player.x, this.player.y);
    this.cameraSystem.fadeOutIn(300, () => {
      this.loadZone(targetZone);
      this.isTransitioning = false;
    });
  }

  // ---------- Chute mortelle ----------

  /** Une chute hors des limites de la carte coûte une vie (sans effet en Mode Admin) et respawn au point d'entrée. */
  private handleFallDeath(): void {
    this.isDead = true;
    audioManager.play(this, SFX_KEYS.PUZZLE_FAIL);

    const isAdmin = powerSystem.isTestMode();
    if (!isAdmin) {
      this.lives -= 1;
      this.updateLivesDisplay();
    }

    if (!isAdmin && this.lives <= 0) {
      this.showGameOver();
      return;
    }

    this.toast('Chute mortelle... retour au point d\'entrée.');
    this.player.setVelocity(0, 0);
    this.player.setPosition(this.built.spawn.x, this.built.spawn.y);
    this.cameras.main.flash(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.isDead = false;
    });
  }

  private showGameOver(): void {
    audioManager.play(this, SFX_KEYS.ENDING_NEGATIVE, { volume: 0.5 });
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 0.92);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'Game Over', { fontFamily: 'Georgia, serif', fontSize: '48px', color: '#c56b6b' })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'Retour au menu...', { fontFamily: 'monospace', fontSize: '18px', color: '#8a7fa0' })
      .setOrigin(0.5);
    container.add([overlay, title, subtitle]);
    this.cameras.main.ignore(container);
    this.time.delayedCall(2200, () => this.scene.start(SCENE_KEYS.MENU));
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

  private onComboTriggered(combo: ComboDef): void {
    audioManager.play(this, SFX_KEYS.COMBO_TRIGGER);
    this.toast(`Combo : ${combo.name} !`);
  }

  private onShardCollected(): void {
    audioManager.play(this, SFX_KEYS.SHARD_COLLECT);
    if (this.background && CORRUPTED_ZONES.includes(gameState.currentZone as ZoneId)) {
      this.background.setPurificationLevel(puzzleSystem.getCollectedShards().length / 5);
    }
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

    this.livesText = this.add
      .text(GAME_WIDTH - 16, 12, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#c56b6b',
        backgroundColor: '#00000080',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0);
    this.hud.add(this.livesText);
    this.updateLivesDisplay();

    const powersLabel = this.add.text(16, 74, 'Pouvoirs (survoler pour le nom) :', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8a7fa0',
    });
    this.hud.add(powersLabel);

    this.powerTooltip = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 6, y: 3 },
      })
      .setVisible(false)
      .setDepth(1001);
    this.hud.add(this.powerTooltip);

    const controlHint = this.add.text(
      16,
      GAME_HEIGHT - 30,
      '←→: Bouger · ↑/W/Espace: Sauter · E: Interagir · Échap: Pause',
      { fontFamily: 'monospace', fontSize: '13px', color: '#8a7fa0', backgroundColor: '#00000080', padding: { x: 8, y: 4 } },
    );
    this.hud.add(controlHint);

    if (powerSystem.isTestMode()) {
      this.testBanner = this.add.text(
        16,
        44,
        'MODE ADMIN — F1: chapitres · N: noclip · ESC: menu',
        { fontFamily: 'monospace', fontSize: '13px', color: '#4ae08a', backgroundColor: '#00000080', padding: { x: 8, y: 4 } },
      );
      this.hud.add(this.testBanner);
    }
  }

  private updateLivesDisplay(): void {
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)) + '♡'.repeat(Math.max(0, LIVES_START - this.lives)));
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
        .text(16 + i * 36, 96, def?.icon ?? '?', { fontFamily: 'monospace', fontSize: '24px' })
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: false });
      t.on('pointerover', () => {
        this.powerTooltip.setText(def?.name ?? '');
        this.powerTooltip.setPosition(t.x, t.y + 30);
        this.powerTooltip.setVisible(true);
      });
      t.on('pointerout', () => this.powerTooltip.setVisible(false));
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
      audioManager.play(this, SFX_KEYS.PAUSE_CLOSE);
      this.pauseMenu.destroy();
      this.pauseMenu = undefined;
      return;
    }
    audioManager.play(this, SFX_KEYS.PAUSE_OPEN);
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
    const fullscreenBtn = this.add
      .text(GAME_WIDTH / 2, 380, isFullscreen(this) ? 'Quitter le plein écran' : '⛶ Plein écran', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e8e2f0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        toggleFullscreen(this);
        fullscreenBtn.setText(isFullscreen(this) ? 'Quitter le plein écran' : '⛶ Plein écran');
      });
    const quit = this.add
      .text(GAME_WIDTH / 2, 430, 'Quitter vers le menu', { fontFamily: 'monospace', fontSize: '20px', color: '#c56b6b' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!powerSystem.isTestMode()) persistProgress(this.player.x, this.player.y);
        this.scene.start(SCENE_KEYS.MENU);
      });
    container.add([overlay, title, resume, fullscreenBtn, quit]);
    this.cameras.main.ignore(container);
    this.pauseMenu = container;
  }

  private toggleDebugZoneMenu(): void {
    if (this.debugZoneMenu) {
      audioManager.play(this, SFX_KEYS.UI_CANCEL);
      this.zoneList?.destroy();
      this.zoneList = undefined;
      this.debugZoneMenu.destroy();
      this.debugZoneMenu = undefined;
      return;
    }
    audioManager.play(this, SFX_KEYS.UI_SELECT);
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, 360, GAME_WIDTH, 720, 0x0d0a16, 0.9);
    container.add(overlay);
    const title = this.add
      .text(GAME_WIDTH / 2, 70, 'Mode Admin — Sauter à un chapitre', { fontFamily: 'monospace', fontSize: '22px', color: '#d8b34a' })
      .setOrigin(0.5);
    container.add(title);

    const listWidth = 620;
    const listHeight = 500;
    const itemHeight = 58;
    const listX = GAME_WIDTH / 2 - listWidth / 2;
    const listY = 110;

    const items = listZoneIds().map((zoneId) => {
      const meta = levelsData.zones.find((z) => z.id === zoneId);
      return {
        label: meta ? `${meta.chapterTitle}\n${meta.name}` : zoneId,
        onHover: () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
        onClick: () => {
          audioManager.play(this, SFX_KEYS.UI_CONFIRM);
          startTestMode(zoneId);
          this.toggleDebugZoneMenu();
          this.loadZone(zoneId);
        },
      };
    });

    this.zoneList = new ScrollableList(this, {
      x: listX,
      y: listY,
      width: listWidth,
      height: listHeight,
      itemHeight,
      items,
    });
    container.add(this.zoneList.root);

    const hint = this.zoneList.isScrollable ? '↑↓ ou molette : défiler · Échap : fermer' : 'Échap : fermer';
    const hintText = this.add
      .text(GAME_WIDTH / 2, listY + listHeight + 20, hint, { fontFamily: 'monospace', fontSize: '13px', color: '#8a7fa0' })
      .setOrigin(0.5);
    container.add(hintText);

    this.cameras.main.ignore(container);
    this.debugZoneMenu = container;
  }
}
