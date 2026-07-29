import Phaser from 'phaser';
import {
  SCENE_KEYS,
  TEX,
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  ASSET_BASE,
  MUSIC_KEYS,
  SFX_KEYS,
  FOOTSTEP_VARIANTS,
  ZONE_FLOOR_TEX,
  DECOR_PATHS,
  REAL_TEX_PATHS,
  ANIM_KEYS,
  CAT_DECOR_VARIANTS,
  NPC_SKINS,
} from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';
import { isTestModeRequestedFromURL } from '@/systems/GameState';
import { PROLOGUE_SEEN_KEY } from '@/scenes/PrologueScene';

const FOREST_LAYER_INDICES = Array.from({ length: 12 }, (_, i) => i);

/**
 * Charge les assets réels (musique, SFX, décors parallax — cf. ACKNOWLEDGEMENTS.md)
 * et génère les textures de gameplay procéduralement (silhouettes de tuiles/marqueurs,
 * volontairement simples : l'art de personnage/combat reste hors scope).
 */
export class BootScene extends Phaser.Scene {
  private progressBox!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    this.buildLoadingBar();

    // --- Musique du menu seulement ici (~5 Mo) : les pistes de zone (~45 Mo) sont
    // chargées à la demande par AudioManager.playMusic(), pour que le menu soit
    // interactif au plus vite (cf. Constants.MUSIC_PATHS).
    this.load.audio(MUSIC_KEYS.MENU, `${ASSET_BASE}/audio/music/menu.ogg`);

    // --- SFX ---
    const sfxFile: Record<string, string> = {
      [SFX_KEYS.UI_HOVER]: 'ui_hover',
      [SFX_KEYS.UI_CONFIRM]: 'ui_confirm',
      [SFX_KEYS.UI_SELECT]: 'ui_select',
      [SFX_KEYS.UI_CANCEL]: 'ui_cancel',
      [SFX_KEYS.DIALOG_ADVANCE]: 'dialog_advance',
      [SFX_KEYS.PAUSE_OPEN]: 'pause_open',
      [SFX_KEYS.PAUSE_CLOSE]: 'pause_close',
      [SFX_KEYS.POWER_UNLOCK]: 'power_unlock',
      [SFX_KEYS.COMBO_TRIGGER]: 'combo_trigger',
      [SFX_KEYS.PUZZLE_SOLVED]: 'puzzle_solved',
      [SFX_KEYS.PUZZLE_FAIL]: 'puzzle_fail',
      [SFX_KEYS.BOSS_DEFEATED]: 'boss_defeated',
      [SFX_KEYS.PIVOT_STING]: 'pivot_sting',
      [SFX_KEYS.PIVOT_ABSORB]: 'pivot_absorb',
      [SFX_KEYS.ENDING_POSITIVE]: 'ending_positive',
      [SFX_KEYS.ENDING_NEGATIVE]: 'ending_negative',
      [SFX_KEYS.SHARD_COLLECT]: 'shard_collect',
      [SFX_KEYS.DASH]: 'dash',
      [SFX_KEYS.ZONE_TRANSITION]: 'zone_transition',
      [SFX_KEYS.SHADOW_FORM]: 'shadow_form',
      [SFX_KEYS.ATTACK_SWING]: 'dash',
      [SFX_KEYS.ENEMY_HIT]: 'combo_trigger',
      [SFX_KEYS.ENEMY_DEFEATED]: 'shard_collect',
      [SFX_KEYS.PLAYER_HURT]: 'puzzle_fail',
    };
    Object.entries(sfxFile).forEach(([key, file]) => {
      this.load.audio(key, `${ASSET_BASE}/audio/sfx/${file}.wav`);
    });
    [...FOOTSTEP_VARIANTS.ACT_1, ...FOOTSTEP_VARIANTS.ACT_2].forEach((key) => {
      const file = key.replace('sfx_', '');
      this.load.audio(key, `${ASSET_BASE}/audio/sfx/${file}.wav`);
    });

    // --- Décors parallax ---
    FOREST_LAYER_INDICES.forEach((i) => {
      const n = String(i).padStart(2, '0');
      this.load.image(`bg_forest_${n}`, `${ASSET_BASE}/images/backgrounds/forest/layer_${n}.png`);
    });
    ['00', '01', '02'].forEach((n) => {
      this.load.image(`bg_stringstar_${n}`, `${ASSET_BASE}/images/backgrounds/stringstar/layer_${n}.png`);
    });
    ['00', '01', '02', '03'].forEach((n) => {
      this.load.image(`bg_graveyard_${n}`, `${ASSET_BASE}/images/backgrounds/graveyard/layer_${n}.png`);
    });
    ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'].forEach((n) => {
      this.load.image(`bg_pinehills_${n}`, `${ASSET_BASE}/images/backgrounds/pinehills/layer_${n}.png`);
    });

    // --- Textures de sol par zone (pré-teintées, cf. Constants.ZONE_FLOOR_TEX) ---
    // L'épilogue (zone9) n'a pas de floor_zoneN.png pré-généré — sa texture de sol est procédurale
    // (cf. generateTileTexture(TEX.FLOOR_EPILOGUE, ...) plus bas), pas un fichier à charger ici.
    Object.entries(ZONE_FLOOR_TEX).forEach(([zoneId, texKey]) => {
      if (texKey === TEX.FLOOR_EPILOGUE) return;
      const n = zoneId.match(/^zone(\d)/)?.[1];
      this.load.image(texKey, `${ASSET_BASE}/images/tiles/floor_zone${n}.png`);
    });

    // --- Décors dispersés dans les niveaux ---
    Object.entries(DECOR_PATHS).forEach(([key, path]) => {
      this.load.image(key, path);
    });

    // --- Mobs/boss/PNJ réels (cf. Constants.REAL_TEX_PATHS) : statiques ou feuilles de sprites
    // pour celles avec une animation d'idle (32x32 pour les chats/sanglier, 48x48/64x64 pour les boss).
    [
      TEX.MOB_CAT,
      TEX.MOB_SKULL,
      TEX.UI_PANEL,
      TEX.UI_ICON_PLAY,
      TEX.UI_ICON_PAUSE,
      TEX.ADMIN_ICON,
      TEX.POWER_ICON_CLAWS,
      TEX.POWER_ICON_VISION,
      TEX.POWER_ICON_DASH,
      TEX.POWER_ICON_SHADOW,
      TEX.POWER_ICON_LIGHT,
    ].forEach((key) => {
      this.load.image(key, REAL_TEX_PATHS[key]);
    });
    this.load.spritesheet(TEX.PLAYER_IDLE, REAL_TEX_PATHS[TEX.PLAYER_IDLE], { frameWidth: 46, frameHeight: 58 });
    this.load.spritesheet(TEX.PLAYER_WALK, REAL_TEX_PATHS[TEX.PLAYER_WALK], { frameWidth: 46, frameHeight: 58 });
    this.load.spritesheet(TEX.MOB_BOAR, REAL_TEX_PATHS[TEX.MOB_BOAR], { frameWidth: 40, frameHeight: 32 });
    this.load.spritesheet(TEX.RESCUE_CAT, REAL_TEX_PATHS[TEX.RESCUE_CAT], { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet(TEX.RESCUE_CAT_RUN, REAL_TEX_PATHS[TEX.RESCUE_CAT_RUN], { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet(TEX.CATGIRL_BOSS, REAL_TEX_PATHS[TEX.CATGIRL_BOSS], { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet(TEX.GHOST_CAT_BLUE, REAL_TEX_PATHS[TEX.GHOST_CAT_BLUE], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.GHOST_CAT_RED, REAL_TEX_PATHS[TEX.GHOST_CAT_RED], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.PLAYER_ATTACK_FX, REAL_TEX_PATHS[TEX.PLAYER_ATTACK_FX], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.HIT_IMPACT_FX, REAL_TEX_PATHS[TEX.HIT_IMPACT_FX], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.DASH_IMPACT_FX, REAL_TEX_PATHS[TEX.DASH_IMPACT_FX], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.BOSS_TELEGRAPH_FX, REAL_TEX_PATHS[TEX.BOSS_TELEGRAPH_FX], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.BOSS_SHADOW_ORB_FX, REAL_TEX_PATHS[TEX.BOSS_SHADOW_ORB_FX], { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(TEX.BOSS_SHOCKWAVE_FX, REAL_TEX_PATHS[TEX.BOSS_SHOCKWAVE_FX], { frameWidth: 64, frameHeight: 64 });
    for (const { texture } of CAT_DECOR_VARIANTS) {
      this.load.spritesheet(texture, REAL_TEX_PATHS[texture], { frameWidth: 32, frameHeight: 32 });
    }
    for (const { texture, frameSize } of NPC_SKINS) {
      this.load.spritesheet(texture, REAL_TEX_PATHS[texture], { frameWidth: frameSize ?? 32, frameHeight: frameSize ?? 32 });
    }
  }

  create(): void {
    this.progressBox.destroy();
    this.progressBar.destroy();
    this.progressLabel.destroy();

    audioManager.attach(this);

    this.generateTileTexture(TEX.BREAKABLE, 0x8a5a2e, true);
    this.generateTileTexture(TEX.HIDDEN, 0x2a2a3a, false, 0.35);
    this.generateTileTexture(TEX.DASH_GATE, 0x3fb5b0, true);
    this.generateTileTexture(TEX.SHADOW_WALL, 0x5a2e8a, false, 0.55);
    this.generateTileTexture(TEX.LIGHT_OBSTACLE, 0xd8b34a, true);
    // Sol de l'épilogue : brun chaleureux (pas de floor_zoneN.png pré-généré pour cette zone bonus,
    // cf. Constants.ZONE_FLOOR_TEX/ACKNOWLEDGEMENTS.md — Pine Hills n'est qu'un décor peint).
    this.generateTileTexture(TEX.FLOOR_EPILOGUE, 0x7a5230, true);

    this.generateGlowTexture();
    this.generatePortraitTextures();
    this.generateStoneGuardianTexture();
    this.generateMarkerTexture(TEX.NPC, 0x4ac9e0, 'circle');
    this.generateMarkerTexture(TEX.BOSS_ARENA, 0xd63b3b, 'diamond');
    this.generateMarkerTexture(TEX.ZONE_EXIT, 0x4ae08a, 'arrow');
    this.generateMarkerTexture(TEX.PUZZLE_TRIGGER, 0xd8b34a, 'square');
    this.generateMarkerTexture(TEX.POWER_ALTAR, 0xffffff, 'star');
    this.generateMarkerTexture(TEX.SHARD, 0xffe27a, 'shard');
    this.generateMarkerTexture(TEX.LIFE_PICKUP, 0xff4d6d, 'heart');
    this.generateMarkerTexture(TEX.ENEMY, 0x8a1f3a, 'spike');

    const particle = this.make.graphics({ x: 0, y: 0 });
    particle.fillStyle(0xffffff, 1);
    particle.fillCircle(4, 4, 4);
    particle.generateTexture(TEX.PARTICLE, 8, 8);
    particle.destroy();

    // --- Animations d'idle pour les mobs/PNJ/boss en vrais sprites ---
    this.anims.create({
      key: ANIM_KEYS.PLAYER_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_IDLE, { start: 0, end: 9 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.PLAYER_WALK,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_WALK, { start: 0, end: 23 }),
      frameRate: 18,
      repeat: -1,
    });
    // Pas de pose dédiée dans le pack "sample" (idle/walk uniquement) : on réutilise deux poses
    // dynamiques déjà présentes dans le cycle de marche — jambes repliées (saut) et grande
    // foulée (dash) — plutôt que de figer l'idle/la marche pendant ces actions.
    this.anims.create({
      key: ANIM_KEYS.PLAYER_JUMP,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_WALK, { start: 9, end: 9 }),
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.PLAYER_DASH,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_WALK, { start: 4, end: 4 }),
      frameRate: 1,
      repeat: -1,
    });
    // Bras/lame tendus vers l'avant (frame 3 du cycle de marche) — accompagne le swipe d'énergie
    // (cf. Player.playAttackFx) pendant la fenêtre d'attaque active.
    this.anims.create({
      key: ANIM_KEYS.PLAYER_ATTACK_POSE,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_WALK, { start: 3, end: 3 }),
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.BOAR_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.MOB_BOAR, { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.RESCUE_CAT_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.RESCUE_CAT, { start: 0, end: 6 }),
      frameRate: 6,
      repeat: -1,
    });
    // Cycle de saut (le pack n'offre pas de course à proprement parler, cf. ACKNOWLEDGEMENTS.md)
    // utilisé comme fuite une fois le chat libéré — une suite de bonds reste lisible comme "il
    // détale" pour un petit chat en pixel art, cf. GameScene.rescueCaptive.
    this.anims.create({
      key: ANIM_KEYS.RESCUE_CAT_RUN,
      frames: this.anims.generateFrameNumbers(TEX.RESCUE_CAT_RUN, { start: 0, end: 12 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.CATGIRL_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.CATGIRL_BOSS, { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.SAMURAI_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.BOSS_SAMURAI, { start: 0, end: 9 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.GHOST_CAT_BLUE_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.GHOST_CAT_BLUE, { start: 0, end: 19 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.GHOST_CAT_RED_IDLE,
      frames: this.anims.generateFrameNumbers(TEX.GHOST_CAT_RED, { start: 0, end: 19 }),
      frameRate: 10,
      repeat: -1,
    });
    // Éclair d'attaque de Kiba + impact d'un coup qui touche (RPG Effect All Free, cf.
    // ACKNOWLEDGEMENTS.md) — la même feuille de rafale (9 teintes x 8 frames de fondu) fournie
    // déjà dans la palette gris/violet du joueur (ligne violette) pour l'attaque, et une teinte
    // vive orange/rouge (ligne orange) pour l'impact sur l'ennemi touché.
    this.anims.create({
      key: ANIM_KEYS.PLAYER_ATTACK_SWIPE,
      frames: this.anims.generateFrameNumbers(TEX.PLAYER_ATTACK_FX, { start: 0, end: 7 }),
      frameRate: 24,
      repeat: 0,
    });
    this.anims.create({
      key: ANIM_KEYS.HIT_IMPACT,
      frames: this.anims.generateFrameNumbers(TEX.HIT_IMPACT_FX, { start: 0, end: 7 }),
      frameRate: 24,
      repeat: 0,
    });
    // Distincte de la griffure normale (cyan plutôt qu'orange) : le dash fantôme est une attaque
    // à part (traverse/exécute au contact), pas une simple griffure plus forte.
    this.anims.create({
      key: ANIM_KEYS.DASH_IMPACT,
      frames: this.anims.generateFrameNumbers(TEX.DASH_IMPACT_FX, { start: 0, end: 7 }),
      frameRate: 24,
      repeat: 0,
    });
    // IA de combat de Malakar (cf. entities/BossController.ts) — même pack RPG Effect All Free,
    // teintes encore inutilisées jusqu'ici (cramoisi ligne 8, indigo ligne 9 de leurs feuilles
    // respectives). frameRate plus lent que les impacts joueur : un avant-coup de boss doit être
    // lisible (cf. recherche sur le "telegraphing"), pas juste un flash d'un quart de seconde.
    this.anims.create({
      key: ANIM_KEYS.BOSS_TELEGRAPH,
      frames: this.anims.generateFrameNumbers(TEX.BOSS_TELEGRAPH_FX, { start: 0, end: 7 }),
      frameRate: 14,
      repeat: 0,
    });
    this.anims.create({
      key: ANIM_KEYS.BOSS_SHADOW_ORB,
      frames: this.anims.generateFrameNumbers(TEX.BOSS_SHADOW_ORB_FX, { start: 0, end: 7 }),
      frameRate: 16,
      repeat: -1,
    });
    this.anims.create({
      key: ANIM_KEYS.BOSS_SHOCKWAVE,
      frames: this.anims.generateFrameNumbers(TEX.BOSS_SHOCKWAVE_FX, { start: 0, end: 7 }),
      frameRate: 20,
      repeat: 0,
    });
    for (const { texture, animKey } of CAT_DECOR_VARIANTS) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 6 }),
        frameRate: 5,
        repeat: -1,
      });
    }
    for (const { texture, animKey } of NPC_SKINS) {
      // rescue_cat_epilogue (cf. Constants.NPC_SKINS) réutilise TEX.RESCUE_CAT/son anim déjà
      // enregistrée juste au-dessus (ANIM_KEYS.RESCUE_CAT_IDLE) — recréer la même clé ici
      // déclenchait un avertissement Phaser sans effet (la première définition l'emporte).
      if (this.anims.exists(animKey)) continue;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 6 }),
        frameRate: 5,
        repeat: -1,
      });
    }

    const skipPrologue = isTestModeRequestedFromURL() || localStorage.getItem(PROLOGUE_SEEN_KEY) === '1';
    this.scene.start(skipPrologue ? SCENE_KEYS.MENU : SCENE_KEYS.PROLOGUE);
  }

  private buildLoadingBar(): void {
    this.cameras.main.setBackgroundColor(0x05040a);
    const barW = 480;
    const barH = 20;
    const x = GAME_WIDTH / 2 - barW / 2;
    const y = GAME_HEIGHT / 2;

    this.add
      .text(GAME_WIDTH / 2, y - 50, 'SHADOWPAW', { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#d8b34a' })
      .setOrigin(0.5);

    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(2, 0xd8b34a, 0.8);
    this.progressBox.strokeRect(x, y, barW, barH);

    this.progressBar = this.add.graphics();
    this.progressLabel = this.add
      .text(GAME_WIDTH / 2, y + 34, 'Chargement...', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7fa0' })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xd8b34a, 1);
      this.progressBar.fillRect(x + 3, y + 3, (barW - 6) * value, barH - 6);
      this.progressLabel.setText(`Chargement... ${Math.round(value * 100)}%`);
    });
  }

  private generateTileTexture(key: string, color: number, hatch = false, alpha = 1): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, alpha);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0x000000, 0.25);
    g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    if (hatch) {
      g.lineStyle(2, 0x000000, 0.2);
      g.lineBetween(0, TILE_SIZE, TILE_SIZE, 0);
      g.lineBetween(0, TILE_SIZE / 2, TILE_SIZE / 2, 0);
      g.lineBetween(TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, TILE_SIZE / 2);
    }
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  /** Halo doux (dégradé radial approximé par cercles superposés) — aura de lumière de Kiba dans les zones sombres. */
  private generateGlowTexture(): void {
    // Grand et progressif plutôt qu'intense : dégradé quadratique (doux au centre,
    // très doux vers les bords) sur beaucoup de pas pour éviter tout effet de bande.
    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const g = this.make.graphics({ x: 0, y: 0 });
    const steps = 50;
    const peakAlpha = 0.22;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      const r = t * (size / 2);
      const alpha = peakAlpha * (1 - t) * (1 - t);
      g.fillStyle(0xffe9b0, alpha);
      g.fillCircle(cx, cy, r);
    }
    g.generateTexture(TEX.PLAYER_GLOW, size, size);
    g.destroy();
  }

  /**
   * Grandes silhouettes pour l'overlay de dialogue (cf. DialogScene) : mêmes formes
   * simples que les textures de gameplay, juste agrandies — pas d'art de personnage
   * détaillé (hors scope, cf. message.txt), seulement des silhouettes reconnaissables.
   */
  private generatePortraitTextures(): void {
    const w = 220;
    const h = 360;

    // Moine encapuchonné : silhouette de robe + yeux luminescents, cf. Tozen dans les dialogues.
    const npc = this.make.graphics({ x: 0, y: 0 });
    const robeTop = 70;
    npc.fillStyle(0x241a33, 1);
    npc.fillTriangle(w / 2, robeTop - 40, w / 2 - 60, robeTop + 30, w / 2 + 60, robeTop + 30);
    npc.beginPath();
    npc.moveTo(w / 2 - 45, robeTop + 20);
    npc.lineTo(w / 2 + 45, robeTop + 20);
    npc.lineTo(w / 2 + 85, h);
    npc.lineTo(w / 2 - 85, h);
    npc.closePath();
    npc.fillPath();
    npc.fillStyle(0x4ac9e0, 0.85);
    npc.fillCircle(w / 2 - 16, robeTop + 15, 5);
    npc.fillCircle(w / 2 + 16, robeTop + 15, 5);
    npc.generateTexture(TEX.NPC_PORTRAIT, w, h);
    npc.destroy();
  }

  /** Le Gardien de Pierre (boss zone1) — aucun pack local ne fournit de golem/statue animée
   * (cf. ACKNOWLEDGEMENTS.md), donc silhouette procédurale plutôt qu'un skin déjà utilisé
   * ailleurs pour un autre boss : bloc rocheux massif, fissures, yeux incandescents. */
  private generateStoneGuardianTexture(): void {
    const w = 36;
    const h = 42;
    const g = this.make.graphics({ x: 0, y: 0 });

    g.fillStyle(0x5c5852, 1);
    g.fillRoundedRect(2, 10, w - 4, h - 12, 6);
    g.fillRoundedRect(8, 0, w - 16, 16, 5);

    g.fillStyle(0x716c64, 1);
    g.fillRect(4, 14, 9, 9);
    g.fillRect(w - 14, 20, 9, 8);
    g.fillRect(10, h - 16, 8, 8);

    g.lineStyle(2, 0x2e2b28, 0.8);
    g.lineBetween(w / 2 - 6, 6, w / 2 - 10, 20);
    g.lineBetween(w / 2 + 4, 22, w / 2 + 9, h - 10);
    g.lineBetween(6, h - 14, 14, h - 6);

    g.fillStyle(0xff8a3d, 0.35);
    g.fillCircle(w / 2 - 7, 8, 4);
    g.fillCircle(w / 2 + 7, 8, 4);
    g.fillStyle(0xffb877, 1);
    g.fillCircle(w / 2 - 7, 8, 2);
    g.fillCircle(w / 2 + 7, 8, 2);

    g.generateTexture(TEX.BOSS_STONE_GUARDIAN, w, h);
    g.destroy();
  }

  private generateMarkerTexture(key: string, color: number, shape: 'circle' | 'diamond' | 'arrow' | 'square' | 'star' | 'shard' | 'spike' | 'heart'): void {
    const size = 28;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 0.9);
    g.lineStyle(2, 0xffffff, 0.8);
    const c = size / 2;
    switch (shape) {
      case 'circle':
        g.fillCircle(c, c, c - 2);
        g.strokeCircle(c, c, c - 2);
        break;
      case 'diamond':
        g.beginPath();
        g.moveTo(c, 2);
        g.lineTo(size - 2, c);
        g.lineTo(c, size - 2);
        g.lineTo(2, c);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'arrow':
        g.beginPath();
        g.moveTo(4, 4);
        g.lineTo(size - 4, c);
        g.lineTo(4, size - 4);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'square':
        g.fillRoundedRect(3, 3, size - 6, size - 6, 4);
        g.strokeRoundedRect(3, 3, size - 6, size - 6, 4);
        break;
      case 'star':
      case 'shard':
        g.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? c - 2 : c / 2.4;
          const px = c + r * Math.cos(ang);
          const py = c + r * Math.sin(ang);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      // Silhouette "hérissée" (8 pointes) — distincte des marqueurs UI ronds/lisses, pour se lire
      // immédiatement comme une menace plutôt qu'un élément d'interface.
      case 'spike':
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const ang = (Math.PI * 2 * i) / 16 - Math.PI / 2;
          const r = i % 2 === 0 ? c - 1 : c / 2.2;
          const px = c + r * Math.cos(ang);
          const py = c + r * Math.sin(ang);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      // Vie bonus à ramasser (cf. EntityLifePickup) — deux lobes + une pointe, lisible
      // immédiatement comme un cœur même à cette taille, cohérent avec les ♥ du HUD.
      case 'heart':
        g.fillCircle(c - c / 2.6, c - c / 6, c / 2.4);
        g.fillCircle(c + c / 2.6, c - c / 6, c / 2.4);
        g.beginPath();
        g.moveTo(2, c - c / 5);
        g.lineTo(c, size - 3);
        g.lineTo(size - 2, c - c / 5);
        g.closePath();
        g.fillPath();
        break;
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
