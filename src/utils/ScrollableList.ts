import Phaser from 'phaser';

export interface ScrollableListItem {
  label: string;
  onClick: () => void;
  onHover?: () => void;
}

interface ScrollableListOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  itemHeight: number;
  items: ScrollableListItem[];
  textColor?: string;
  hoverColor?: string;
}

/**
 * Liste défilable minimale (molette + flèches haut/bas) pour les menus dont le
 * contenu peut dépasser la hauteur visible (ex. sélection de chapitre) — sans
 * dépendre de la taille exacte de la fenêtre du joueur.
 */
export class ScrollableList {
  readonly root: Phaser.GameObjects.Container;
  private inner: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScroll: number;
  private wheelHandler: (pointer: unknown, objs: unknown, dx: number, dy: number) => void;

  constructor(private readonly scene: Phaser.Scene, opts: ScrollableListOptions) {
    const { x, y, width, height, itemHeight, items, textColor = '#e8e2f0', hoverColor = '#d8b34a' } = opts;

    this.root = scene.add.container(x, y);
    this.inner = scene.add.container(0, 0);
    this.root.add(this.inner);

    items.forEach((item, i) => {
      const label = scene.add
        .text(width / 2, i * itemHeight, item.label, {
          fontFamily: 'monospace',
          fontSize: '17px',
          color: textColor,
          backgroundColor: '#1a1428',
          padding: { x: 12, y: 8 },
          align: 'center',
          wordWrap: { width: width - 40, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      label.on('pointerover', () => {
        label.setColor(hoverColor);
        item.onHover?.();
      });
      label.on('pointerout', () => label.setColor(textColor));
      label.on('pointerdown', item.onClick);
      this.inner.add(label);
    });

    const contentHeight = items.length * itemHeight;
    this.maxScroll = Math.max(0, contentHeight - height);

    const maskShape = scene.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(x, y, width, height);
    this.root.setMask(maskShape.createGeometryMask());
    // The mask graphics itself must not render as a visible shape.
    maskShape.setVisible(false);

    this.wheelHandler = (_p, _o, _dx, dy) => this.scrollBy(dy > 0 ? 40 : -40);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.wheelHandler);
  }

  scrollBy(delta: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScroll);
    this.inner.setY(-this.scrollY);
  }

  get isScrollable(): boolean {
    return this.maxScroll > 0;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.wheelHandler);
    this.root.destroy(true);
  }
}
