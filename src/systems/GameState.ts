import { PowerSystem } from './PowerSystem';
import { DialogSystem } from './DialogSystem';
import { PuzzleSystem } from './PuzzleSystem';
import { SaveSystem } from './SaveSystem';
import { ZONE_IDS, TEST_MODE_QUERY_FLAG } from '@/utils/Constants';
import type { PowerId } from '@/utils/Constants';

/**
 * Instances partagées entre toutes les scènes (Phaser instancie les scènes
 * séparément, donc les systèmes vivent ici plutôt que dans une scène précise).
 */
export const powerSystem = new PowerSystem();
export const dialogSystem = new DialogSystem();
export const puzzleSystem = new PuzzleSystem();

export const gameState = {
  currentZone: ZONE_IDS[0] as string,
  testMode: false,
  defeatedBosses: new Set<string>(),
};

export function isTestModeRequestedFromURL(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get(TEST_MODE_QUERY_FLAG) === '1';
}

export function startNewGame(): void {
  SaveSystem.reset();
  powerSystem.setTestMode(false);
  powerSystem.loadUnlocked([]);
  dialogSystem.loadFlags({});
  puzzleSystem.loadState([], []);
  gameState.currentZone = ZONE_IDS[0];
  gameState.testMode = false;
  gameState.defeatedBosses = new Set();
}

export function continueGame(): void {
  const save = SaveSystem.load();
  powerSystem.setTestMode(false);
  powerSystem.loadUnlocked(save.unlockedPowers as PowerId[]);
  dialogSystem.loadFlags(save.dialogFlags);
  puzzleSystem.loadState(save.solvedPuzzles, save.collectedShards);
  gameState.currentZone = save.currentZone;
  gameState.testMode = false;
  gameState.defeatedBosses = new Set(save.defeatedBosses);
}

/** Mode Test : tous les pouvoirs, aucune contrainte de progression, sauvegarde inchangée. */
export function startTestMode(zoneId?: string): void {
  powerSystem.setTestMode(true);
  dialogSystem.loadFlags({});
  puzzleSystem.loadState([], []);
  gameState.currentZone = zoneId ?? ZONE_IDS[0];
  gameState.testMode = true;
  gameState.defeatedBosses = new Set();
}

/** En Mode Test, tous les gates de progression (boss, autels, combos) sont ignorés. */
export function isGateOpen(): boolean {
  return gameState.testMode;
}

export function persistProgress(playerX: number, playerY: number): void {
  if (gameState.testMode) return;
  SaveSystem.save({
    currentZone: gameState.currentZone,
    unlockedPowers: powerSystem.getUnlocked(),
    dialogFlags: dialogSystem.getFlags(),
    solvedPuzzles: puzzleSystem.getSolved(),
    collectedShards: puzzleSystem.getCollectedShards(),
    defeatedBosses: [...gameState.defeatedBosses],
    playerX,
    playerY,
  });
}
