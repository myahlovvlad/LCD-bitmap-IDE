import type { Patch } from 'immer';
import type { ActorIdentity } from './commandTypes';
import type { SemanticChange } from './semanticChange';

export interface CommandHistoryEntry {
  id: string;
  kind: 'command' | 'changeset';
  commandIds: string[];
  actor: ActorIdentity;
  reason?: string;
  committedAt: string;
  revisionBefore: number;
  revisionAfter: number;
  semanticChanges: SemanticChange[];
  forwardPatches: Patch[];
  inversePatches: Patch[];
  label: string;
}

export interface CommandHistory {
  entries: CommandHistoryEntry[];
  cursor: number;
  limit: number;
}

export function createCommandHistory(limit = 50): CommandHistory {
  return { entries: [], cursor: 0, limit };
}

export function appendHistoryEntry(history: CommandHistory, entry: CommandHistoryEntry): CommandHistory {
  const committed = history.entries.slice(0, history.cursor);
  const entries = [...committed, entry].slice(-history.limit);
  return {
    ...history,
    entries,
    cursor: entries.length
  };
}

export function canUndo(history: CommandHistory): boolean {
  return history.cursor > 0;
}

export function canRedo(history: CommandHistory): boolean {
  return history.cursor < history.entries.length;
}
