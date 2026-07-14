import puzzlesData from '@/data/puzzles.json';
import { EventBus, GameEvents } from '@/utils/EventBus';
import type { ComboId } from '@/utils/Constants';

export interface MirrorDef {
  id: string;
  x: number;
  y: number;
  rotation: number;
  rotatable: boolean;
}

export interface PuzzleDef {
  id: string;
  type: 'mirror' | 'equilibrium' | 'inverted_zone' | 'shard_puzzle';
  zone: string;
  name: string;
  description: string;
  grid?: { cols: number; rows: number };
  source?: { x: number; y: number; direction: 'E' | 'W' | 'N' | 'S' };
  receiver?: { x: number; y: number };
  mirrors?: MirrorDef[];
  solutionRotations?: Record<string, number>;
  requiresCombo?: ComboId;
  requiresShardCount?: number;
  invertedRules?: { lightDamages: boolean; shadowProtects: boolean };
  platforms?: { id: string; x: number; y: number; fallsAfterMs: number }[];
  reward:
    | { type: 'unlock_gate'; gateId: string }
    | { type: 'unlock_path'; pathId: string }
    | { type: 'reveal_boss_arena'; bossId: string }
    | { type: 'reveal_shard'; shardId: string };
}

type Direction = 'E' | 'W' | 'N' | 'S';

const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  E: [1, 0],
  W: [-1, 0],
  N: [0, -1],
  S: [0, 1],
};

/** "/" à 45°/225°, "\" à 135°/315° — réflexion simplifiée pour le puzzle de miroirs. */
function reflect(dir: Direction, rotation: number): Direction {
  const isSlash = rotation === 45 || rotation === 225;
  const table: Record<string, Record<Direction, Direction>> = {
    slash: { E: 'N', N: 'E', W: 'S', S: 'W' },
    backslash: { E: 'S', S: 'E', W: 'N', N: 'W' },
  };
  return table[isSlash ? 'slash' : 'backslash'][dir];
}

export class PuzzleSystem {
  readonly puzzles: PuzzleDef[] = puzzlesData.puzzles as unknown as PuzzleDef[];
  readonly shards = puzzlesData.shards as { id: string; name: string }[];

  private solved = new Set<string>();
  private collectedShards = new Set<string>();

  loadState(solvedPuzzles: string[], collectedShards: string[]): void {
    this.solved = new Set(solvedPuzzles);
    this.collectedShards = new Set(collectedShards);
  }

  getSolved(): string[] {
    return [...this.solved];
  }

  getCollectedShards(): string[] {
    return [...this.collectedShards];
  }

  isSolved(puzzleId: string): boolean {
    return this.solved.has(puzzleId);
  }

  getDef(puzzleId: string): PuzzleDef | undefined {
    return this.puzzles.find((p) => p.id === puzzleId);
  }

  /** Trace le faisceau à travers les miroirs et renvoie le chemin + si le récepteur est atteint. */
  traceMirrorBeam(puzzleId: string, rotations: Record<string, number>): { path: [number, number][]; solved: boolean } {
    const def = this.getDef(puzzleId);
    const path: [number, number][] = [];
    if (!def || def.type !== 'mirror' || !def.source || !def.receiver || !def.grid) {
      return { path, solved: false };
    }

    let x = def.source.x;
    let y = def.source.y;
    let dir = def.source.direction;
    const maxSteps = def.grid.cols * def.grid.rows + 4;

    for (let step = 0; step < maxSteps; step++) {
      path.push([x, y]);
      if (x === def.receiver.x && y === def.receiver.y) {
        this.markSolved(puzzleId);
        return { path, solved: true };
      }
      const mirror = def.mirrors?.find((m) => m.x === x && m.y === y);
      if (mirror) {
        const rot = rotations[mirror.id] ?? mirror.rotation;
        dir = reflect(dir, rot);
      }
      const [dx, dy] = DIRECTION_VECTORS[dir];
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= def.grid.cols || y >= def.grid.rows) break;
    }
    return { path, solved: false };
  }

  /** Résout un puzzle de miroirs directement via sa solution de référence (utilisé par le Mode Admin / debug). */
  autoSolveMirror(puzzleId: string): boolean {
    const def = this.getDef(puzzleId);
    if (!def || !def.solutionRotations) return false;
    return this.traceMirrorBeam(puzzleId, def.solutionRotations).solved;
  }

  solveEquilibrium(puzzleId: string, comboActive: ComboId | null): boolean {
    const def = this.getDef(puzzleId);
    if (!def || def.type !== 'equilibrium') return false;
    if (def.requiresCombo && comboActive !== def.requiresCombo) return false;
    this.markSolved(puzzleId);
    return true;
  }

  solveInvertedZone(puzzleId: string, hasShadowForm: boolean): boolean {
    const def = this.getDef(puzzleId);
    if (!def || def.type !== 'inverted_zone') return false;
    if (!hasShadowForm) return false;
    this.markSolved(puzzleId);
    if (def.reward.type === 'reveal_shard') this.collectShard(def.reward.shardId);
    return true;
  }

  solveShardPuzzle(puzzleId: string, context: { comboActive?: ComboId | null; shardCount?: number }): boolean {
    const def = this.getDef(puzzleId);
    if (!def || def.type !== 'shard_puzzle') return false;
    if (def.requiresCombo && context.comboActive !== def.requiresCombo) return false;
    if (def.requiresShardCount !== undefined && (context.shardCount ?? 0) < def.requiresShardCount) return false;
    this.markSolved(puzzleId);
    if (def.reward.type === 'reveal_shard') this.collectShard(def.reward.shardId);
    return true;
  }

  private collectShard(shardId: string): void {
    if (this.collectedShards.has(shardId)) return;
    this.collectedShards.add(shardId);
    EventBus.emit(GameEvents.SHARD_COLLECTED, shardId);
  }

  private markSolved(puzzleId: string): void {
    if (this.solved.has(puzzleId)) return;
    this.solved.add(puzzleId);
    EventBus.emit(GameEvents.PUZZLE_SOLVED, puzzleId);
  }
}
