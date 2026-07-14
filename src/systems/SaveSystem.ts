import { SAVE_KEY, ZONE_IDS } from '@/utils/Constants';
import { EventBus, GameEvents } from '@/utils/EventBus';
import type { SaveData } from '@/utils/Types';

function defaultSave(): SaveData {
  return {
    version: 1,
    currentZone: ZONE_IDS[0],
    unlockedPowers: [],
    defeatedBosses: [],
    collectedShards: [],
    dialogFlags: {},
    solvedPuzzles: [],
    testMode: false,
    playerX: 0,
    playerY: 0,
  };
}

/**
 * Progression sauvegardée en localStorage. Le Mode Test ne touche jamais
 * cette sauvegarde : il tourne sur un état en mémoire séparé (voir PowerSystem/GameScene).
 */
export class SaveSystem {
  private static _data: SaveData | null = null;

  static load(): SaveData {
    if (this._data) return this._data;
    let data: SaveData;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      data = raw ? { ...defaultSave(), ...JSON.parse(raw) } : defaultSave();
    } catch {
      data = defaultSave();
    }
    this._data = data;
    return data;
  }

  static save(partial?: Partial<SaveData>): SaveData {
    const data = { ...this.load(), ...partial };
    this._data = data;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    EventBus.emit(GameEvents.GAME_SAVED, data);
    return data;
  }

  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static reset(): SaveData {
    localStorage.removeItem(SAVE_KEY);
    this._data = defaultSave();
    return this._data;
  }
}
