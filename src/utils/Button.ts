import Phaser from 'phaser';

export interface ButtonOptions {
  fontSize?: string;
  textColor?: string;
  hoverTextColor?: string;
  bgColor?: number;
  hoverBgColor?: number;
  borderColor?: number;
  hoverBorderColor?: number;
  paddingX?: number;
  paddingY?: number;
  minWidth?: number;
  onClick: () => void;
  onHover?: () => void;
}

const DEFAULTS: Required<Omit<ButtonOptions, 'onClick' | 'onHover' | 'minWidth'>> = {
  fontSize: '22px',
  textColor: '#e8e2f0',
  hoverTextColor: '#ffe9b0',
  bgColor: 0x1a1428,
  hoverBgColor: 0x2e2350,
  borderColor: 0x4a3f6a,
  hoverBorderColor: 0xd8b34a,
  paddingX: 20,
  paddingY: 12,
};

/**
 * Bouton texte + fond arrondi avec transition douce (couleur + échelle interpolées sur
 * ~160ms) au survol, plutôt qu'un simple `setColor` instantané sur du texte à plat.
 * Utilisé partout où le jeu affiche un bouton cliquable (menus, pause, options...).
 */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly w: number;
  private readonly h: number;
  private readonly opts: typeof DEFAULTS & ButtonOptions;
  private tweenState = { t: 0 };
  private activeTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, options: ButtonOptions) {
    this.opts = { ...DEFAULTS, ...options };

    this.label = scene.add
      .text(0, 0, text, { fontFamily: 'monospace', fontSize: this.opts.fontSize, color: this.opts.textColor, align: 'center' })
      .setOrigin(0.5);

    this.w = Math.max(this.opts.minWidth ?? 0, this.label.width + this.opts.paddingX * 2);
    this.h = this.label.height + this.opts.paddingY * 2;

    this.bg = scene.add.graphics();
    this.draw(0);

    this.container = scene.add.container(x, y, [this.bg, this.label]);
    this.container.setSize(this.w, this.h);
    this.container.setInteractive({ useHandCursor: true });

    this.container.on('pointerover', () => {
      this.opts.onHover?.();
      this.animateTo(1);
    });
    this.container.on('pointerout', () => this.animateTo(0));
    this.container.on('pointerdown', this.opts.onClick);
  }

  private animateTo(target: number): void {
    this.activeTween?.stop();
    this.activeTween = this.container.scene.tweens.add({
      targets: this.tweenState,
      t: target,
      duration: 160,
      ease: 'Quad.easeOut',
      onUpdate: () => this.draw(this.tweenState.t),
    });
  }

  private draw(t: number): void {
    const fill = lerpColor(this.opts.bgColor, this.opts.hoverBgColor, t);
    const stroke = lerpColor(this.opts.borderColor, this.opts.hoverBorderColor, t);
    this.bg.clear();
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
    this.bg.lineStyle(2, stroke, 1);
    this.bg.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 8);
    this.label.setColor(lerpColorCss(this.opts.textColor, this.opts.hoverTextColor, t));
    this.container?.setScale(1 + t * 0.035);
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  destroy(): void {
    this.activeTween?.stop();
    this.container.destroy(true);
  }
}

function lerpColor(fromHex: number, toHex: number, t: number): number {
  const from = Phaser.Display.Color.IntegerToColor(fromHex);
  const to = Phaser.Display.Color.IntegerToColor(toHex);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
  return Phaser.Display.Color.GetColor(Math.round(c.r), Math.round(c.g), Math.round(c.b));
}

function lerpColorCss(fromCss: string, toCss: string, t: number): string {
  const from = Phaser.Display.Color.HexStringToColor(fromCss);
  const to = Phaser.Display.Color.HexStringToColor(toCss);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
  return Phaser.Display.Color.RGBToString(Math.round(c.r), Math.round(c.g), Math.round(c.b));
}
