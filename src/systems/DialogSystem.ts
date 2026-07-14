import dialoguesData from '@/data/dialogues.json';
import { EventBus, GameEvents } from '@/utils/EventBus';

export interface DialogChoice {
  text: string;
  next: string;
  setFlag?: string;
}

export interface DialogNode {
  lines: string[];
  choices?: DialogChoice[];
  end?: boolean;
}

export interface DialogTree {
  npc: string;
  displayName: string;
  requiresPower?: string;
  startNode: string;
  description?: string;
  nodes: Record<string, DialogNode>;
}

export interface EndingCondition {
  requiresFlag?: string;
  requiresShardCount?: number;
  fallback?: boolean;
  title: string;
  summary: string;
}

/**
 * Arbre de dialogues + flags de décision (utilisés notamment pour
 * déterminer la Fin A / Fin B via le dialogue `malakar_zone8_pre_boss`).
 */
export class DialogSystem {
  readonly trees: Record<string, DialogTree> = dialoguesData.trees as unknown as Record<string, DialogTree>;
  readonly endingConditions = dialoguesData.endingConditions as Record<string, EndingCondition>;

  private flags = new Set<string>();
  private currentTreeId: string | null = null;
  private currentNodeId: string | null = null;

  loadFlags(flags: Record<string, boolean>): void {
    this.flags = new Set(Object.entries(flags).filter(([, v]) => v).map(([k]) => k));
  }

  getFlags(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    this.flags.forEach((f) => (out[f] = true));
    return out;
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  setFlag(flag: string): void {
    this.flags.add(flag);
    EventBus.emit(GameEvents.DIALOG_FLAG_SET, flag);
  }

  start(treeId: string): DialogNode | null {
    const tree = this.trees[treeId];
    if (!tree) return null;
    this.currentTreeId = treeId;
    this.currentNodeId = tree.startNode;
    EventBus.emit(GameEvents.DIALOG_START, treeId);
    return tree.nodes[tree.startNode];
  }

  choose(choiceIndex: number): DialogNode | null {
    if (!this.currentTreeId || !this.currentNodeId) return null;
    const tree = this.trees[this.currentTreeId];
    const node = tree.nodes[this.currentNodeId];
    const choice = node.choices?.[choiceIndex];
    if (!choice) return this.endCurrent();

    if (choice.setFlag) this.setFlag(choice.setFlag);

    this.currentNodeId = choice.next;
    const nextNode = tree.nodes[choice.next];
    if (!nextNode || nextNode.end) return this.endCurrent();
    return nextNode;
  }

  private endCurrent(): null {
    EventBus.emit(GameEvents.DIALOG_END, this.currentTreeId);
    this.currentTreeId = null;
    this.currentNodeId = null;
    return null;
  }

  /** Détermine la fin à jouer selon les flags posés et le nombre d'éclats collectés. */
  resolveEnding(collectedShardCount: number): EndingCondition & { id: string } {
    for (const [id, cond] of Object.entries(this.endingConditions)) {
      if (cond.fallback) continue;
      const flagOk = !cond.requiresFlag || this.hasFlag(cond.requiresFlag);
      const shardOk = cond.requiresShardCount === undefined || collectedShardCount >= cond.requiresShardCount;
      if (flagOk && shardOk) return { id, ...cond };
    }
    const fallbackEntry = Object.entries(this.endingConditions).find(([, c]) => c.fallback)!;
    return { id: fallbackEntry[0], ...fallbackEntry[1] };
  }
}
