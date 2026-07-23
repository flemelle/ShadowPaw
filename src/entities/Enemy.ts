import Phaser from 'phaser';
import { TEX, SFX_KEYS } from '@/utils/Constants';
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
  readonly isBoss: boolean;
  readonly bossDef?: BossDef;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, speed: number, opts?: { isBoss?: boolean; bossDef?: BossDef }) {
    super(scene, x, y, TEX.ENEMY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.spawnX = x;
    this.hp = hp;
    this.maxHp = hp;
    this.baseSpeed = speed;
    this.isBoss = opts?.isBoss ?? false;
    this.bossDef = opts?.bossDef;
    if (this.isBoss) this.setScale(1.7).setTint(0xff8a8a);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.baseSpeed * this.dir);
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
    if (body.blocked.left || this.x <= this.spawnX - PATROL_RANGE) this.dir = 1;
    else if (body.blocked.right || this.x >= this.spawnX + PATROL_RANGE) this.dir = -1;

    body.setVelocityX(this.currentSpeed() * this.dir);
    this.setFlipX(this.dir < 0);
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
      if (!this.defeated) this.isBoss ? this.setTint(0xff8a8a) : this.clearTint();
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
