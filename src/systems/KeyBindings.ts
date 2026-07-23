import Phaser from 'phaser';

const STORAGE_KEY = 'shadowpaw_keybindings_v1';

export type ControlAction = 'left' | 'right' | 'jump' | 'dash' | 'shadowForm' | 'interact' | 'attack' | 'pause';

export const CONTROL_ACTIONS: ControlAction[] = ['left', 'right', 'jump', 'dash', 'shadowForm', 'interact', 'attack', 'pause'];

export const ACTION_LABELS: Record<ControlAction, string> = {
  left: 'Gauche',
  right: 'Droite',
  jump: 'Sauter',
  dash: 'Dash fantôme',
  shadowForm: 'Forme ombre',
  interact: 'Interagir',
  attack: 'Attaquer',
  pause: 'Pause / Menu',
};

export const DEFAULT_BINDINGS: Record<ControlAction, number> = {
  left: Phaser.Input.Keyboard.KeyCodes.LEFT,
  right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
  jump: Phaser.Input.Keyboard.KeyCodes.UP,
  dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
  shadowForm: Phaser.Input.Keyboard.KeyCodes.Q,
  interact: Phaser.Input.Keyboard.KeyCodes.E,
  attack: Phaser.Input.Keyboard.KeyCodes.X,
  pause: Phaser.Input.Keyboard.KeyCodes.ESC,
};

/** Traduit un code Phaser (= KeyboardEvent.keyCode) en nom lisible, ex. 16 -> "Shift". */
export function keyCodeToName(code: number): string {
  const entry = Object.entries(Phaser.Input.Keyboard.KeyCodes).find(([, v]) => v === code);
  if (!entry) return `#${code}`;
  const [name] = entry;
  const overrides: Record<string, string> = {
    LEFT: '←',
    RIGHT: '→',
    UP: '↑',
    DOWN: '↓',
    SPACE: 'Espace',
    ESC: 'Échap',
    SHIFT: 'Shift',
  };
  return overrides[name] ?? name;
}

/**
 * Contrôles remappables (Options du menu + pause en jeu), persistés en localStorage.
 * Une seule touche par action (pas d'alias WASD/Espace caché) pour que remapper une
 * touche ait un effet réel et prévisible plutôt que de coexister avec un ancien réglage.
 */
class KeyBindingsManager {
  private bindings: Record<ControlAction, number>;
  private keys: Partial<Record<ControlAction, Phaser.Input.Keyboard.Key>> = {};
  private scene?: Phaser.Scene;

  constructor() {
    this.bindings = this.load();
  }

  private load(): Record<ControlAction, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_BINDINGS };
      return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_BINDINGS };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
  }

  getKeyCode(action: ControlAction): number {
    return this.bindings[action];
  }

  getKeyName(action: ControlAction): string {
    return keyCodeToName(this.bindings[action]);
  }

  /** À appeler une fois par scène de gameplay (GameScene.create()) pour instancier les Key. */
  attach(scene: Phaser.Scene): void {
    this.scene = scene;
    this.keys = {};
    CONTROL_ACTIONS.forEach((action) => {
      this.keys[action] = scene.input.keyboard!.addKey(this.bindings[action]);
    });
  }

  rebind(action: ControlAction, keyCode: number): void {
    this.bindings[action] = keyCode;
    this.save();
    if (this.scene) {
      const old = this.keys[action];
      if (old) this.scene.input.keyboard!.removeKey(old);
      this.keys[action] = this.scene.input.keyboard!.addKey(keyCode);
    }
  }

  resetDefaults(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.save();
    if (this.scene) this.attach(this.scene);
  }

  isDown(action: ControlAction): boolean {
    return this.keys[action]?.isDown ?? false;
  }

  justDown(action: ControlAction): boolean {
    const k = this.keys[action];
    return k ? Phaser.Input.Keyboard.JustDown(k) : false;
  }
}

export const keyBindings = new KeyBindingsManager();
