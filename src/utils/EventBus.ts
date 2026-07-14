import Phaser from 'phaser';

/**
 * Bus d'événements global partagé entre scènes et systèmes
 * (dialogues, pouvoirs, puzzles, sauvegarde, fins alternatives...).
 */
class EventBusClass extends Phaser.Events.EventEmitter {}

export const EventBus = new EventBusClass();

export const GameEvents = {
  POWER_UNLOCKED: 'power-unlocked',
  COMBO_TRIGGERED: 'combo-triggered',
  DIALOG_START: 'dialog-start',
  DIALOG_END: 'dialog-end',
  DIALOG_FLAG_SET: 'dialog-flag-set',
  PUZZLE_START: 'puzzle-start',
  PUZZLE_SOLVED: 'puzzle-solved',
  PUZZLE_EXIT: 'puzzle-exit',
  ZONE_ENTER: 'zone-enter',
  ZONE_COMPLETE: 'zone-complete',
  SHARD_COLLECTED: 'shard-collected',
  BOSS_ARENA_ENTER: 'boss-arena-enter',
  BOSS_DEFEATED: 'boss-defeated',
  GAME_SAVED: 'game-saved',
  ENDING_TRIGGERED: 'ending-triggered',
  TEST_MODE_CHANGED: 'test-mode-changed',
} as const;
