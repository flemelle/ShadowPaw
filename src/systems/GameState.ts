import { PowerSystem } from './PowerSystem';
import { DialogSystem } from './DialogSystem';
import { PuzzleSystem } from './PuzzleSystem';
import { SaveSystem } from './SaveSystem';
import { ZONE_IDS, TEST_MODE_QUERY_FLAG, BOSS_DEFS, EPILOGUE_ZONE_ID } from '@/utils/Constants';
import type { PowerId } from '@/utils/Constants';
import type { ZoneMap } from '@/utils/Types';
import { listZoneIds, getZoneMap } from './LevelLoader';
import puzzlesData from '@/data/puzzles.json';

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
  /** Créatures piégées libérées (cf. entities/Captive.ts) — id de l'entité, persistant. */
  rescuedCreatures: new Set<string>(),
  /** Vies bonus déjà ramassées (cf. EntityLifePickup) — leur nombre augmente le maximum de vies
   * (cf. GameScene.maxLives), pas seulement le compte courant qui repart plein à chaque session. */
  collectedLifePickups: new Set<string>(),
  /** Fins déjà découvertes (cf. dialogues.json endingConditions) — pour le panneau succès du menu. */
  reachedEndings: new Set<string>(),
  /**
   * Position de checkpoint à restaurer au premier chargement de zone suivant un `continueGame()`
   * (cf. GameScene.loadZone) — sinon "reprendre une partie" renvoyait toujours au point d'entrée
   * de la zone plutôt qu'au dernier checkpoint (autel, boss, sortie de zone, sauvetage…) atteint.
   * Consommée (mise à `null`) dès son premier usage : les transitions de zone normales doivent
   * continuer à spawn au point d'entrée.
   */
  resumePosition: null as { x: number; y: number } | null,
  /**
   * Un vrai checkpoint (autel, boss, sortie de zone, puzzle, sauvetage) a-t-il déjà été atteint
   * cette partie ? Distinct de "une sauvegarde existe" : quitter ou mourir persiste toujours la
   * position courante (cf. persistProgress) pour ne rien perdre, mais ça ne doit pas à soi seul
   * faire apparaître "Continuer" au menu — seul un vrai checkpoint doit l'activer.
   */
  hasCheckpoint: false,
  /**
   * Dispositions de zone déjà générées cette partie (IA ou repli procédural, cf.
   * systems/ZoneGenerator.ts), une par zone visitée — un revisite réutilise ce cache plutôt que
   * de régénérer une disposition différente (cf. SaveData.generatedZones : persisté pour que ça
   * survive aussi à un rechargement de page, le checkpoint playerX/Y n'étant valide que contre
   * la disposition exacte dans laquelle il a été pris).
   */
  generatedZones: new Map<string, ZoneMap>(),
};

export function isTestModeRequestedFromURL(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get(TEST_MODE_QUERY_FLAG) === '1';
}

/**
 * Un seul point de vérité pour les champs de progression de `gameState` — sans ça, chaque ajout
 * de champ (rescuedCreatures, reachedEndings...) devait être recopié à la main dans les 3 fonctions
 * ci-dessous, et `startTestMode` avait justement oublié de réinitialiser `resumePosition`.
 */
function resetProgressState(overrides?: {
  defeatedBosses?: string[];
  rescuedCreatures?: string[];
  collectedLifePickups?: string[];
  reachedEndings?: string[];
  resumePosition?: { x: number; y: number } | null;
  hasCheckpoint?: boolean;
  generatedZones?: Record<string, ZoneMap>;
}): void {
  gameState.defeatedBosses = new Set(overrides?.defeatedBosses);
  gameState.rescuedCreatures = new Set(overrides?.rescuedCreatures);
  gameState.collectedLifePickups = new Set(overrides?.collectedLifePickups);
  gameState.reachedEndings = new Set(overrides?.reachedEndings);
  gameState.resumePosition = overrides?.resumePosition ?? null;
  gameState.hasCheckpoint = overrides?.hasCheckpoint ?? false;
  gameState.generatedZones = new Map(Object.entries(overrides?.generatedZones ?? {}));
}

export function startNewGame(): void {
  SaveSystem.reset();
  powerSystem.setTestMode(false);
  powerSystem.loadUnlocked([]);
  dialogSystem.loadFlags({});
  puzzleSystem.loadState([], []);
  gameState.currentZone = ZONE_IDS[0];
  gameState.testMode = false;
  resetProgressState();
}

export function continueGame(): void {
  const save = SaveSystem.load();
  powerSystem.setTestMode(false);
  powerSystem.loadUnlocked(save.unlockedPowers as PowerId[]);
  dialogSystem.loadFlags(save.dialogFlags);
  puzzleSystem.loadState(save.solvedPuzzles, save.collectedShards);
  gameState.currentZone = save.currentZone;
  gameState.testMode = false;
  // Appelée uniquement depuis le bouton "Continuer" (n'existe que si SaveSystem.hasSave()), donc
  // une sauvegarde réelle existe toujours ici — playerX/Y à restaurer sans condition, même si
  // (0, 0) par pur hasard (un point de spawn n'est en pratique jamais là, mais rien ne le garantit).
  resetProgressState({
    defeatedBosses: save.defeatedBosses,
    rescuedCreatures: save.rescuedCreatures,
    collectedLifePickups: save.collectedLifePickups,
    reachedEndings: save.endingsReached,
    resumePosition: { x: save.playerX, y: save.playerY },
    hasCheckpoint: save.hasCheckpoint,
    generatedZones: save.generatedZones,
  });
}

/**
 * Mode Admin : tous les pouvoirs, aucune contrainte de progression, sauvegarde inchangée.
 * Puzzles déjà résolus et éclats déjà recueillis pour la même raison que les pouvoirs : sans ça,
 * tout contenu conditionné par un puzzle résolu ou un nombre d'éclats (autels, dialogues, la fin
 * elle-même) restait inaccessible tant qu'on ne rejouait pas chaque puzzle à la main zone par zone.
 */
export function startTestMode(zoneId?: string): void {
  powerSystem.setTestMode(true);
  dialogSystem.loadFlags({});
  puzzleSystem.loadState(
    puzzleSystem.puzzles.map((p) => p.id),
    puzzleSystem.shards.map((s) => s.id),
  );
  gameState.currentZone = zoneId ?? ZONE_IDS[0];
  gameState.testMode = true;
  resetProgressState();
}

/** En Mode Admin, tous les gates de progression (boss, autels, combos) sont ignorés. */
export function isGateOpen(): boolean {
  return gameState.testMode;
}

/**
 * Entrée dans l'épilogue (cf. EPILOGUE_ZONE_ID), depuis l'écran de fin — DÉLIBÉRÉMENT distincte
 * de startTestMode() : celle-ci appelle resetProgressState(), qui viderait rescuedCreatures et
 * ferait apparaître l'épilogue sans aucun chat retrouvé, quelle que soit la vraie partie qui vient
 * de se terminer. On ne pose que le flag testMode (pour que persistProgress reste un no-op tant
 * qu'on s'y promène — cf. son propre garde-fou — sans jamais écraser le vrai point de sauvegarde
 * du joueur avec la position dans cette zone bonus), sans toucher au reste de l'état.
 */
export function enterEpilogue(): void {
  powerSystem.setTestMode(true);
  gameState.testMode = true;
  gameState.currentZone = EPILOGUE_ZONE_ID;
}

export interface AchievementCategory {
  key: 'bosses' | 'captives' | 'shards' | 'endings';
  label: string;
  done: number;
  total: number;
}

/** Totaux fixes des 4 catégories de succès (cf. MenuScene.showAchievements) — calculés à la
 * demande à partir des données statiques plutôt que mis en cache, negligeable en coût et jamais
 * périmé si une zone/un puzzle est ajouté. Compte courant lu depuis les instances live (gameState/
 * puzzleSystem), pas depuis une sauvegarde, pour rester exact au milieu d'une partie en cours (cf.
 * GameScene, qui affiche une notification à chaque progression plutôt qu'seulement au menu). */
export function getAchievementProgress(): AchievementCategory[] {
  const allEntities = listZoneIds().flatMap((id) => getZoneMap(id).entities);
  const totalCaptives = allEntities.filter((e) => e.type === 'captive').length;
  const totalShards = puzzlesData.puzzles.filter((p) => p.reward.type === 'reveal_shard').length;
  const totalBosses = Object.keys(BOSS_DEFS).length;
  const totalEndings = Object.keys(dialogSystem.endingConditions).length;

  return [
    { key: 'bosses', label: 'Gardiens vaincus', done: gameState.defeatedBosses.size, total: totalBosses },
    { key: 'captives', label: 'Créatures sauvées', done: gameState.rescuedCreatures.size, total: totalCaptives },
    { key: 'shards', label: 'Éclats de lumière recueillis', done: puzzleSystem.getCollectedShards().length, total: totalShards },
    { key: 'endings', label: 'Fins découvertes', done: gameState.reachedEndings.size, total: totalEndings },
  ];
}

/**
 * `isCheckpoint` : uniquement pour un vrai point de sauvegarde en jeu (autel, boss, sortie de
 * zone, puzzle, sauvetage) — pas pour un quitter/mourir, qui persiste l'état courant sans faire
 * apparaître "Continuer" si aucun vrai checkpoint n'a encore été atteint (cf. gameState.hasCheckpoint).
 */
export function persistProgress(playerX: number, playerY: number, isCheckpoint = false): void {
  if (gameState.testMode) return;
  if (isCheckpoint) gameState.hasCheckpoint = true;
  SaveSystem.save({
    currentZone: gameState.currentZone,
    unlockedPowers: powerSystem.getUnlocked(),
    dialogFlags: dialogSystem.getFlags(),
    solvedPuzzles: puzzleSystem.getSolved(),
    collectedShards: puzzleSystem.getCollectedShards(),
    defeatedBosses: [...gameState.defeatedBosses],
    rescuedCreatures: [...gameState.rescuedCreatures],
    collectedLifePickups: [...gameState.collectedLifePickups],
    endingsReached: [...gameState.reachedEndings],
    hasCheckpoint: gameState.hasCheckpoint,
    generatedZones: Object.fromEntries(gameState.generatedZones),
    playerX,
    playerY,
  });
}
