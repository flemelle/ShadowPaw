import powersData from '@/data/powers.json';
import { EventBus, GameEvents } from '@/utils/EventBus';
import type { PowerId, ComboId } from '@/utils/Constants';
import { POWER_IDS } from '@/utils/Constants';

export interface PowerDef {
  id: PowerId;
  name: string;
  icon: string;
  act: 1 | 2;
  obtainedFrom: string;
  unlocksZone: string;
  effect: string;
  traversal: { type: string; tileCode?: string; durationMs?: number; description: string };
}

export interface ComboDef {
  id: ComboId;
  name: string;
  requires: PowerId[];
  trigger: string;
  effect: string;
}

/**
 * Gère l'état des pouvoirs débloqués + la détection des combos.
 * En Mode Admin, `testMode = true` débloque tous les pouvoirs en mémoire
 * sans jamais toucher à la sauvegarde de progression normale.
 */
export class PowerSystem {
  readonly powers: PowerDef[] = powersData.powers as PowerDef[];
  readonly combos: ComboDef[] = powersData.combos as ComboDef[];

  private unlocked = new Set<PowerId>();
  private active = new Set<PowerId>();
  private testMode = false;

  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
    if (enabled) {
      POWER_IDS.forEach((p) => this.unlocked.add(p));
    }
    EventBus.emit(GameEvents.TEST_MODE_CHANGED, enabled);
  }

  isTestMode(): boolean {
    return this.testMode;
  }

  loadUnlocked(ids: PowerId[]): void {
    this.unlocked = new Set(ids);
  }

  getUnlocked(): PowerId[] {
    return [...this.unlocked];
  }

  has(power: PowerId): boolean {
    return this.testMode || this.unlocked.has(power);
  }

  unlock(power: PowerId): void {
    if (this.unlocked.has(power)) return;
    this.unlocked.add(power);
    const def = this.powers.find((p) => p.id === power);
    EventBus.emit(GameEvents.POWER_UNLOCKED, def);
  }

  /** Active/désactive un pouvoir "tenu" (ex: Éclat de Lumière + Forme ombre maintenus ensemble). */
  setActive(power: PowerId, isActive: boolean): void {
    if (!this.has(power)) return;
    if (isActive) this.active.add(power);
    else this.active.delete(power);
    this.checkCombos();
  }

  private checkCombos(): void {
    for (const combo of this.combos) {
      const allActive = combo.requires.every((p) => this.active.has(p));
      if (allActive) {
        EventBus.emit(GameEvents.COMBO_TRIGGERED, combo);
      }
    }
  }

  getDef(power: PowerId): PowerDef | undefined {
    return this.powers.find((p) => p.id === power);
  }
}
