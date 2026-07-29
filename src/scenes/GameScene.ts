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
  MUSIC_KEYS,
  ZONE_IDS,
  BOSS_DEFS,
  TILE_SIZE,
  MOB_TEX_BY_BG,
  ANIM_KEYS,
  getCatDecorVariant,
  getNpcSkin,
  POWER_ICON_TEX,
  EPILOGUE_ZONE_ID,
} from '@/utils/Constants';
import type { ZoneId, PowerId } from '@/utils/Constants';
import { buildZone, getZoneMap, listZoneIds, type BuiltZone } from '@/systems/LevelLoader';
import { generateZoneLive } from '@/systems/ZoneGenerator';
import { CameraSystem, GAMEPLAY_ZOOM } from '@/systems/CameraSystem';
import { ParallaxBackground } from '@/systems/ParallaxBackground';
import { audioManager } from '@/systems/AudioManager';
import { Player } from '@/entities/Player';
import { NPC } from '@/entities/NPC';
import { Enemy, mobHp, mobSpeed } from '@/entities/Enemy';
import levelsData from '@/data/levels.json';
import type { ZoneEntity, ZoneMap } from '@/utils/Types';
import type { ComboDef } from '@/systems/PowerSystem';
import { EventBus, GameEvents } from '@/utils/EventBus';
import { toggleFullscreen, isFullscreen } from '@/utils/Fullscreen';
import { ScrollableList } from '@/utils/ScrollableList';
import { Button } from '@/utils/Button';
import { buildOptionsOverlay } from '@/scenes/OptionsOverlay';
import { keyBindings, CONTROL_ACTIONS, ACTION_LABELS } from '@/systems/KeyBindings';
import { buildIntroTutorialSteps, buildPowerTutorialSteps, buildCombatTutorialSteps, buildBossTutorialSteps, POWER_KEY_ACTION } from '@/systems/TutorialContent';
import type { TutorialStep } from '@/systems/TutorialContent';
import {
  powerSystem,
  dialogSystem,
  puzzleSystem,
  gameState,
  persistProgress,
  startTestMode,
  getAchievementProgress,
} from '@/systems/GameState';
import type { AchievementCategory } from '@/systems/GameState';

const INTERACT_RANGE = 52;
// Assez large pour prévenir avant tout contact (dégâts) réel avec l'ennemi, cf. maybeShowCombatTutorial.
const COMBAT_TUTO_RANGE = 200;
// Distance (px) entre un mob vaincu et une créature piégée pour considérer qu'il la "gardait".
const CAPTIVE_RESCUE_RADIUS = 140;
// Contour épais plutôt qu'un pavé gris translucide derrière le texte du HUD : le contraste
// tient quel que soit le fond (ciel clair, mur sombre...) sans jamais cacher le décor derrière.
const HUD_STROKE = { stroke: '#000000', strokeThickness: 4 } as const;

/** Scène principale : charge une zone, gère la traversée liée aux pouvoirs, le HUD et les transitions. */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cameraSystem!: CameraSystem;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private background?: ParallaxBackground;
  private playerGlow?: Phaser.GameObjects.Image;
  /** Voile noir des zones sombres (cf. DARK_ZONES) + source du masque qui y perce un cercle
   * autour du joueur — cf. loadZone/update. Ensemble distinct de `playerGlow` (le halo chaud
   * additif décoratif) : celui-ci masque structurellement le reste de la carte. */
  private darknessOverlay?: Phaser.GameObjects.Rectangle;
  private darknessMaskSource?: Phaser.GameObjects.Image;
  private built!: BuiltZone;
  private npcs: NPC[] = [];
  private enemies: Enemy[] = [];
  private captives: { entity: Extract<ZoneEntity, { type: 'captive' }>; sprite: Phaser.GameObjects.Sprite; freed: boolean }[] = [];
  /** Chats sauvages décoratifs — purs éléments de fond (cf. loadZone), traversables, sans corps physique. */
  private catDecorSprites: Phaser.GameObjects.Sprite[] = [];
  /** Halo rouge pulsant sur chaque vie bonus non ramassée — cf. collectLifePickup pour le retrait à la collecte. */
  private lifePickupGlows: { id: string; glow: Phaser.GameObjects.Image }[] = [];
  /** Rangée du sol par colonne (index tuile, pas pixel) — cf. entities/Enemy.ts, hasGroundAhead. */
  private groundTopByCol: (number | null)[] = [];
  private activeBoss?: { boss: Enemy; entity: Extract<ZoneEntity, { type: 'boss_arena' }>; sprite: Phaser.GameObjects.Sprite };
  private pendingBossFight?: { entity: Extract<ZoneEntity, { type: 'boss_arena' }>; sprite: Phaser.GameObjects.Sprite };
  private hud!: Phaser.GameObjects.Container;
  private hitImpactFx!: Phaser.GameObjects.Sprite;
  private dashImpactFx!: Phaser.GameObjects.Sprite;
  private powerIconTexts: Phaser.GameObjects.Text[] = [];
  private zoneLabel!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private achievementToastText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private powerTooltip!: Phaser.GameObjects.Text;
  private testBanner?: Phaser.GameObjects.Text;
  private debugZoneMenu?: Phaser.GameObjects.Container;
  private keyN!: Phaser.Input.Keyboard.Key;
  private keyF1!: Phaser.Input.Keyboard.Key;
  private keyTab!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private pauseMenu?: Phaser.GameObjects.Container;
  private controlsOverlay?: Phaser.GameObjects.Container;
  private optionsBox?: Phaser.GameObjects.Container;
  private zoneList?: ScrollableList;
  private dialogActive = false;
  private puzzleActive = false;
  private tutorialActive = false;
  private celebratingPower = false;
  private defeatedThisZone = new Set<string>();
  private lives = LIVES_START;
  private isDead = false;
  private isTransitioning = false;
  /** false pendant la génération (IA ou repli) d'une zone — update() ne doit toucher ni
   * this.built ni this.player avant que loadZone() (désormais async) les ait posés. */
  private zoneReady = false;
  private zoneLoadingText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    this.dialogActive = false;
    this.puzzleActive = false;
    this.tutorialActive = false;
    this.celebratingPower = false;
    this.defeatedThisZone = new Set();
    this.lives = this.maxLives;
    this.isDead = false;
    this.isTransitioning = false;
    this.hitImpactFx = this.add.sprite(0, 0, TEX.HIT_IMPACT_FX).setVisible(false).setDepth(10);
    this.hitImpactFx.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.hitImpactFx.setVisible(false));
    this.dashImpactFx = this.add.sprite(0, 0, TEX.DASH_IMPACT_FX).setVisible(false).setDepth(10);
    this.dashImpactFx.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.dashImpactFx.setVisible(false));
    // Créé avant le tout premier loadZone() (async, cf. resolveZoneMap) : la génération de la
    // toute première zone peut prendre quelques secondes (appel IA) avant que le HUD n'existe.
    this.zoneLoadingText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Génération de la zone…', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#d8b34a',
        ...HUD_STROKE,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
      .setVisible(false);
    // Créé avant this.hud/setupUICamera (cf. commentaire ci-dessus) : pas dans le conteneur HUD,
    // donc pas automatiquement ignoré par la caméra principale — sans ce `main.ignore` explicite,
    // ce texte fixe à l'écran se serait rendu deux fois (une fois par caméra), en double.
    this.cameras.main.ignore(this.zoneLoadingText);
    void this.loadZone(gameState.currentZone);

    // Tutoriel d'introduction : uniquement au tout début d'une vraie partie (pas en Mode
    // Admin), une seule fois — dialogSystem.hasFlag survit à la sauvegarde (cf. persistProgress).
    if (
      gameState.currentZone === ZONE_IDS[0] &&
      !powerSystem.isTestMode() &&
      !dialogSystem.hasFlag('tuto_intro_seen')
    ) {
      dialogSystem.setFlag('tuto_intro_seen');
      this.time.delayedCall(700, () => this.startTutorial(buildIntroTutorialSteps()));
    }

    keyBindings.attach(this);

    const kb = this.input.keyboard!;
    this.keyN = kb.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.keyF1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    this.keyTab = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    this.buildHUD();
    this.setupUICamera();

    // Réchauffe le cache des musiques de zone en tâche de fond (une par une, avec
    // délai) pour qu'une première visite de zone ne déclenche plus de chargement/
    // décodage audio synchrone pile au moment de la transition (micro-freeze).
    this.time.delayedCall(1500, () => audioManager.prefetchMusic(this, Object.values(MUSIC_KEYS)));

    EventBus.on(GameEvents.DIALOG_END, this.onDialogEnd, this);
    EventBus.on(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
    EventBus.on(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
    EventBus.on(GameEvents.COMBO_TRIGGERED, this.onComboTriggered, this);
    EventBus.on(GameEvents.SHARD_COLLECTED, this.onShardCollected, this);
    EventBus.on(GameEvents.TUTORIAL_END, this.onTutorialEnd, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.DIALOG_END, this.onDialogEnd, this);
      EventBus.off(GameEvents.PUZZLE_EXIT, this.onPuzzleExit, this);
      EventBus.off(GameEvents.PUZZLE_SOLVED, this.onPuzzleSolved, this);
      EventBus.off(GameEvents.COMBO_TRIGGERED, this.onComboTriggered, this);
      EventBus.off(GameEvents.SHARD_COLLECTED, this.onShardCollected, this);
      EventBus.off(GameEvents.TUTORIAL_END, this.onTutorialEnd, this);
      // Le shutdown de la scène détruit le monde physique (donc les groupes de this.built
      // deviennent des coquilles mortes) mais ne vide jamais la référence elle-même — sans ce
      // reset, un retour sur GameScene (ex: Mode Admin après "Quitter vers le menu") relance
      // create() avec this.built encore "vérité" (non-null) pendant que loadZone() (async)
      // n'a pas encore reconstruit la zone, et setupUICamera()/syncCameraIgnoreLists() plantait
      // en lisant getChildren() sur un groupe déjà détruit.
      this.built = undefined as unknown as BuiltZone;
    });
  }

  /**
   * Mode Admin : toujours la voie procédurale instantanée (jamais l'IA) — cf. plan, l'itération
   * rapide entre chapitres prime sur la variété en exploration libre. Une vraie partie réutilise
   * la disposition déjà générée cette partie si elle existe (cf. gameState.generatedZones),
   * sinon appelle generateZoneLive (IA ou repli procédural, cf. ZoneGenerator.ts) et la met en
   * cache — sans ce cache, revisiter une zone après un aller-retour regénérerait un layout
   * différent sous les pieds du joueur (dangereux pour un checkpoint déjà pris dedans).
   */
  private async resolveZoneMap(zoneId: string): Promise<ZoneMap> {
    if (powerSystem.isTestMode()) return getZoneMap(zoneId);
    const cached = gameState.generatedZones.get(zoneId);
    if (cached) return cached;
    this.zoneLoadingText.setVisible(true);
    const zoneMap = await generateZoneLive(zoneId);
    gameState.generatedZones.set(zoneId, zoneMap);
    this.zoneLoadingText.setVisible(false);
    return zoneMap;
  }

  private async loadZone(zoneId: string): Promise<void> {
    this.zoneReady = false;
    const zoneMap = await this.resolveZoneMap(zoneId);

    this.npcs.forEach((n) => n.destroy());
    this.npcs = [];
    this.enemies.forEach((e) => e.destroy());
    this.enemies = [];
    this.captives = [];
    this.catDecorSprites.forEach((s) => s.destroy());
    this.catDecorSprites = [];
    this.lifePickupGlows.forEach(({ glow }) => glow.destroy());
    this.lifePickupGlows = [];
    this.activeBoss = undefined;
    this.pendingBossFight = undefined;

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
    // Checkpoint : "reprendre une partie" doit reprendre exactement là où le joueur s'est arrêté
    // (dernier autel/boss/sortie de zone/sauvetage atteint), pas au point d'entrée de la zone —
    // ne s'applique qu'au tout premier chargement suivant continueGame() (cf. GameState.ts).
    if (gameState.resumePosition) {
      this.player.setPosition(gameState.resumePosition.x, gameState.resumePosition.y);
      gameState.resumePosition = null;
    }
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

    this.darknessOverlay?.destroy();
    this.darknessOverlay = undefined;
    this.darknessMaskSource?.destroy();
    this.darknessMaskSource = undefined;
    if (DARK_ZONES.includes(zoneId as ZoneId)) {
      // Source du masque : même texture douce (dégradé radial) que playerGlow, mais bien plus
      // large — c'est SON alpha qui découpe le trou de visibilité dans le voile noir ci-dessous.
      // Ignorée des deux caméras (cf. syncCameraIgnoreLists) : elle ne doit jamais se dessiner
      // elle-même, seule sa forme sert au masque (pattern standard de Phaser pour un BitmapMask).
      this.darknessMaskSource = this.add
        .image(this.player.x, this.player.y, TEX.PLAYER_GLOW)
        .setScale(3.2);
      // Hauteur du voile élargie d'une pleine fenêtre de chaque côté (même marge verticale que
      // CameraSystem.setupForZone) : le suivi vertical asymétrique de la caméra la laisse
      // dépasser des bornes exactes de la zone (ex. joueur en haut d'une tour dans une petite
      // zone) — un voile pile aux dimensions de la zone laissait alors le haut de l'écran
      // découvert (fond normalement éclairé visible) plutôt que dans le noir.
      const viewportWorldHeight = GAME_HEIGHT / GAMEPLAY_ZOOM;
      this.darknessOverlay = this.add
        .rectangle(
          (zoneMap.cols * TILE_SIZE) / 2,
          (zoneMap.rows * TILE_SIZE) / 2,
          zoneMap.cols * TILE_SIZE,
          zoneMap.rows * TILE_SIZE + 2 * viewportWorldHeight,
          0x000000,
          0.94,
        )
        .setDepth(500);
      const mask = this.darknessMaskSource.createBitmapMask();
      mask.invertAlpha = true;
      this.darknessOverlay.setMask(mask);
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
        // Chat retrouvé dans l'épilogue (cf. EPILOGUE_ZONE_ID) : n'apparaît que s'il a
        // effectivement été secouru cette partie — jamais un simple gate d'affichage comme
        // requiresPower (ne peut pas changer une fois dans la zone, donc pas besoin de la
        // logique par-frame de NPC.update, un simple filtre à la construction suffit).
        if (entity.requiresRescued && !gameState.rescuedCreatures.has(entity.requiresRescued)) {
          sprite.destroy();
          return;
        }
        const skin = getNpcSkin(entity.dialogTree);
        if (skin) sprite.play(skin.animKey);
        this.npcs.push(new NPC(this, sprite, entity, powerSystem));
        return;
      }
      if (entity.type === 'zone_exit' || entity.type === 'ending_trigger') {
        this.physics.add.overlap(this.player, sprite, () => this.handleAutoTrigger(entity));
      }
      if (entity.type === 'captive') {
        // Déjà libérée lors d'une session précédente (sauvegarde) : ne réapparaît pas.
        if (gameState.rescuedCreatures.has(entity.id)) {
          sprite.destroy();
          return;
        }
        sprite.play(ANIM_KEYS.RESCUE_CAT_IDLE);
        this.physics.add.collider(this.player, sprite);
        this.captives.push({ entity, sprite, freed: false });
      }
      if (entity.type === 'life_pickup') {
        // Déjà ramassée lors d'une session précédente (sauvegarde) : ne réapparaît pas.
        if (gameState.collectedLifePickups.has(entity.id)) {
          sprite.destroy();
          return;
        }
        // Halo rouge (même texture/additive que playerGlow, teinte vie) pour repérer la vie bonus
        // de loin — plus petit et pulsant plus vite qu'un halo de zone sombre, purement décoratif.
        const glow = this.add
          .image(sprite.x, sprite.y, TEX.PLAYER_GLOW)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xff2d3d)
          .setDepth(sprite.depth - 1)
          .setScale(0.5)
          .setAlpha(0.5);
        this.tweens.add({
          targets: glow,
          scale: { from: 0.4, to: 0.55 },
          alpha: { from: 0.4, to: 0.65 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
        this.lifePickupGlows.push({ id: entity.id, glow });
        this.physics.add.overlap(this.player, sprite, () => this.collectLifePickup(entity, sprite));
      }
    });

    // Chats sauvages décoratifs : purs éléments de fond (comme les arbres/buissons de
    // LevelLoader.scatterDecor) — traversables et derrière le gameplay, pas de corps physique,
    // donc gérés à part plutôt que via le pipeline entityMarkers (corps statique systématique).
    zoneMap.entities.forEach((entity) => {
      if (entity.type !== 'cat_decor') return;
      const px = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const py = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const variant = getCatDecorVariant(entity.variant);
      const sprite = this.add.sprite(px, py, variant.texture).setDepth(-5);
      sprite.play(variant.animKey);
      this.catDecorSprites.push(sprite);
    });

    // Rangée du SOL (pas d'une plateforme flottante) par colonne, lue directement dans la grille
    // de tuiles — sert de base fiable à la détection de rebord des ennemis (entities/Enemy.ts,
    // hasGroundAhead). Balayage du BAS vers le HAUT, en s'arrêtant dès que la colonne cesse d'être
    // pleine : un balayage du haut vers le bas aurait trouvé la tuile la plus HAUTE de la colonne,
    // c'est-à-dire souvent une tour/plateforme flottante ajoutée par-dessus le sol réel plutôt que
    // le sol lui-même — deux colonnes avec des plateformes à des hauteurs proches auraient alors pu
    // sembler "au même niveau" alors que le vrai sol, en dessous, avait une fosse entre les deux.
    // Ne suppose plus que le sol touche la dernière rangée (cf. ProceduralZoneGenerator : le sol
    // n'est plus qu'une seule rangée solide "flottante") — le premier solide rencontré du bas vers
    // le haut reste la bonne surface, qu'il touche le bord ou non ; une colonne sans aucun solide
    // reste correctement une fosse (y ne descend jamais en dessous de 0 sans avoir rien trouvé).
    this.groundTopByCol = new Array(zoneMap.cols).fill(null);
    for (let x = 0; x < zoneMap.cols; x++) {
      for (let y = zoneMap.rows - 1; y >= 0; y--) {
        if (zoneMap.tiles[y][x] === '#') {
          this.groundTopByCol[x] = y;
          break;
        }
      }
    }

    // Mobs : 5 par zone, difficulté croissante avec le tier ET la zone (cf. entities/Enemy.ts) —
    // pas de marqueur statique (cf. LevelLoader qui les exclut d'entityMarkers), un vrai corps
    // dynamique qui patrouille et inflige des dégâts de contact. Le sprite suit le thème visuel
    // de la zone (cf. Constants.MOB_TEX_BY_BG) plutôt qu'un mob unique partout.
    const zoneIndex = Number(zoneId.match(/^zone(\d)/)?.[1] ?? 1);
    const bgTheme = ZONE_BACKGROUND[zoneId as keyof typeof ZONE_BACKGROUND];
    const mobTexture = MOB_TEX_BY_BG[bgTheme ?? 'NONE'];
    const mobAnimKey = mobTexture === TEX.MOB_BOAR ? ANIM_KEYS.BOAR_IDLE : undefined;
    zoneMap.entities.forEach((entity) => {
      if (entity.type !== 'mob') return;
      const px = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const py = entity.y * TILE_SIZE + TILE_SIZE / 2;
      const enemy = new Enemy(this, px, py, mobHp(zoneIndex, entity.tier), mobSpeed(zoneIndex, entity.tier), {
        groundTopByCol: this.groundTopByCol,
        texture: mobTexture,
        animKey: mobAnimKey,
      });
      this.physics.add.collider(enemy, this.built.solidGroup);
      this.enemies.push(enemy);
    });

    if (this.zoneLabel) this.updateZoneLabel();
    if (this.testBanner) this.testBanner.setVisible(powerSystem.isTestMode() && gameState.currentZone !== EPILOGUE_ZONE_ID);

    this.syncCameraIgnoreLists();
    this.zoneReady = true;
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
      ...this.catDecorSprites,
      ...this.enemies,
      ...this.enemies.flatMap((e) => e.bossFxSprites),
      this.player,
      this.player.attackEffect,
      this.hitImpactFx,
      this.dashImpactFx,
      this.promptText,
    ];
    if (this.playerGlow) worldObjects.push(this.playerGlow);
    this.lifePickupGlows.forEach(({ glow }) => worldObjects.push(glow));
    if (this.darknessOverlay) worldObjects.push(this.darknessOverlay);
    // Ignorée aussi de la caméra PRINCIPALE : seule sa forme doit servir de masque, elle ne doit
    // jamais se dessiner elle-même (sans ça, un rond lumineux du double de la taille du halo
    // apparaîtrait par-dessus tout, cf. commentaire de sa création dans loadZone).
    if (this.darknessMaskSource) {
      worldObjects.push(this.darknessMaskSource);
      this.cameras.main.ignore(this.darknessMaskSource);
    }
    this.npcs.forEach((npc) => worldObjects.push(npc.marker, npc.prompt));
    if (this.background) worldObjects.push(...this.background.getGameObjects());
    this.uiCamera.ignore(worldObjects);
  }

  /** Un overlay (dialogue/tutoriel/puzzle) ou la célébration de pouvoir bloque le joueur. */
  private get inputLocked(): boolean {
    return this.dialogActive || this.puzzleActive || this.tutorialActive || this.celebratingPower;
  }

  update(time: number, delta: number): void {
    if (!this.zoneReady) return;
    this.cameraSystem?.update();
    if (this.inputLocked) {
      // Tant que l'overlay reste ouvert plusieurs frames, continue à drainer (cf.
      // drainEdgeInputs plus bas pour l'explication complète du problème).
      this.drainEdgeInputs();
    }
    if (this.inputLocked || this.isDead || this.isTransitioning) return;

    if (this.player.y > this.built.heightPx + FALL_DEATH_MARGIN) {
      this.handleFallDeath();
      return;
    }

    this.player.update(time, delta);
    this.playerGlow?.setPosition(this.player.x, this.player.y);
    this.darknessMaskSource?.setPosition(this.player.x, this.player.y);

    // MODE ADMIN uniquement — jamais dans l'épilogue (cf. GameState.enterEpilogue) : ce dernier
    // pose testMode pour éviter d'écraser la sauvegarde (cf. persistProgress), pas pour ouvrir
    // les outils de dev en pleine promenade narrative.
    const isRealAdminMode = powerSystem.isTestMode() && gameState.currentZone !== EPILOGUE_ZONE_ID;
    if (isRealAdminMode && Phaser.Input.Keyboard.JustDown(this.keyN)) {
      this.player.setNoclip(!this.player.isNoclip());
      this.toast(this.player.isNoclip() ? 'Noclip activé' : 'Noclip désactivé');
    }
    if (isRealAdminMode && Phaser.Input.Keyboard.JustDown(this.keyF1)) {
      this.toggleDebugZoneMenu();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyTab) && !this.pauseMenu && !this.optionsBox && !this.debugZoneMenu) {
      this.toggleControlsOverlay();
    }
    if (keyBindings.justDown('pause')) {
      if (this.optionsBox) this.closeOptions();
      else if (this.debugZoneMenu) this.toggleDebugZoneMenu();
      else if (this.controlsOverlay) this.toggleControlsOverlay();
      else this.togglePauseMenu();
    }
    if (this.debugZoneMenu && this.zoneList) {
      if (this.keyUp.isDown) this.zoneList.scrollBy(-12);
      if (this.keyDown.isDown) this.zoneList.scrollBy(12);
    }

    this.npcs.forEach((npc) => npc.update(this.player.x, this.player.y));
    this.enemies.forEach((e) => e.updateAI(this.player.x, this.player.y, time, delta));
    // Filet de sécurité : un mob (patrouille normale, pas de boss actif) qui finit par tomber
    // hors de la carte malgré hasGroundAhead — traversée d'un sol désormais fin d'une seule
    // tuile sous l'effet d'un recul, par ex. — reste sinon à jamais en chute libre, invisible
    // mais toujours vivant (et donc encore capable de toucher le joueur au passage).
    const fallenMobs = this.enemies.filter((e) => !e.isBoss && e.y > this.built.heightPx + FALL_DEATH_MARGIN);
    if (fallenMobs.length > 0) {
      this.enemies = this.enemies.filter((e) => !fallenMobs.includes(e));
      fallenMobs.forEach((e) => e.destroy());
    }
    this.maybeShowCombatTutorial();
    this.resolveCombat(time);

    this.updateInteractPrompt();
    if (keyBindings.justDown('interact')) {
      this.tryInteract();
    }

    this.updatePowerIcons();
  }

  // ---------- Interactions ----------

  // Types dont l'interaction (E) ne fait absolument rien : 'zone_exit'/'ending_trigger'/'life_pickup'
  // se déclenchent par simple contact (overlap), pas par E — le prompt "E : Interagir" ne doit pas
  // non plus apparaître pour eux, une invite trompeuse vers une action qui se produit déjà seule
  // (cf. le bug rapporté : le prompt s'affichait sur une vie bonus, mais E n'avait aucun effet).
  private static readonly NON_INTERACTIVE_TYPES: ZoneEntity['type'][] = ['npc', 'zone_exit', 'ending_trigger', 'life_pickup'];

  private nearestInteractable(): { entity: ZoneEntity; sprite: Phaser.GameObjects.Sprite } | null {
    let best: { entity: ZoneEntity; sprite: Phaser.GameObjects.Sprite; dist: number } | null = null;
    for (const marker of this.built.entityMarkers) {
      if (GameScene.NON_INTERACTIVE_TYPES.includes(marker.entity.type)) continue;
      // Un marqueur "résolu" (boss vaincu, otage libéré...) détruit son sprite (cf.
      // resolveBossVictory/rescueCaptive) sans jamais quitter entityMarkers — sans ce filtre, le
      // prompt "Appuyer sur E" restait affiché indéfiniment sur un emplacement déjà vide.
      if (!marker.sprite.active) continue;
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
      // Un PNJ du monde (ex. la "vision" de Malakar en zone8) peut partager le même arbre de
      // dialogue que l'intro d'un boss pas encore affronté (cf. handleBossArena) : sans marquer
      // ici son flag d'intro, l'approche du boss la rejouait une seconde fois à l'identique.
      const bossWithSameIntro = Object.entries(BOSS_DEFS).find(([, def]) => def.dialogTree === npc.data.dialogTree);
      if (bossWithSameIntro) dialogSystem.setFlag(`boss_intro_seen_${bossWithSameIntro[0]}`);
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
      case 'captive': {
        // Libération directe à l'appui de E, en plus du déclenchement existant par défaite d'un
        // mob proche (cf. onEnemyDefeated) — les deux mènent au même rescueCaptive().
        const captiveId = target.entity.id;
        const captive = this.captives.find((c) => !c.freed && c.entity.id === captiveId);
        if (captive) this.rescueCaptive(captive);
        break;
      }
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
    if (this.activeBoss || this.pendingBossFight) {
      this.toast('Le combat est déjà engagé.');
      return;
    }

    const bossDef = BOSS_DEFS[entity.bossId];
    const introFlag = `boss_intro_seen_${entity.bossId}`;
    if (bossDef?.dialogTree && !dialogSystem.hasFlag(introFlag)) {
      dialogSystem.setFlag(introFlag);
      this.pendingBossFight = { entity, sprite };
      this.startDialog(bossDef.dialogTree);
      return;
    }
    this.startBossFight(entity, sprite);
  }

  /** Fait apparaître le boss (vrai combat : PV, pattern, cf. entities/Enemy.ts) et bascule sa musique. */
  private startBossFight(entity: Extract<ZoneEntity, { type: 'boss_arena' }>, sprite: Phaser.GameObjects.Sprite): void {
    const bossDef = BOSS_DEFS[entity.bossId];
    // Le boss final apparaît d'abord sous sa forme démoniaque (même skin que son portrait de
    // dialogue, cf. getNpcSkin/Constants.NPC_SKINS) avant de se transformer en esprit-chat
    // spectral pour le combat réel (cf. Enemy.transform) — un choix de skin cohérent avec celui
    // déjà vu par le joueur juste avant, plutôt qu'un nouvel asset dédié.
    const preTransformSkin = bossDef?.pattern === 'phases3' && bossDef.dialogTree ? getNpcSkin(bossDef.dialogTree) : null;
    // Marge de sécurité au-dessus du sol, proportionnelle à la taille RÉELLE affichée du boss
    // (frame source x échelle, cf. BossDef.scale) plutôt qu'une constante fixe — un boss qui
    // apparaît pile à la hauteur du marqueur peut s'enfoncer dans un sol désormais fin d'une seule
    // tuile, au point de retomber (voire traverser) avant même que le combat ne commence (cf.
    // LevelLoader.spawn, même correctif pour le joueur). Une constante fixe (l'ancien TILE_SIZE)
    // suffisait pour des sprites d'~50-110px affichés, mais laissait un boss bien plus grand (ex.
    // le samouraï, 136px) apparaître déjà enfoncé de moitié dans le sol — au point que la
    // séparation Arcade d'un chevauchement aussi profond échouait purement et simplement, le
    // laissant traverser le sol en chute libre plutôt que de le repousser dessus.
    const bossTexKey = bossDef?.texture ?? TEX.ENEMY;
    const bossFrameHeight = this.textures.get(bossTexKey).get(0).height;
    // + extraSpawnTiles (cf. BossDef) : marge ADDITIONNELLE demandée pour un boss qui doit
    // visiblement tomber de plus haut à l'ouverture du combat, plutôt qu'apparaître à ras du sol.
    const spawnClearance = (bossFrameHeight * (bossDef?.scale ?? 1.7)) / 2 + TILE_SIZE / 2 + (bossDef?.extraSpawnTiles ?? 0) * TILE_SIZE;
    const boss = new Enemy(this, sprite.x, sprite.y - spawnClearance, bossDef?.hp ?? 8, bossDef?.speed ?? 40, {
      isBoss: true,
      bossDef,
      groundTopByCol: this.groundTopByCol,
      texture: bossDef?.texture,
      animKey: bossDef?.animKey,
      preTransformTexture: preTransformSkin?.texture,
      preTransformAnimKey: preTransformSkin?.animKey,
    });
    // Le boss final ('phases3', cf. Enemy.updateBossCombatAI) flotte plutôt que de marcher au sol
    // (esprit-chat spectral, cohérent avec sa fiction) — délibérément SANS collider contre le sol :
    // son corps, dimensionné sur le contenu réel du sprite pour rester fidèle à l'attaque de griffe,
    // reste plus large qu'une tuile, et le sol (fait de nombreux sprites de tuile 32x32 individuels
    // plutôt qu'un vrai Tilemap avec retrait des arêtes internes) bloquait faussement tout
    // déplacement horizontal sur les coutures entre tuiles adjacentes dès qu'un corps aussi large
    // s'y enfonçait, même légèrement. Les mobs normaux (32x32, une seule colonne) n'y sont jamais
    // exposés.
    if (bossDef?.pattern !== 'phases3') this.physics.add.collider(boss, this.built.solidGroup);
    this.enemies.push(boss);
    // Sans ça, le boss (ajouté après le calcul initial de la liste des objets ignorés par la
    // caméra HUD, cf. loadZone) restait rendu par LES DEUX caméras : un doublon visuel exact du
    // même sprite, disparaissant donc en même temps que l'original une fois vaincu.
    this.syncCameraIgnoreLists();
    this.activeBoss = { boss, entity, sprite };
    sprite.setVisible(false);
    if (bossDef) audioManager.setMusicRate(bossDef.musicRate);
    this.toast(`Le combat commence : ${bossDef?.name ?? entity.bossId} !`);
    if (bossDef?.pattern === 'phases3') this.maybeShowBossTutorial();
  }

  /** Affiche le mini tutoriel des nouvelles attaques de Malakar la première fois que son combat démarre. */
  private maybeShowBossTutorial(): void {
    if (powerSystem.isTestMode() || dialogSystem.hasFlag('tuto_boss_seen')) return;
    dialogSystem.setFlag('tuto_boss_seen');
    this.safeDelay(400, () => this.startTutorial(buildBossTutorialSteps()));
  }

  /** Un pouvoir vient d'être débloqué EN COURS DE ZONE (boss ou autel dans la même zone qu'une
   * porte qui en dépend, cf. zone1 : le mur fissuré après le Gardien de Pierre) : les tuiles
   * correspondantes, déjà construites solides à l'entrée dans la zone (cf. LevelLoader.buildZone,
   * qui ne revérifie jamais les pouvoirs ensuite), doivent devenir franchissables immédiatement —
   * sans ça, il faudrait quitter puis rentrer dans la zone pour que le nouveau pouvoir compte. */
  private openGatesFor(power: PowerId): void {
    const group = (
      {
        griffes_renforcees: this.built.breakableGroup,
        vision_feline: this.built.hiddenGroup,
        dash_fantome: this.built.dashGateGroup,
        forme_ombre: this.built.shadowWallGroup,
        eclat_lumiere: this.built.lightObstacleGroup,
      } satisfies Partial<Record<PowerId, Phaser.Physics.Arcade.StaticGroup>>
    )[power];
    group?.clear(true, true);
  }

  /** Boss vaincu (PV à 0, cf. onEnemyDefeated) : reprend exactement l'ancien flux de victoire. */
  private resolveBossVictory(entity: Extract<ZoneEntity, { type: 'boss_arena' }>, sprite: Phaser.GameObjects.Sprite): void {
    gameState.defeatedBosses.add(entity.bossId);
    this.defeatedThisZone.add(entity.bossId);
    sprite.destroy();
    audioManager.setMusicRate(1);
    audioManager.play(this, SFX_KEYS.BOSS_DEFEATED);
    this.showAchievementToast('bosses');
    this.activeBoss = undefined;
    if (entity.grantsPower) {
      const power = entity.grantsPower;
      this.safeDelay(500, () => {
        audioManager.play(this, SFX_KEYS.POWER_UNLOCK);
        this.grantPowerCelebration(power);
      });
      powerSystem.unlock(power);
      this.openGatesFor(power);
      this.toast(`Gardien vaincu — Pouvoir obtenu : ${powerSystem.getDef(power)?.name}`);
    } else {
      this.toast('Gardien vaincu.');
    }
    persistProgress(this.player.x, this.player.y, true);
  }

  private handlePowerAltar(entity: Extract<ZoneEntity, { type: 'power_altar' }>, sprite: Phaser.GameObjects.Sprite): void {
    if (entity.requiresPower && !powerSystem.has(entity.requiresPower)) {
      this.toast('Il te manque un pouvoir pour approcher cet autel.');
      return;
    }
    if (entity.grantsPower) {
      powerSystem.unlock(entity.grantsPower);
      this.openGatesFor(entity.grantsPower);
    }
    if (entity.pivotEvent) {
      audioManager.play(this, SFX_KEYS.PIVOT_ABSORB);
      this.safeDelay(700, () => audioManager.play(this, SFX_KEYS.PIVOT_STING));
      this.toast('Hikari no Ne absorbée... Malakar surgit et corrompt la Source. L\'Acte 2 commence.');
      // Célébration dorée sautée ici : le moment est sombre (corruption de la Source par
      // Malakar), pas triomphant — seul le tutoriel du pouvoir suit, après un délai plus long
      // pour laisser la scène pivot respirer avant d'afficher quoi que ce soit par-dessus.
      if (entity.grantsPower) {
        const power = entity.grantsPower;
        this.safeDelay(1800, () => this.maybeShowPowerTutorial(power));
      }
    } else {
      audioManager.play(this, SFX_KEYS.POWER_UNLOCK);
      if (entity.grantsPower) this.grantPowerCelebration(entity.grantsPower);
      this.toast('Énergie absorbée.');
    }
    sprite.setTint(0xffe27a);
    persistProgress(this.player.x, this.player.y, true);
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
      if (!powerSystem.isTestMode()) {
        gameState.reachedEndings.add(ending.id);
        persistProgress(this.player.x, this.player.y, true);
      }
      this.scene.start(SCENE_KEYS.ENDING_CUTSCENE, { ending });
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
    persistProgress(this.player.x, this.player.y, true);
    this.cameraSystem.fadeOutIn(300, () => {
      void this.loadZone(targetZone).then(() => {
        this.isTransitioning = false;
      });
    });
  }

  // ---------- Combat ----------

  /**
   * Griffure du joueur contre les ennemis à portée, puis contact ennemi -> joueur (sauf en Forme
   * ombre, intangible — cf. message.txt — ou en dash, qui inflige des dégâts massifs à l'ennemi
   * plutôt que d'en subir, cohérent avec l'invincibilité courte déjà documentée pour ce pouvoir).
   */
  /** Rafale (RPG Effect All Free, cf. ACKNOWLEDGEMENTS.md) au point d'impact d'une griffure réussie. */
  private playHitImpactFx(x: number, y: number): void {
    this.hitImpactFx.setPosition(x, y).setVisible(true).play(ANIM_KEYS.HIT_IMPACT);
  }

  /** Même pack, teinte distincte (cyan) : le dash fantôme est une attaque à part, pas une griffure. */
  private playDashImpactFx(x: number, y: number): void {
    this.dashImpactFx.setPosition(x, y).setVisible(true).play(ANIM_KEYS.DASH_IMPACT);
  }

  private resolveCombat(time: number): void {
    const hitbox = this.player.getAttackHitbox(time);
    const playerBounds = this.player.getBounds();
    this.enemies.forEach((enemy) => {
      if (enemy.isDefeated) return;
      const enemyBounds = enemy.getBounds();

      // Dégâts à distance/de zone du boss (orbe, onde de choc) — le dash EST le corps du boss,
      // donc déjà couvert par le contact classique plus bas ; ceci couvre les deux autres.
      if (enemy.isBoss && !this.player.isInShadowForm() && enemy.checkBossHazards(playerBounds, time)) {
        this.handlePlayerHurt(enemy);
        return;
      }

      if (hitbox && Phaser.Geom.Intersects.RectangleToRectangle(hitbox, enemyBounds)) {
        this.playHitImpactFx(enemy.x, enemy.y);
        if (enemy.takeDamage(this.player.attackDamage(), time, this.player.x)) this.onEnemyDefeated(enemy);
        return;
      }

      if (!Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, enemyBounds)) return;
      if (this.player.isInShadowForm()) return;
      if (this.player.dashActive) {
        this.playDashImpactFx(enemy.x, enemy.y);
        if (enemy.takeDamage(999, time, this.player.x)) this.onEnemyDefeated(enemy);
        return;
      }
      if (enemy.canContactHurt(time)) {
        enemy.markContact(time);
        this.handlePlayerHurt(enemy);
      }
    });
  }

  private onEnemyDefeated(enemy: Enemy): void {
    this.enemies = this.enemies.filter((e) => e !== enemy);
    const activeBoss = this.activeBoss;
    const boss = activeBoss && activeBoss.boss === enemy ? activeBoss : undefined;
    const enemyX = enemy.x;
    const enemyY = enemy.y;
    enemy.playDefeatedAnimation(() => {
      if (boss) this.resolveBossVictory(boss.entity, boss.sprite);
    });
    // Une créature piégée à proximité du mob qui vient d'être vaincu est libérée — capturée
    // "par des mobs" au sens propre, cf. le brief : garder Kiba à distance ne suffit pas, il
    // faut vraiment abattre le gardien.
    const captive = this.captives.find(
      (c) => !c.freed && Phaser.Math.Distance.Between(enemyX, enemyY, c.sprite.x, c.sprite.y) <= CAPTIVE_RESCUE_RADIUS,
    );
    if (captive) this.rescueCaptive(captive);
  }

  /** Libère une créature piégée : petite animation, remerciement + lore, suivi persistant. */
  private rescueCaptive(captive: { entity: Extract<ZoneEntity, { type: 'captive' }>; sprite: Phaser.GameObjects.Sprite; freed: boolean }): void {
    captive.freed = true;
    (captive.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    audioManager.play(this, SFX_KEYS.SHARD_COLLECT, { volume: 0.5 });
    // Détale à l'opposé du joueur plutôt que de simplement s'estomper sur place — le skin
    // (cf. rescue_cat_run.png/ANIM_KEYS.RESCUE_CAT_RUN) a justement été choisi pour avoir un
    // cycle de course/bond, contrairement à l'ancien skin idle-seulement.
    const dir: 1 | -1 = captive.sprite.x >= this.player.x ? 1 : -1;
    captive.sprite.setFlipX(dir < 0);
    captive.sprite.play(ANIM_KEYS.RESCUE_CAT_RUN);
    this.tweens.add({
      targets: captive.sprite,
      x: captive.sprite.x + dir * 500,
      duration: 900,
      ease: 'Cubic.easeIn',
      onComplete: () => captive.sprite.destroy(),
    });
    gameState.rescuedCreatures.add(captive.entity.id);
    persistProgress(this.player.x, this.player.y, true);
    this.toast('Une créature piégée a été libérée !');
    this.showAchievementToast('captives');
    this.safeDelay(400, () => this.startDialog(`captive_${captive.entity.id}_thanks`));
  }

  /** Dégâts de contact d'un ennemi : coûte une vie (sans effet en Mode Admin), petit recul + i-frames via le cooldown de contact. */
  private handlePlayerHurt(source: Enemy): void {
    audioManager.play(this, SFX_KEYS.PLAYER_HURT);
    this.cameras.main.flash(200, 200, 0, 0);
    const dir = this.player.x >= source.x ? 1 : -1;
    this.player.applyKnockback(dir * 220, -180, this.time.now);

    const isAdmin = powerSystem.isTestMode();
    if (isAdmin) return;
    this.lives -= 1;
    this.updateLivesDisplay();
    if (this.lives <= 0) {
      this.showGameOver();
      return;
    }
    this.toast('Touché !');
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

  /**
   * `window.setTimeout` plutôt que `this.time.delayedCall` : si une autre scène (un dialogue,
   * un tutoriel...) se lance pendant qu'un minuteur du Clock de GameScene patiente, ce dernier
   * peut "disparaître" silencieusement — observé jusqu'à ~1.2s de dérive, et dans le pire cas
   * (l'écran de Game Over) un minuteur qui ne se déclenche jamais, laissant le joueur bloqué
   * pour de bon. Un délai natif du navigateur ne dépend pas de cette horloge et reste fiable
   * quoi qu'il arrive entre-temps ; `fn` ne s'exécute que si la scène est toujours active.
   */
  private safeDelay(ms: number, fn: () => void): void {
    window.setTimeout(() => {
      if (this.scene.isActive()) fn();
    }, ms);
  }

  /**
   * Un dialogue/tutoriel/puzzle resté ouvert (ex. le tutoriel d'intro juste après le spawn, ou
   * un mini tutoriel de pouvoir programmé quelques centaines de ms plus tôt et pas encore
   * affiché) masquait l'écran de Game Over et, surtout, cassait le retour au menu. Appelée à
   * la fois immédiatement et juste avant la transition finale, pour couvrir aussi le cas où
   * l'overlay s'ouvre PENDANT l'attente du Game Over plutôt qu'avant.
   */
  private closeOverlayScenes(): void {
    this.dialogActive = false;
    this.tutorialActive = false;
    this.puzzleActive = false;
    this.scene.stop(SCENE_KEYS.DIALOG);
    this.scene.stop(SCENE_KEYS.TUTORIAL);
    this.scene.stop(SCENE_KEYS.PUZZLE);
  }

  private showGameOver(): void {
    this.closeOverlayScenes();

    // Les pouvoirs/flags/puzzles déjà acquis cette session doivent survivre au Game Over —
    // sans ça, mourir avant d'avoir atteint un nouveau point de sauvegarde naturel (boss,
    // autel, sortie de zone) donnait l'impression que "tout" repartait de la dernière fois.
    if (!powerSystem.isTestMode()) persistProgress(this.player.x, this.player.y);

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
    this.safeDelay(2200, () => {
      this.closeOverlayScenes();
      this.scene.start(SCENE_KEYS.MENU);
    });
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
    this.drainEdgeInputs();
    // Le dialogue d'intro d'un boss (cf. handleBossArena) ne fait que précéder le combat réel :
    // celui-ci ne démarre qu'une fois la fenêtre de dialogue refermée.
    if (this.pendingBossFight) {
      const { entity, sprite } = this.pendingBossFight;
      this.pendingBossFight = undefined;
      this.startBossFight(entity, sprite);
      return;
    }
  }

  // ---------- Tutoriel ----------

  private startTutorial(steps: TutorialStep[]): void {
    if (steps.length === 0) return;
    // Gèle IMMÉDIATEMENT, même en plein saut — un essai précédent attendait l'atterrissage avant
    // de figer quoi que ce soit (pour ne pas couper l'élan vertical brutalement), mais laissait
    // alors le joueur retomber normalement, non protégé, pendant toute l'attente : un
    // déclenchement en plein saut au-dessus d'une fosse pouvait le faire tomber dans le vide
    // avant même que le tutoriel n'ait eu la moindre chance de s'afficher. Un arrêt net en plein
    // vol (petit défaut visuel) est un bien moindre mal qu'une mort par chute imméritée.
    this.tutorialActive = true;
    this.player.setVelocity(0, 0);
    // GameScene.update() skipping enemy.updateAI()/resolveCombat() only stops NEW AI decisions —
    // Arcade Physics keeps simulating existing velocity/gravity independently of Scene.update(),
    // so an enemy already mid-patrol kept sliding/falling under the tutorial overlay. Pausing the
    // whole physics world actually freezes everything, not just the player's own input handling.
    this.physics.pause();
    this.scene.launch(SCENE_KEYS.TUTORIAL, { steps });
  }

  private onTutorialEnd(): void {
    this.tutorialActive = false;
    this.physics.resume();
    this.scene.stop(SCENE_KEYS.TUTORIAL);
    this.drainEdgeInputs();
  }

  /**
   * Consomme les touches "juste pressées" liées au gameplay (saut/dash/forme ombre/interagir,
   * y compris l'Espace fixe de secours pour le saut) sans agir dessus. Un dialogue/tutoriel/
   * puzzle se ferme souvent via Espace ou E — des touches qui déclenchent aussi une action en
   * jeu — et DialogScene/TutorialScene se mettent à jour avant GameScene dans la boucle de la
   * scène : sans ce drain appelé au moment même de la fermeture, le flag "juste pressée" reste
   * en attente sur la touche du joueur et se rejoue en saut (ou pire) dès cette même frame.
   */
  private drainEdgeInputs(): void {
    keyBindings.justDown('jump');
    keyBindings.justDown('dash');
    keyBindings.justDown('shadowForm');
    keyBindings.justDown('interact');
    // 'pause' aussi : Échap ferme un tutoriel (TutorialScene) tout en étant la touche pause —
    // sans ce drain, GameScene rouvrait le menu pause sur ce même appui juste après la fermeture.
    keyBindings.justDown('pause');
    this.player.drainEdgeInputs();
  }

  /**
   * Petite célébration à l'acquisition d'un pouvoir : Kiba se soulève doucement, un halo de
   * lumière dorée grossit autour de lui, un rayon vertical descend, et la caméra flashe — en
   * plus du son déjà joué par l'appelant (SFX_KEYS.POWER_UNLOCK). Le joueur est figé (cf. le
   * flag `celebratingPower` dans update()) le temps de l'animation, pour qu'elle se déroule
   * sans qu'une touche pressée entre-temps ne l'interrompe visuellement ; `onComplete` (le
   * mini tutoriel du pouvoir, typiquement) n'est appelé qu'une fois le joueur libéré.
   */
  private celebratePowerUnlock(power: PowerId, onComplete?: () => void): void {
    const px = this.player.x;
    const py = this.player.y;
    this.celebratingPower = true;
    this.player.setVelocity(0, 0);
    // Sort le corps de la simulation physique le temps de l'animation : sinon la gravité
    // continue de s'accumuler à chaque step (setVelocity(0,0) n'est appliqué qu'une fois) et
    // percute le sol/la plateforme, ce qui repositionne le sprite au sol pour une frame avant
    // que le tween ne reprenne la main l'instant d'après (flash visible perso-au-sol-puis-en-l'air).
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    let burstAlive = true;
    let beamAlive = true;
    let iconAlive = true;

    this.tweens.add({
      targets: this.player,
      y: py - 64,
      duration: 1900,
      ease: 'sine.out',
      yoyo: true,
      hold: 1200,
      // Le halo/rayon/icône suivent le perso pendant qu'il monte : sans ça ils restent plantés à
      // sa position de départ pendant que le tween ne bouge que sa propriété `y` à lui.
      onUpdate: () => {
        if (burstAlive) burst.setPosition(this.player.x, this.player.y);
        if (beamAlive) beam.setPosition(this.player.x, this.player.y);
        if (iconAlive) icon.setPosition(this.player.x, this.player.y - 40);
      },
      onComplete: () => {
        body.enable = true;
        this.celebratingPower = false;
        this.drainEdgeInputs();
        onComplete?.();
      },
    });

    // Icône du pouvoir précisément acquis (cf. POWER_ICON_TEX, mêmes icônes que la description
    // des pouvoirs) — se lit "voici CE que tu viens de trouver", que ce soit via un autel ou un
    // PNJ, plutôt qu'un halo doré générique qui ne dit pas lequel des 5 pouvoirs vient d'arriver.
    const iconTex = POWER_ICON_TEX[power];
    const icon = this.add
      .image(px, py - 40, iconTex ?? TEX.PLAYER_GLOW)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(51)
      .setAlpha(0)
      .setScale(0.5);
    this.uiCamera?.ignore(icon);
    this.tweens.add({
      targets: icon,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.5, to: 1.6 },
      duration: 1400,
      ease: 'sine.out',
      yoyo: true,
      hold: 1000,
      onComplete: () => {
        iconAlive = false;
        icon.destroy();
      },
    });

    // Halo qui grossit graduellement ; le flash blanc plein écran n'arrive qu'à la toute fin
    // de son apparition (onComplete), pas en même temps que le reste de l'animation.
    const burst = this.add
      .image(px, py, TEX.PLAYER_GLOW)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(50)
      .setAlpha(0)
      .setScale(0.6)
      .setTint(0xfff2c0);
    this.uiCamera?.ignore(burst);
    this.tweens.add({
      targets: burst,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.6, to: 3.2 },
      duration: 4600,
      ease: 'sine.inOut',
      onComplete: () => {
        this.cameras.main.flash(500, 255, 255, 255);
        burstAlive = false;
        burst.destroy();
      },
    });

    const beam = this.add
      .rectangle(px, py, 46, 400, 0xfff2c0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(49)
      .setOrigin(0.5, 1);
    this.uiCamera?.ignore(beam);
    this.tweens.add({
      targets: beam,
      alpha: { from: 0, to: 0.55 },
      duration: 950,
      yoyo: true,
      hold: 1650,
      onComplete: () => {
        beamAlive = false;
        beam.destroy();
      },
    });
  }

  /** Célèbre un pouvoir tout juste accordé, puis enchaîne sur son mini tutoriel une fois fini. */
  private grantPowerCelebration(power: PowerId): void {
    this.celebratePowerUnlock(power, () => this.maybeShowPowerTutorial(power));
  }

  /** Affiche le mini tutoriel d'un pouvoir la première fois qu'il est accordé (boss ou autel). */
  private maybeShowPowerTutorial(power: PowerId): void {
    const flag = `tuto_power_${power}`;
    if (powerSystem.isTestMode() || dialogSystem.hasFlag(flag)) return;
    dialogSystem.setFlag(flag);
    this.startTutorial(buildPowerTutorialSteps(power));
  }

  /** Affiche le mini tutoriel de combat la première fois qu'un ennemi vivant s'approche du joueur. */
  private maybeShowCombatTutorial(): void {
    if (this.tutorialActive || powerSystem.isTestMode() || dialogSystem.hasFlag('tuto_combat_seen')) return;
    const nearEnemy = this.enemies.some(
      (e) => !e.isDefeated && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= COMBAT_TUTO_RANGE,
    );
    if (!nearEnemy) return;
    dialogSystem.setFlag('tuto_combat_seen');
    this.startTutorial(buildCombatTutorialSteps());
  }

  // ---------- Puzzle ----------

  private startPuzzle(puzzleId: string): void {
    this.puzzleActive = true;
    this.player.setVelocity(0, 0);
    this.scene.launch(SCENE_KEYS.PUZZLE, { puzzleId });
  }

  private onPuzzleSolved(): void {
    persistProgress(this.player.x, this.player.y, true);
  }

  private onPuzzleExit(): void {
    this.puzzleActive = false;
    this.scene.stop(SCENE_KEYS.PUZZLE);
    this.drainEdgeInputs();
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
    this.showAchievementToast('shards');
  }

  // ---------- HUD ----------

  private buildHUD(): void {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    this.zoneLabel = this.add.text(16, 12, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#e8e2f0',
      ...HUD_STROKE,
    });
    this.hud.add(this.zoneLabel);
    this.updateZoneLabel();

    this.toastText = this.add
      .text(GAME_WIDTH / 2, 60, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffe27a',
        align: 'center',
        ...HUD_STROKE,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.hud.add(this.toastText);

    // Notification de succès, distincte du toast narratif ci-dessus (coin, pas centré ; teinte
    // "trophée" propre) — cf. showAchievementToast, affichée à chaque progression d'une des 4
    // catégories (gardiens/créatures/éclats/fins), pas seulement consultable depuis le menu.
    this.achievementToastText = this.add
      .text(GAME_WIDTH - 16, 90, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#8ad8ff',
        align: 'right',
        ...HUD_STROKE,
      })
      .setOrigin(1, 0)
      .setAlpha(0);
    this.hud.add(this.achievementToastText);

    this.promptText = this.add
      .text(0, 0, 'Appuyer sur E', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        ...HUD_STROKE,
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setVisible(false);

    this.livesText = this.add
      .text(GAME_WIDTH - 20, 16, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ff5a5a',
        letterSpacing: 10,
        stroke: '#1a0505',
        strokeThickness: 4,
        shadow: { color: '#000000', blur: 6, fill: true },
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
        ...HUD_STROKE,
      })
      .setVisible(false)
      .setDepth(1001);
    this.hud.add(this.powerTooltip);

    const hintLine =
      `${keyBindings.getKeyName('left')}/${keyBindings.getKeyName('right')}: Bouger · ` +
      `${keyBindings.getKeyName('jump')}/Espace: Sauter · ${keyBindings.getKeyName('interact')}: Interagir · ` +
      `${keyBindings.getKeyName('pause')}: Pause`;
    const controlHint = this.add.text(16, GAME_HEIGHT - 30, hintLine, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#8a7fa0',
      ...HUD_STROKE,
    });
    this.hud.add(controlHint);

    if (powerSystem.isTestMode() && gameState.currentZone !== EPILOGUE_ZONE_ID) {
      this.testBanner = this.add.text(
        16,
        44,
        'MODE ADMIN — F1: chapitres · N: noclip · ESC: menu',
        { fontFamily: 'monospace', fontSize: '13px', color: '#4ae08a', ...HUD_STROKE },
      );
      this.hud.add(this.testBanner);
    }
  }

  /** LIVES_START + une par vie bonus ramassée (cf. EntityLifePickup) — un maximum permanent,
   * distinct du compte courant qui repart plein à chaque nouvelle session (cf. create()). */
  private get maxLives(): number {
    return LIVES_START + gameState.collectedLifePickups.size;
  }

  private updateLivesDisplay(): void {
    // À 3 vies ou moins, on n'affiche que les 3 cœurs de départ (pleins/vides) plutôt que la
    // rangée complète jusqu'au maximum (qui peut grossir avec les vies bonus, cf. maxLives) —
    // sans ça, être presque mort avec plusieurs vies bonus en réserve affichait une longue rangée
    // de cœurs vides à côté d'un ou deux pleins, illisible comme "en danger".
    const total = this.lives <= LIVES_START ? LIVES_START : this.maxLives;
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)) + '♡'.repeat(Math.max(0, total - this.lives)));
  }

  /** Vie bonus (cf. EntityLifePickup) : augmente le maximum ET le compte courant tout de suite,
   * pas seulement au prochain repos plein — sans ça, ramasser une vie juste avant de mourir
   * n'aurait aucun effet avant la prochaine session. */
  private collectLifePickup(entity: Extract<ZoneEntity, { type: 'life_pickup' }>, sprite: Phaser.GameObjects.Sprite): void {
    if (gameState.collectedLifePickups.has(entity.id)) return;
    gameState.collectedLifePickups.add(entity.id);
    sprite.destroy();
    const glowIdx = this.lifePickupGlows.findIndex((g) => g.id === entity.id);
    if (glowIdx >= 0) {
      this.lifePickupGlows[glowIdx].glow.destroy();
      this.lifePickupGlows.splice(glowIdx, 1);
    }
    this.lives += 1;
    this.updateLivesDisplay();
    audioManager.play(this, SFX_KEYS.SHARD_COLLECT, { volume: 0.5 });
    this.toast('Vie supplémentaire trouvée !');
    persistProgress(this.player.x, this.player.y, true);
  }

  private updateZoneLabel(): void {
    // L'épilogue n'a délibérément pas d'entrée dans levels.json (cf. EPILOGUE_ZONE_ID) — sans
    // quoi il réapparaîtrait comme un 9e "chapitre" dans les sélecteurs de zone admin, qui
    // parcourent directement levels.json (cf. MenuScene.openZoneSelect) plutôt que listZoneIds().
    if (gameState.currentZone === EPILOGUE_ZONE_ID) {
      this.zoneLabel.setText('Le Havre');
      return;
    }
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

  /** Notification "★ Catégorie : x/y" à chaque progression d'un succès (gardien vaincu, créature
   * sauvée, éclat recueilli, fin découverte) — cf. getAchievementProgress pour les 4 catégories,
   * cohérentes avec le panneau Succès du menu (mais lues en direct, pas depuis la sauvegarde). */
  private showAchievementToast(key: AchievementCategory['key']): void {
    const category = getAchievementProgress().find((c) => c.key === key);
    if (!category) return;
    this.achievementToastText.setText(`★ ${category.label} : ${category.done}/${category.total}`);
    this.achievementToastText.setAlpha(1);
    this.tweens.add({ targets: this.achievementToastText, alpha: 0, delay: 2400, duration: 500 });
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
    // Panneau bois (UI Medieval, cf. ACKNOWLEDGEMENTS.md) derrière le titre + les boutons — la
    // pancarte suspendue lit naturellement comme un panneau "Pause" affiché en jeu plutôt que le
    // simple aplat sombre précédent.
    const panelSrc = this.textures.get(TEX.UI_PANEL).source[0];
    const panelH = 500;
    const panelW = panelH * (panelSrc.width / panelSrc.height);
    const panel = this.add.image(GAME_WIDTH / 2, 360, TEX.UI_PANEL).setDisplaySize(panelW, panelH);
    // Le panneau (panel_wood.png) a une accroche/chaîne décorative sur son quart supérieur, PAS
    // encore la planche elle-même (cf. mesure pixel par pixel de l'asset : la bordure haute de la
    // planche ne commence réellement qu'à ~34% de sa hauteur) — le titre à y=240 tombait dans cette
    // zone d'accroche plutôt que sur la planche, chevauchant son rivet décoratif. Redescendu ici
    // dans la planche, avec les boutons décalés d'autant pour garder le même espacement entre eux.
    const pauseIcon = this.add.image(GAME_WIDTH / 2 - 110, 292, TEX.UI_ICON_PAUSE).setDisplaySize(32, 32);
    // Blanc + contour noir plutôt que le doré utilisé ailleurs pour ce genre de titre : ce doré
    // se distingue mal du bois orangé du panneau (deux teintes trop proches), contrairement aux
    // autres endroits où ce doré se détache d'un fond sombre.
    const title = this.add.text(GAME_WIDTH / 2, 292, 'Pause', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const hoverSfx = () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 });
    const resumeBtn = new Button(this, GAME_WIDTH / 2, 352, 'Reprendre (ESC)', {
      minWidth: 220,
      fontSize: '16px',
      onHover: hoverSfx,
      onClick: () => this.togglePauseMenu(),
    });
    const optionsBtn = new Button(this, GAME_WIDTH / 2, 408, 'Options', {
      minWidth: 220,
      fontSize: '16px',
      onHover: hoverSfx,
      onClick: () => this.openOptions(),
    });
    const fullscreenLabel = () => (isFullscreen(this) ? 'Quitter le plein écran' : '⛶ Plein écran');
    const fullscreenBtn = new Button(this, GAME_WIDTH / 2, 464, fullscreenLabel(), {
      minWidth: 220,
      fontSize: '16px',
      onHover: hoverSfx,
      onClick: () => {
        toggleFullscreen(this);
        fullscreenBtn.setLabel(fullscreenLabel());
      },
    });
    const quitBtn = new Button(this, GAME_WIDTH / 2, 520, 'Quitter vers le menu', {
      minWidth: 220,
      fontSize: '16px',
      textColor: '#c56b6b',
      hoverTextColor: '#ff9a9a',
      onHover: hoverSfx,
      onClick: () => {
        if (!powerSystem.isTestMode()) persistProgress(this.player.x, this.player.y);
        // cf. showGameOver : un dialogue/tutoriel/puzzle resté lancé (ex. le mini tutoriel
        // différé d'un pouvoir déjà débloqué) survit sinon à la transition et reste affiché
        // par-dessus le menu, bloquant tout clic sur les écrans suivants (Mode Admin y compris).
        this.closeOverlayScenes();
        this.scene.start(SCENE_KEYS.MENU);
      },
    });
    container.add([
      overlay,
      panel,
      pauseIcon,
      title,
      resumeBtn.container,
      optionsBtn.container,
      fullscreenBtn.container,
      quitBtn.container,
    ]);
    this.cameras.main.ignore(container);
    this.pauseMenu = container;
  }

  /** Rappel des commandes (Tab) — toutes les actions remappables (cf. KeyBindings), pas juste
   * le résumé abrégé du HUD (déplacement/saut/interagir/pause, cf. controlHint) qui omettait
   * dash/forme ombre/attaque. Purement informatif, fermé par Tab ou Échap. */
  private toggleControlsOverlay(): void {
    if (this.controlsOverlay) {
      audioManager.play(this, SFX_KEYS.UI_CANCEL);
      this.controlsOverlay.destroy();
      this.controlsOverlay = undefined;
      return;
    }
    audioManager.play(this, SFX_KEYS.UI_SELECT);
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0a16, 0.9);
    container.add(overlay);

    const title = this.add
      .text(GAME_WIDTH / 2, 90, 'Commandes', { fontFamily: 'monospace', fontSize: '28px', color: '#d8b34a' })
      .setOrigin(0.5);
    container.add(title);

    // Deux colonnes (commandes de base à gauche, combos à droite) : les 4 combos, chacun sur 2
    // lignes (nom + composition), ne tenaient plus sous les 8 commandes en une seule colonne.
    const leftX = GAME_WIDTH / 2 - 280;
    const rightX = GAME_WIDTH / 2 + 220;
    const rowHeight = 44;
    const startY = 170;
    CONTROL_ACTIONS.forEach((action, i) => {
      const row = this.add
        .text(leftX - 20, startY + i * rowHeight, `${ACTION_LABELS[action]}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#e8e2f0',
        })
        .setOrigin(1, 0.5);
      const key = this.add
        .text(leftX + 20, startY + i * rowHeight, keyBindings.getKeyName(action), {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#d8b34a',
          backgroundColor: '#1a1428',
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0, 0.5);
      container.add([row, key]);
    });
    // Alias fixe (jamais remappable, cf. Player.spaceKey) toujours actif en plus de la touche Sauter.
    const spaceHint = this.add
      .text(leftX, startY + CONTROL_ACTIONS.length * rowHeight + 10, "Espace : saute aussi,\nquelle que soit la touche Sauter remappée", {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8a7fa0',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    container.add(spaceHint);

    // Combos (cf. PowerSystem.combos) : deux pouvoirs maintenus/actifs en même temps. Les
    // pouvoirs "passifs" (sans touche, cf. POWER_KEY_ACTION) agissent en continu une fois
    // débloqués — seule la touche du pouvoir "actif" de la paire doit vraiment être tenue.
    const combosTitle = this.add
      .text(rightX, startY - 36, 'Combos', { fontFamily: 'monospace', fontSize: '20px', color: '#d8b34a' })
      .setOrigin(0.5);
    container.add(combosTitle);
    const comboRowHeight = 62;
    powerSystem.combos.forEach((combo, i) => {
      const y = startY + i * comboRowHeight;
      // Chaque pouvoir affiche SA touche entre crochets — [auto] pour les pouvoirs passifs (cf.
      // POWER_KEY_ACTION), qui agissent en continu une fois débloqués, sans touche à tenir.
      const composition = combo.requires
        .map((p) => {
          const name = powerSystem.getDef(p)?.name ?? p;
          const action = POWER_KEY_ACTION[p];
          return `${name} [${action ? keyBindings.getKeyName(action) : 'auto'}]`;
        })
        .join(' + ');
      const name = this.add
        .text(rightX, y, combo.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffe27a' })
        .setOrigin(0.5);
      const comp = this.add
        .text(rightX, y + 20, composition, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#c9c2d9',
          align: 'center',
          wordWrap: { width: 340 },
        })
        .setOrigin(0.5, 0);
      container.add([name, comp]);
    });

    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Tab ou Échap : fermer', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7fa0' })
      .setOrigin(0.5);
    container.add(hint);

    this.cameras.main.ignore(container);
    this.controlsOverlay = container;
  }

  private openOptions(): void {
    if (this.optionsBox) {
      this.closeOptions();
      return;
    }
    this.optionsBox = buildOptionsOverlay(this, () => this.closeOptions());
    this.optionsBox.setDepth(2100);
    this.cameras.main.ignore(this.optionsBox);
  }

  private closeOptions(): void {
    this.optionsBox?.destroy();
    this.optionsBox = undefined;
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

    // Sur 2 colonnes (cf. columns: 2 ci-dessous), chaque colonne doit rester assez large pour
    // qu'un titre de chapitre tienne sur une seule ligne (comme en simple colonne) — sans quoi
    // le wordWrap ajoutait des lignes supplémentaires que itemHeight ne prévoyait pas, faisant
    // chevaucher les entrées entre elles. itemHeight agrandi (58→76) pour aérer les boutons entre
    // eux, et la grille centrée verticalement dans l'espace sous le titre plutôt que collée en haut.
    const listWidth = 1080;
    const itemHeight = 76;
    const rows = Math.ceil(listZoneIds().length / 2);
    const listHeight = rows * itemHeight;
    const listX = GAME_WIDTH / 2 - listWidth / 2;
    const listY = (GAME_HEIGHT - listHeight) / 2;

    const items = listZoneIds().map((zoneId) => {
      const meta = levelsData.zones.find((z) => z.id === zoneId);
      return {
        label: meta ? `${meta.chapterTitle}\n${meta.name}` : zoneId,
        onHover: () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 }),
        onClick: () => {
          audioManager.play(this, SFX_KEYS.UI_CONFIRM);
          startTestMode(zoneId);
          this.toggleDebugZoneMenu();
          void this.loadZone(zoneId);
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
      columns: 2,
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
