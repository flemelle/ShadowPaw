import Phaser from 'phaser';
import { TEX, SFX_KEYS, FOOTSTEP_VARIANTS } from '@/utils/Constants';
import type { PowerSystem } from '@/systems/PowerSystem';
import { audioManager } from '@/systems/AudioManager';

const MOVE_SPEED = 200;
const JUMP_SPEED = 480;
const DASH_SPEED = 620;
const DASH_DURATION_MS = 180;
const SHADOW_FORM_DURATION_MS = 5000;
const FOOTSTEP_INTERVAL_MS = 320;
/** Coyote time + jump buffer : tolère quelques frames de retard/anticipation sur l'appui saut. */
const COYOTE_MS = 110;
const JUMP_BUFFER_MS = 110;

/**
 * Kiba — mouvement de plateforme et traversée liée aux pouvoirs uniquement.
 * Ni combat, ni points de vie, ni animations de personnage : hors scope
 * (cf. message.txt — "à part les mobs, les dynamiques de combats et les personnages").
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private isDashing = false;
  private dashUntil = 0;
  private isShadowForm = false;
  private shadowFormUntil = 0;
  private noclip = false;
  private footstepVariants: readonly string[] = FOOTSTEP_VARIANTS.ACT_1;
  private nextFootstepAt = 0;
  private lastGroundedAt = -Infinity;
  private jumpPressedAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly powers: PowerSystem) {
    super(scene, x, y, TEX.PLAYER);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(false);
    this.setBounce(0);
    this.setDragX(900);
    (this.body as Phaser.Physics.Arcade.Body).setMaxVelocity(DASH_SPEED, 900);

    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      dash: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      shadow: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      light: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };
  }

  setFootstepSurface(variants: readonly string[]): void {
    this.footstepVariants = variants;
  }

  setNoclip(enabled: boolean): void {
    this.noclip = enabled;
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(!enabled);
  }

  isNoclip(): boolean {
    return this.noclip;
  }

  isInShadowForm(): boolean {
    return this.isShadowForm;
  }

  update(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const jumpKeyDown = this.keys.up.isDown || this.keys.w.isDown || this.keys.space.isDown;
    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.w) ||
      Phaser.Input.Keyboard.JustDown(this.keys.space);

    if (body.blocked.down || body.touching.down) this.lastGroundedAt = time;
    if (jumpJustPressed) this.jumpPressedAt = time;

    if (this.noclip) {
      const down = this.keys.down.isDown;
      body.setVelocity(
        (left ? -1 : 0) * MOVE_SPEED + (right ? 1 : 0) * MOVE_SPEED,
        (jumpKeyDown ? -1 : 0) * MOVE_SPEED + (down ? 1 : 0) * MOVE_SPEED,
      );
    } else {
      if (!this.isDashing) {
        if (left) body.setVelocityX(-MOVE_SPEED);
        else if (right) body.setVelocityX(MOVE_SPEED);
        else body.setVelocityX(0);

        // Coyote time (grâce après avoir quitté une plateforme) + jump buffer (anticipation avant l'atterrissage).
        const canCoyoteJump = time - this.lastGroundedAt <= COYOTE_MS;
        const hasBufferedJump = time - this.jumpPressedAt <= JUMP_BUFFER_MS;
        if (hasBufferedJump && canCoyoteJump) {
          body.setVelocityY(-JUMP_SPEED);
          this.jumpPressedAt = -Infinity;
          this.lastGroundedAt = -Infinity;
        }
      }

      if (
        this.powers.has('dash_fantome') &&
        Phaser.Input.Keyboard.JustDown(this.keys.dash) &&
        !this.isDashing
      ) {
        this.startDash(time);
      }
      if (this.isDashing && time > this.dashUntil) {
        this.isDashing = false;
      }

      if (
        this.powers.has('forme_ombre') &&
        Phaser.Input.Keyboard.JustDown(this.keys.shadow) &&
        !this.isShadowForm
      ) {
        this.startShadowForm(time);
      }
      if (this.isShadowForm && time > this.shadowFormUntil) {
        this.isShadowForm = false;
      }
    }

    this.setFlipX(left && !right);
    this.setAlpha(this.isShadowForm ? 0.45 : 1);

    const grounded = (this.body as Phaser.Physics.Arcade.Body).blocked.down;
    const moving = (left || right) && !this.noclip;
    if (grounded && moving && time > this.nextFootstepAt) {
      this.nextFootstepAt = time + FOOTSTEP_INTERVAL_MS;
      const key = Phaser.Utils.Array.GetRandom(this.footstepVariants as string[]);
      audioManager.play(this.scene, key, { volume: 0.22 });
    }
  }

  private startDash(time: number): void {
    this.isDashing = true;
    this.dashUntil = time + DASH_DURATION_MS;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dir = this.flipX ? -1 : 1;
    body.setVelocityX(dir * DASH_SPEED);
    audioManager.play(this.scene, SFX_KEYS.DASH);
    this.powers.setActive('dash_fantome', true);
    this.scene.time.delayedCall(DASH_DURATION_MS, () => this.powers.setActive('dash_fantome', false));
  }

  private startShadowForm(time: number): void {
    this.isShadowForm = true;
    this.shadowFormUntil = time + SHADOW_FORM_DURATION_MS;
    audioManager.play(this.scene, SFX_KEYS.SHADOW_FORM, { volume: 0.4 });
    this.powers.setActive('forme_ombre', true);
    this.scene.time.delayedCall(SHADOW_FORM_DURATION_MS, () => this.powers.setActive('forme_ombre', false));
  }
}
