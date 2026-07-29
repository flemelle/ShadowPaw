import Phaser from 'phaser';
import { TEX, SFX_KEYS, TILE_SIZE, ANIM_KEYS } from '@/utils/Constants';
import type { BossDef } from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';

const PATROL_RANGE = 90; // px de part et d'autre du point d'apparition
const HIT_FLASH_MS = 120;
const CONTACT_COOLDOWN_MS = 800; // évite de ré-appliquer les dégâts de contact frame après frame
const HIT_INVULN_MS = 400; // > durée de la fenêtre d'attaque du joueur (cf. Player.ATTACK_DURATION_MS)
const MIRROR_HISTORY_FRAMES = 60; // ~1s à 60fps, cf. bossDef.pattern === 'mirror'
const KNOCKBACK_MS = 160;
const KNOCKBACK_SPEED = 240;

/**
 * IA de combat du boss final (pattern 'phases3' — cf. updateBossCombatAI) : machine à états
 * approche/avant-coup/attaque/récupération, inspirée des conventions de boss de metroidvania
 * (phases liées aux PV, attaques variées et TÉLÉGRAPHIÉES avant de frapper pour rester lisibles/
 * justes, fenêtre de récupération qui punit un boss trop agressif). Trois attaques distinctes
 * débloquées progressivement selon les PV restants plutôt que toutes disponibles d'emblée.
 */
type BossState = 'approach' | 'telegraph' | 'attack' | 'recover';
type BossAttack = 'dash' | 'orb' | 'shockwave';

const BOSS_INITIAL_DELAY_MS = 1200; // grâce avant le tout premier avant-coup, le temps que le joueur s'oriente
// Malakar apparaît d'abord sous sa forme démoniaque (même skin que son portrait de dialogue,
// cf. Constants.NPC_SKINS) avant de se transformer en esprit-chat spectral pour le combat réel —
// immobile pendant ce délai, le temps que la transformation se lise clairement.
const BOSS_TRANSFORM_MS = 1800;
const BOSS_TELEGRAPH_MS = 550; // cf. recherche "telegraphing" : lisible, pas juste un flash d'un quart de seconde
const BOSS_DASH_MS = 450;
const BOSS_DASH_SPEED_MULT = 3.2;
const BOSS_RECOVER_MS = 700; // fenêtre de punition : le boss est lent, prévisible, juste après avoir attaqué
const BOSS_RECOVER_SPEED_MULT = 0.35;
const BOSS_ORB_SPEED = 220;
const BOSS_ORB_MAX_TRAVEL = 480; // px avant auto-extinction (évite qu'une orbe rate voyage indéfiniment)
const BOSS_SHOCKWAVE_RADIUS = 100;
const BOSS_SHOCKWAVE_ACTIVE_MS = 300;
const BOSS_SHOCKWAVE_MELEE_RANGE = 150; // choisie seulement si le joueur est déjà à portée de corps-à-corps
// Cooldown avant le prochain avant-coup, par palier de PV (index 0 = >66%, 1 = 33-66%, 2 = <33%) —
// s'accélère à mesure que le combat avance, cf. "escalating difficulty" dans la recherche.
const BOSS_DECISION_COOLDOWN_BY_PHASE = [1800, 1300, 900];

/** PV/vitesse d'un mob "normal" : croît avec la zone (1-8) ET le tier au sein de la zone (1-5). */
export function mobHp(zoneIndex: number, tier: number): number {
  return 2 + (zoneIndex - 1) + (tier - 1);
}
export function mobSpeed(zoneIndex: number, tier: number): number {
  return 30 + zoneIndex * 5 + tier * 4;
}

/**
 * Ennemi générique : patrouille de part et d'autre de son point d'apparition et inflige des
 * dégâts de contact au joueur, encaisse les dégâts de l'attaque du joueur. Les boss réutilisent
 * la même classe avec un `BossDef` (PV/vitesse plus hauts + un `pattern` de déplacement) plutôt
 * qu'une classe dédiée par boss — cf. message.txt pour le gimmick visé par chaque pattern.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private hp: number;
  private readonly maxHp: number;
  private readonly baseSpeed: number;
  private dir: 1 | -1 = 1;
  private readonly spawnX: number;
  private lastContactAt = -Infinity;
  private invulnerableUntil = -Infinity;
  private knockbackUntil = -Infinity;
  private readonly mirrorHistory: number[] = [];
  private defeated = false;
  private readonly groundTopByCol: (number | null)[];
  /** Teinte à restaurer après le flash blanc de dégâts — absente pour un sprite réel (catgirl,
   * chat, sanglier...) dont les couleurs propres ne doivent pas être écrasées par un aplat rouge. */
  private readonly restingTint?: number;
  readonly isBoss: boolean;
  readonly bossDef?: BossDef;

  // ---- IA de combat du boss final (pattern 'phases3' uniquement, cf. updateBossCombatAI) ----
  private bossState: BossState = 'approach';
  private bossStateUntil = -Infinity;
  private bossFightStarted = false;
  private nextDecisionAt = -Infinity;
  private chosenAttack: BossAttack = 'dash';
  private dashDir: 1 | -1 = 1;
  private telegraphFx?: Phaser.GameObjects.Sprite;
  private shockwaveFx?: Phaser.GameObjects.Sprite;
  private orbSprite?: Phaser.Physics.Arcade.Sprite;
  private orbActive = false;
  private orbTraveled = 0;
  private pendingShockwave?: { x: number; y: number; activeUntil: number; consumed: boolean };
  // ---- Transformation pré-combat de Malakar (cf. BOSS_TRANSFORM_MS) ----
  private isTransformed = true;
  private transformAt = -Infinity;
  private finalTexture?: string;
  private finalAnimKey?: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    speed: number,
    opts?: {
      isBoss?: boolean;
      bossDef?: BossDef;
      groundTopByCol?: (number | null)[];
      texture?: string;
      animKey?: string;
      preTransformTexture?: string;
      preTransformAnimKey?: string;
    },
  ) {
    super(scene, x, y, opts?.preTransformTexture ?? opts?.texture ?? TEX.ENEMY);
    scene.add.existing(this);
    this.spawnX = x;
    this.hp = hp;
    this.maxHp = hp;
    this.baseSpeed = speed;
    this.isBoss = opts?.isBoss ?? false;
    this.bossDef = opts?.bossDef;
    this.groundTopByCol = opts?.groundTopByCol ?? [];
    if (opts?.preTransformTexture) {
      this.isTransformed = false;
      this.finalTexture = opts.texture;
      this.finalAnimKey = opts.animKey;
    }
    // setScale AVANT physics.add.existing : le corps Arcade est dimensionné d'après la taille
    // affichée AU MOMENT de sa création et ne suit plus les changements de scale ensuite — un
    // boss agrandi après coup aurait gardé une hitbox (et donc un point de vérification de sol,
    // cf. hasGroundAhead) de la taille du sprite non agrandi.
    if (this.isBoss) {
      this.setScale(opts?.bossDef?.scale ?? 1.7);
      // Le losange générique (TEX.ENEMY) a besoin d'un accent rouge pour se lire comme "boss" ;
      // un vrai sprite (catgirl...) a déjà sa propre identité visuelle, pas touché.
      if (!opts?.texture) {
        this.restingTint = 0xff8a8a;
        this.setTint(this.restingTint);
      }
    }
    const initialAnimKey = opts?.preTransformAnimKey ?? opts?.animKey;
    if (initialAnimKey) this.play(initialAnimKey);
    scene.physics.add.existing(this);
    // Le boss final ('phases3') flotte sans gravité ni collider contre le sol (cf.
    // GameScene.startBossFight) — esprit-chat spectral, cohérent avec sa fiction, et ça évite un
    // vrai problème rencontré en le testant au sol : son corps (plus large qu'une tuile à l'échelle
    // 1.7) se faisait bloquer en continu par les coutures internes entre tuiles adjacentes du sol
    // (fait de nombreux sprites 32x32 individuels, pas d'un vrai Tilemap avec retrait des arêtes).
    // Dimensions resserrées sur le contenu opaque réel de ghost_cat_red_idle.png (frame 64x64,
    // union des bbox sur les 20 frames d'idle) plutôt que la frame entière, pour une griffure fidèle.
    if (this.isBoss && opts?.bossDef?.pattern === 'phases3') {
      const b = this.body as Phaser.Physics.Arcade.Body;
      b.setAllowGravity(false);
      b.setSize(49, 59).setOffset(10, 1);
    }
    // Généralisation du même principe (cf. BossDef.bodyFit) pour tout boss dont la frame source
    // contient une marge transparente notable — sans ça, le corps (frame entière par défaut) laisse
    // les pieds réels du personnage flotter au-dessus (ou sous, selon la marge) du bas du corps une
    // fois posé au sol, au lieu de coïncider avec lui.
    if (this.isBoss && opts?.bossDef?.bodyFit) {
      const { width, height, offsetX, offsetY } = opts.bossDef.bodyFit;
      (this.body as Phaser.Physics.Arcade.Body).setSize(width, height).setOffset(offsetX, offsetY);
    }
    // Pas de vélocité initiale ici : au chargement d'une zone, le premier pas de physique peut
    // s'exécuter plusieurs fois d'affilée (rattrapage du pas fixe de Phaser après le hoquet de
    // chargement des assets) avant même le premier appel à updateAI() — une vélocité posée à
    // l'aveugle ici (toujours vers la droite) se serait donc appliquée sans le moindre contrôle
    // de bord plusieurs fois de suite, capable de pousser un mob loin au-delà du rebord d'une
    // plateforme étroite avant que la logique de demi-tour n'ait la moindre chance de tourner.
    // Rester à vélocité nulle jusqu'au premier updateAI() (qui vérifie AVANT de bouger) garantit
    // qu'aucun déplacement, même le tout premier, ne saute ce contrôle.

    // FX du boss final créés ici, une seule fois, cachés — plutôt qu'à la demande lors du premier
    // avant-coup : GameScene.syncCameraIgnoreLists() (cf. bossFxSprites) tourne juste après la
    // création du boss (startBossFight), donc tout sprite créé PLUS TARD raterait cette passe et
    // se rendrait en double sur les deux caméras (le bug déjà rencontré avec les ennemis eux-mêmes).
    if (this.isBoss && this.bossDef?.pattern === 'phases3') {
      this.telegraphFx = scene.add.sprite(x, y, TEX.BOSS_TELEGRAPH_FX).setVisible(false).setDepth(15);
      this.shockwaveFx = scene.add.sprite(x, y, TEX.BOSS_SHOCKWAVE_FX).setVisible(false).setDepth(14);
      this.orbSprite = scene.add.sprite(x, y, TEX.BOSS_SHADOW_ORB_FX) as Phaser.Physics.Arcade.Sprite;
      this.orbSprite.setVisible(false).setDepth(15);
      scene.physics.add.existing(this.orbSprite);
      const orbBody = this.orbSprite.body as Phaser.Physics.Arcade.Body;
      orbBody.setAllowGravity(false);
      // Un corps Arcade actif (même invisible, même jamais tiré) reste physiquement solide et
      // bloquait le boss lui-même dès sa création (les deux partagent la même position de départ)
      // — désactivé au repos, réactivé seulement pendant le vol effectif (cf. fireOrb/updateOrb).
      orbBody.enable = false;
    }
  }

  /** Sprites annexes du boss (télégraphe, orbe, onde de choc) — cf. GameScene.syncCameraIgnoreLists,
   * qui doit aussi les ignorer sur la caméra HUD sans quoi ils se rendraient en double. */
  get bossFxSprites(): Phaser.GameObjects.GameObject[] {
    return [this.telegraphFx, this.shockwaveFx, this.orbSprite].filter(
      (s): s is Phaser.GameObjects.Sprite => s != null,
    );
  }

  get currentHp(): number {
    return this.hp;
  }

  get maxHitPoints(): number {
    return this.maxHp;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  /** À appeler chaque frame par GameScene avec la position du joueur (pattern 'mirror'/boss) et `delta`
   * (avancement des attaques du boss indépendant du framerate). */
  updateAI(playerX: number, playerY: number, time: number, delta: number): void {
    if (this.defeated) return;
    // L'orbe continue son vol même pendant le recul (knockback) du boss : un tir déjà lâché ne
    // doit pas se figer en l'air simplement parce que le corps du boss encaisse un coup.
    this.updateOrb(delta);
    // Laisse le recul (cf. takeDamage) porter l'ennemi sans que l'IA n'écrase sa vélocité au
    // frame suivant : sans cette fenêtre, setVelocityX ci-dessous (patrouille/mirror) annulerait
    // l'impulsion de recul dès la frame suivante, la rendant invisible en jeu.
    if (time < this.knockbackUntil) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const pattern = this.bossDef?.pattern;

    if (pattern === 'phases3' && this.isBoss) {
      this.updateBossCombatAI(playerX, playerY, time, body);
      return;
    }

    if (pattern === 'mirror') {
      this.mirrorHistory.push(playerX);
      if (this.mirrorHistory.length > MIRROR_HISTORY_FRAMES) this.mirrorHistory.shift();
      const target = this.mirrorHistory[0] ?? playerX;
      const dx = target - this.x;
      const speed = this.currentSpeed();
      body.setVelocityX(Phaser.Math.Clamp(dx * 4, -speed, speed));
      this.setFlipX(dx < 0);
      return;
    }

    if (pattern === 'erratic_fast' && Math.random() < 0.02) this.dir = this.dir === 1 ? -1 : 1;

    // Demi-tour au mur, en bout de zone de patrouille, OU si le prochain pas tomberait dans le
    // vide (pas de mur à un rebord de plateforme/fosse, donc rien ne l'arrêterait sinon — le mob
    // marchait alors hors de la zone et tombait de la carte).
    const hitWall = this.dir === 1 ? body.blocked.right : body.blocked.left;
    const pastRange = this.dir === 1 ? this.x >= this.spawnX + PATROL_RANGE : this.x <= this.spawnX - PATROL_RANGE;
    const aboutToFall = body.blocked.down && !this.hasGroundAhead(this.dir);
    if (hitWall || pastRange || aboutToFall) this.dir = this.dir === 1 ? -1 : 1;

    body.setVelocityX(this.currentSpeed() * this.dir);
    // cf. BossDef.invertFacing : certains sprites (ex. le samouraï) lisent visuellement à l'envers
    // une fois passés par ce flip générique, malgré un sprite source vérifié droite-par-défaut —
    // ce correctif ne touche que l'orientation affichée, jamais `this.dir`/la vélocité elle-même.
    const faceLeft = this.bossDef?.invertFacing ? this.dir > 0 : this.dir < 0;
    this.setFlipX(faceLeft);
  }

  /** Palier de PV courant (0 = >66%, 1 = 33-66%, 2 = <33%) — determine la vitesse ET le pool d'attaques. */
  private phaseIndex(): number {
    const ratio = this.hp / this.maxHp;
    if (ratio <= 0.33) return 2;
    if (ratio <= 0.66) return 1;
    return 0;
  }

  /**
   * Machine à états du boss final : approche (chasse le joueur au sol) -> avant-coup (immobile,
   * FX de télégraphe lisible) -> attaque (exécute le pattern choisi) -> récupération (lent,
   * fenêtre de punition) -> retour à l'approche. Le pool d'attaques s'élargit avec les PV qui
   * baissent (cf. pickAttack) : le combat ne devient réellement complet qu'en phase 3.
   */
  private updateBossCombatAI(playerX: number, playerY: number, time: number, body: Phaser.Physics.Arcade.Body): void {
    // Ce boss flotte sans gravité ni collider de sol (cf. constructor) : rien d'autre ici ne
    // pilote jamais l'axe Y. Sans ce reset, l'impulsion verticale du recul de takeDamage
    // (setVelocity(dir*KNOCKBACK_SPEED, -80)) restait figée à -80 pour toujours une fois la
    // fenêtre de knockback passée (aucune gravité pour la ramener à 0, aucun sol pour l'arrêter),
    // envoyant le boss dériver vers le haut à vitesse constante jusqu'à sortir du monde.
    body.setVelocityY(0);
    if (!this.isTransformed) {
      if (this.transformAt === -Infinity) this.transformAt = time + BOSS_TRANSFORM_MS;
      body.setVelocityX(0);
      if (time >= this.transformAt) this.transform();
      return;
    }

    if (!this.bossFightStarted) {
      this.bossFightStarted = true;
      this.nextDecisionAt = time + BOSS_INITIAL_DELAY_MS;
    }

    switch (this.bossState) {
      case 'approach': {
        const dir: 1 | -1 = playerX >= this.x ? 1 : -1;
        body.setVelocityX(this.currentSpeed() * dir);
        this.setFlipX(dir < 0);
        if (time >= this.nextDecisionAt) this.startTelegraph(playerX, time);
        break;
      }
      case 'telegraph': {
        body.setVelocityX(0);
        if (time >= this.bossStateUntil) this.executeAttack(playerX, playerY, time);
        break;
      }
      case 'attack': {
        if (this.chosenAttack === 'dash') {
          body.setVelocityX(this.currentSpeed() * BOSS_DASH_SPEED_MULT * this.dashDir);
          this.setFlipX(this.dashDir < 0);
        } else {
          body.setVelocityX(0);
        }
        if (time >= this.bossStateUntil) this.enterRecover(time);
        break;
      }
      case 'recover': {
        const dir: 1 | -1 = playerX >= this.x ? 1 : -1;
        body.setVelocityX(this.currentSpeed() * BOSS_RECOVER_SPEED_MULT * dir);
        this.setFlipX(dir < 0);
        if (time >= this.bossStateUntil) this.bossState = 'approach';
        break;
      }
    }

    if (this.pendingShockwave && !this.pendingShockwave.consumed && time >= this.pendingShockwave.activeUntil) {
      this.pendingShockwave = undefined;
    }
  }

  /** Choisit la prochaine attaque : pool élargi par palier de PV, corps-à-corps réservé aux cas où
   * le joueur est déjà à portée (sinon un joueur à distance ne verrait jamais dash/orbe). */
  private pickAttack(playerX: number): BossAttack {
    const phase = this.phaseIndex();
    const dist = Math.abs(playerX - this.x);
    const pool: BossAttack[] = phase === 0 ? ['dash'] : phase === 1 ? ['dash', 'orb'] : ['dash', 'orb', 'shockwave'];
    const usable = pool.filter((a) => a !== 'shockwave' || dist <= BOSS_SHOCKWAVE_MELEE_RANGE);
    return usable[Math.floor(Math.random() * usable.length)];
  }

  /** Bascule de la forme démoniaque (immobile, cf. BOSS_TRANSFORM_MS) vers l'esprit-chat spectral
   * qui mène le combat réel — un éclat d'onde de choc (déjà créé/positionné, cf. constructor)
   * accompagne le changement de texture plutôt qu'un flash instantané peu lisible. */
  private transform(): void {
    this.isTransformed = true;
    if (this.finalTexture) this.setTexture(this.finalTexture);
    if (this.finalAnimKey) this.play(this.finalAnimKey);
    audioManager.play(this.scene, SFX_KEYS.PIVOT_ABSORB, { volume: 0.6 });
    if (this.shockwaveFx) {
      this.shockwaveFx.setPosition(this.x, this.y).setVisible(true).setScale(1.6).play(ANIM_KEYS.BOSS_SHOCKWAVE);
    }
  }

  private startTelegraph(playerX: number, time: number): void {
    this.chosenAttack = this.pickAttack(playerX);
    this.dashDir = playerX >= this.x ? 1 : -1;
    this.bossState = 'telegraph';
    this.bossStateUntil = time + BOSS_TELEGRAPH_MS;
    audioManager.play(this.scene, SFX_KEYS.SHADOW_FORM, { volume: 0.5 });
    if (this.telegraphFx) {
      this.telegraphFx.setPosition(this.x, this.y - 10).setVisible(true).play(ANIM_KEYS.BOSS_TELEGRAPH);
    }
    // Pulsation physique du boss lui-même (en plus du FX dédié) : deux signaux redondants pour
    // qu'un joueur qui regarderait le boss plutôt que le FX au-dessus voie quand même venir le coup.
    this.scene.tweens.add({ targets: this, scale: this.scaleX * 1.12, yoyo: true, duration: BOSS_TELEGRAPH_MS / 2 });
  }

  private executeAttack(playerX: number, playerY: number, time: number): void {
    this.bossState = 'attack';
    if (this.chosenAttack === 'orb') {
      this.fireOrb(playerX, playerY);
      this.bossStateUntil = time + 150;
    } else if (this.chosenAttack === 'shockwave') {
      this.triggerShockwave(time);
      this.bossStateUntil = time + 150;
    } else {
      audioManager.play(this.scene, SFX_KEYS.DASH, { volume: 0.6 });
      this.bossStateUntil = time + BOSS_DASH_MS;
    }
  }

  private enterRecover(time: number): void {
    this.bossState = 'recover';
    this.bossStateUntil = time + BOSS_RECOVER_MS;
    this.nextDecisionAt = this.bossStateUntil + BOSS_DECISION_COOLDOWN_BY_PHASE[this.phaseIndex()];
  }

  /** Lance l'orbe d'ombre visée sur la position DU JOUEUR AU MOMENT DU TIR (x ET y — un joueur
   * réfugié sur une plateforme en hauteur n'est pas à l'abri pour autant), sans tracking ensuite :
   * cf. recherche, une attaque téléguidée en continu retire toute possibilité d'esquive juste. */
  private fireOrb(playerX: number, playerY: number): void {
    if (!this.orbSprite) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    this.orbActive = true;
    this.orbTraveled = 0;
    const orbBody = this.orbSprite.body as Phaser.Physics.Arcade.Body;
    orbBody.enable = true;
    this.orbSprite
      .setPosition(this.x, this.y)
      .setVisible(true)
      .setFlipX(Math.cos(angle) < 0)
      .play(ANIM_KEYS.BOSS_SHADOW_ORB);
    orbBody.setVelocity(Math.cos(angle) * BOSS_ORB_SPEED, Math.sin(angle) * BOSS_ORB_SPEED);
    audioManager.play(this.scene, SFX_KEYS.ATTACK_SWING, { volume: 0.5 });
  }

  /** Avance l'orbe et l'éteint après sa portée max (cf. BOSS_ORB_MAX_TRAVEL) — indépendant de
   * l'état courant du boss : une orbe déjà lâchée continue son vol pendant l'avant-coup suivant. */
  private updateOrb(delta: number): void {
    if (!this.orbActive || !this.orbSprite) return;
    this.orbTraveled += BOSS_ORB_SPEED * (delta / 1000);
    if (this.orbTraveled >= BOSS_ORB_MAX_TRAVEL) {
      this.deactivateOrb();
    }
  }

  /** Éteint l'orbe et désactive son corps physique — un corps actif, même invisible et immobile,
   * reste solide et bloquait le boss lui-même (les deux partagent la position de départ au repos). */
  private deactivateOrb(): void {
    if (!this.orbSprite) return;
    this.orbActive = false;
    this.orbSprite.setVisible(false);
    const orbBody = this.orbSprite.body as Phaser.Physics.Arcade.Body;
    orbBody.setVelocity(0, 0);
    orbBody.enable = false;
  }

  private triggerShockwave(time: number): void {
    this.pendingShockwave = { x: this.x, y: this.y, activeUntil: time + BOSS_SHOCKWAVE_ACTIVE_MS, consumed: false };
    if (this.shockwaveFx) {
      this.shockwaveFx.setPosition(this.x, this.y).setVisible(true).play(ANIM_KEYS.BOSS_SHOCKWAVE);
    }
    audioManager.play(this.scene, SFX_KEYS.PUZZLE_FAIL, { volume: 0.6 });
  }

  /**
   * Le boss inflige-t-il un dégât de zone/à distance ce tour (orbe ou onde de choc) ? Appelé par
   * GameScene.resolveCombat() en plus du contact de corps déjà géré ailleurs (le dash EST le corps
   * du boss, donc déjà couvert par la collision normale joueur/ennemi). Consomme le hasard
   * touché (une orbe/onde ne peut toucher qu'une fois).
   */
  checkBossHazards(playerBounds: Phaser.Geom.Rectangle, time: number): boolean {
    if (this.orbActive && this.orbSprite && Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, this.orbSprite.getBounds())) {
      this.deactivateOrb();
      return true;
    }
    // `time <= activeUntil` en plus de `!consumed` : le nettoyage de pendingShockwave (cf.
    // updateBossCombatAI) peut être retardé de quelques frames par un recul (knockback) qui gèle
    // la machine à états, sans quoi la fenêtre resterait "vivante" et touchable plus longtemps
    // que BOSS_SHOCKWAVE_ACTIVE_MS ne le prévoit.
    if (this.pendingShockwave && !this.pendingShockwave.consumed && time <= this.pendingShockwave.activeUntil) {
      const dist = Phaser.Math.Distance.Between(
        playerBounds.centerX,
        playerBounds.centerY,
        this.pendingShockwave.x,
        this.pendingShockwave.y,
      );
      if (dist <= BOSS_SHOCKWAVE_RADIUS) {
        this.pendingShockwave.consumed = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Y a-t-il du sol dans la colonne de tuile suivante ? (cf. updateAI, évite les chutes.) Lit
   * directement la grille de tuiles plutôt qu'un capteur physique à distance fixe : un capteur
   * peut se faire tromper par un chevauchement d'un seul pixel pile à la frontière d'une tuile ou
   * par une ondulation de terrain, alors que la grille elle-même ne laisse aucune ambiguïté.
   */
  private hasGroundAhead(dir: 1 | -1): boolean {
    if (this.groundTopByCol.length === 0) return true; // pas de données passées par GameScene : ne bloque jamais
    const body = this.body as Phaser.Physics.Arcade.Body;
    // 0.75 tuile au-delà du bord du corps : garantit d'être pleinement dans la colonne SUIVANTE,
    // quelle que soit la position exacte du mob par rapport à la frontière de tuile courante.
    const aheadX = this.x + dir * (body.width / 2 + TILE_SIZE * 0.75);
    const nextCol = Math.floor(aheadX / TILE_SIZE);
    if (nextCol < 0 || nextCol >= this.groundTopByCol.length) return false;
    const nextGroundRow = this.groundTopByCol[nextCol];
    if (nextGroundRow == null) return false; // pas de sol du tout dans cette colonne = fosse

    const currentCol = Math.floor(this.x / TILE_SIZE);
    const currentGroundRow = this.groundTopByCol[currentCol] ?? nextGroundRow;
    // Tolère une petite marche (ondulation de terrain), pas un vrai vide : au-delà, il ne s'agit
    // plus d'un sol qui continue mais d'une chute que la marche à pied ne permet pas de suivre.
    return Math.abs(nextGroundRow - currentGroundRow) <= 2;
  }

  /** Paliers de vitesse sous certains seuils de PV, pour les patterns 'phases'/'phases3'. */
  private currentSpeed(): number {
    if (!this.bossDef || (this.bossDef.pattern !== 'phases' && this.bossDef.pattern !== 'phases3')) return this.baseSpeed;
    if (this.bossDef.pattern === 'phases3') return this.baseSpeed * (1 + this.phaseIndex() * 0.5);
    const ratio = this.hp / this.maxHp;
    return this.baseSpeed * (1 + (ratio <= 0.5 ? 1 : 0) * 0.5);
  }

  /**
   * Retourne `true` si ce coup achève l'ennemi. `time` gère une brève invulnérabilité après
   * chaque coup reçu — sans elle, la fenêtre d'attaque du joueur (plusieurs frames) toucherait
   * le même ennemi une fois par frame plutôt qu'une fois par coup de griffe. `time` DOIT être
   * l'horloge de scène Phaser (`scene.time.now`, cf. tous les appels réels dans GameScene),
   * pas une epoch Unix (`Date.now()`) : `knockbackUntil`/`invulnerableUntil` sont comparés à ce
   * même référentiel dans updateAI, et une horloge murale la rendrait à jamais dans le futur.
   */
  takeDamage(amount: number, time: number, sourceX?: number): boolean {
    if (this.defeated || time < this.invulnerableUntil) return false;
    this.invulnerableUntil = time + HIT_INVULN_MS;
    this.hp -= amount;
    if (sourceX != null) {
      const dir = this.x >= sourceX ? 1 : -1;
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(dir * KNOCKBACK_SPEED, -80);
      this.knockbackUntil = time + KNOCKBACK_MS;
    }
    audioManager.play(this.scene, SFX_KEYS.ENEMY_HIT, { volume: 0.5 });
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.defeated) return;
      if (this.restingTint != null) this.setTint(this.restingTint);
      else this.clearTint();
    });
    if (this.hp <= 0) {
      this.defeated = true;
      return true;
    }
    return false;
  }

  canContactHurt(time: number): boolean {
    return time - this.lastContactAt > CONTACT_COOLDOWN_MS;
  }

  markContact(time: number): void {
    this.lastContactAt = time;
    this.playAttackAnimation();
  }

  /** Joue l'animation de coup le temps d'un contact réussi sur le joueur (cf. BossDef.attackAnimKey),
   * puis reprend le cycle de marche normal — sans quoi le boss reste figé sur son anim de marche
   * même en train de frapper. Pas de retour si déjà vaincu (défaite en même temps qu'un dernier
   * coup) ni pour un boss sans anim d'attaque dédiée (silencieusement ignoré). */
  private playAttackAnimation(): void {
    const key = this.bossDef?.attackAnimKey;
    const restingKey = this.bossDef?.animKey;
    if (!key || this.defeated) return;
    this.play(key);
    if (restingKey) {
      this.once(`animationcomplete-${key}`, () => {
        if (!this.defeated) this.play(restingKey);
      });
    }
  }

  /** Petite animation de disparition avant destruction réelle (cf. GameScene). */
  playDefeatedAnimation(onComplete: () => void): void {
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    audioManager.play(this.scene, SFX_KEYS.ENEMY_DEFEATED, { volume: 0.5 });
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: this.scaleX * 1.4,
      scaleY: this.scaleY * 1.4,
      duration: 300,
      onComplete: () => {
        this.destroy();
        onComplete();
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.telegraphFx?.destroy();
    this.shockwaveFx?.destroy();
    this.orbSprite?.destroy();
    super.destroy(fromScene);
  }
}
