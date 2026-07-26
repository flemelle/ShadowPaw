import Phaser from 'phaser';
import { TEX, SFX_KEYS, TILE_SIZE } from '@/utils/Constants';
import type { BossDef } from '@/utils/Constants';
import { audioManager } from '@/systems/AudioManager';

const PATROL_RANGE = 90; // px de part et d'autre du point d'apparition
const HIT_FLASH_MS = 120;
const CONTACT_COOLDOWN_MS = 800; // évite de ré-appliquer les dégâts de contact frame après frame
const HIT_INVULN_MS = 400; // > durée de la fenêtre d'attaque du joueur (cf. Player.ATTACK_DURATION_MS)
const MIRROR_HISTORY_FRAMES = 60; // ~1s à 60fps, cf. bossDef.pattern === 'mirror'

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
  private readonly mirrorHistory: number[] = [];
  private defeated = false;
  private readonly groundTopByCol: (number | null)[];
  /** Teinte à restaurer après le flash blanc de dégâts — absente pour un sprite réel (catgirl,
   * chat, sanglier...) dont les couleurs propres ne doivent pas être écrasées par un aplat rouge. */
  private readonly restingTint?: number;
  readonly isBoss: boolean;
  readonly bossDef?: BossDef;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    speed: number,
    opts?: { isBoss?: boolean; bossDef?: BossDef; groundTopByCol?: (number | null)[]; texture?: string; animKey?: string },
  ) {
    super(scene, x, y, opts?.texture ?? TEX.ENEMY);
    scene.add.existing(this);
    this.spawnX = x;
    this.hp = hp;
    this.maxHp = hp;
    this.baseSpeed = speed;
    this.isBoss = opts?.isBoss ?? false;
    this.bossDef = opts?.bossDef;
    this.groundTopByCol = opts?.groundTopByCol ?? [];
    // setScale AVANT physics.add.existing : le corps Arcade est dimensionné d'après la taille
    // affichée AU MOMENT de sa création et ne suit plus les changements de scale ensuite — un
    // boss agrandi après coup aurait gardé une hitbox (et donc un point de vérification de sol,
    // cf. hasGroundAhead) de la taille du sprite non agrandi.
    if (this.isBoss) {
      this.setScale(1.7);
      // Le losange générique (TEX.ENEMY) a besoin d'un accent rouge pour se lire comme "boss" ;
      // un vrai sprite (catgirl...) a déjà sa propre identité visuelle, pas touché.
      if (!opts?.texture) {
        this.restingTint = 0xff8a8a;
        this.setTint(this.restingTint);
      }
    }
    if (opts?.animKey) this.play(opts.animKey);
    scene.physics.add.existing(this);
    // Pas de vélocité initiale ici : au chargement d'une zone, le premier pas de physique peut
    // s'exécuter plusieurs fois d'affilée (rattrapage du pas fixe de Phaser après le hoquet de
    // chargement des assets) avant même le premier appel à updateAI() — une vélocité posée à
    // l'aveugle ici (toujours vers la droite) se serait donc appliquée sans le moindre contrôle
    // de bord plusieurs fois de suite, capable de pousser un mob loin au-delà du rebord d'une
    // plateforme étroite avant que la logique de demi-tour n'ait la moindre chance de tourner.
    // Rester à vélocité nulle jusqu'au premier updateAI() (qui vérifie AVANT de bouger) garantit
    // qu'aucun déplacement, même le tout premier, ne saute ce contrôle.
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

  /** À appeler chaque frame par GameScene avec la position X courante du joueur (pattern 'mirror'). */
  updateAI(playerX: number): void {
    if (this.defeated) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const pattern = this.bossDef?.pattern;

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
    this.setFlipX(this.dir < 0);
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
    const ratio = this.hp / this.maxHp;
    const thresholds = this.bossDef.pattern === 'phases3' ? [0.66, 0.33] : [0.5];
    const stepsPassed = thresholds.filter((t) => ratio <= t).length;
    return this.baseSpeed * (1 + stepsPassed * 0.5);
  }

  /**
   * Retourne `true` si ce coup achève l'ennemi. `time` gère une brève invulnérabilité après
   * chaque coup reçu — sans elle, la fenêtre d'attaque du joueur (plusieurs frames) toucherait
   * le même ennemi une fois par frame plutôt qu'une fois par coup de griffe.
   */
  takeDamage(amount: number, time: number): boolean {
    if (this.defeated || time < this.invulnerableUntil) return false;
    this.invulnerableUntil = time + HIT_INVULN_MS;
    this.hp -= amount;
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
}
