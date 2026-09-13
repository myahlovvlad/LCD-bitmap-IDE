export const FSM_VIEWPORT_STORAGE_KEY = 'lcd-bitmap-ide.workspace.fsm-viewport.v1';

export interface FsmViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FsmViewportContext {
  projectId: string;
  representation: 'all' | 'overview' | `subsystem:${string}` | `layers:${string}`;
}

export interface FsmViewportStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface FsmViewportStore {
  version: 1;
  entries: Record<string, FsmViewport>;
}

export interface FsmViewportCache {
  read(context: FsmViewportContext): FsmViewport | null;
  write(context: FsmViewportContext, viewport: FsmViewport): void;
  clearInvalidFsmViewport(): void;
}

export function createFsmViewportCache(storage: FsmViewportStorage | null = browserStorage()): FsmViewportCache {
  const entries = readEntries(storage);

  const persist = (): void => {
    if (!storage) return;
    try {
      storage.setItem(FSM_VIEWPORT_STORAGE_KEY, JSON.stringify({ version: 1, entries } satisfies FsmViewportStore));
    } catch {
      // UI convenience cache must never block editing or export.
    }
  };

  return {
    read(context) {
      const value = entries[cacheEntryKey(context)];
      return isViewport(value) ? { ...value } : null;
    },
    write(context, viewport) {
      if (!isViewport(viewport)) return;
      entries[cacheEntryKey(context)] = { ...viewport };
      persist();
    },
    clearInvalidFsmViewport() {
      if (!storage) return;
      try {
        storage.removeItem(FSM_VIEWPORT_STORAGE_KEY);
      } catch {
        // The invalid entry is harmless when storage is unavailable.
      }
    }
  };
}

export const fsmViewportCache = createFsmViewportCache();

function cacheEntryKey(context: FsmViewportContext): string {
  return `${context.projectId}\u0000${context.representation}`;
}

function readEntries(storage: FsmViewportStorage | null): Record<string, FsmViewport> {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(FSM_VIEWPORT_STORAGE_KEY) ?? 'null') as Partial<FsmViewportStore> | null;
    if (parsed?.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed.entries).filter((entry): entry is [string, FsmViewport] => isViewport(entry[1]))
    );
  } catch {
    return {};
  }
}

function isViewport(value: unknown): value is FsmViewport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FsmViewport>;
  return [candidate.x, candidate.y, candidate.zoom].every((item) => typeof item === 'number' && Number.isFinite(item))
    && (candidate.zoom ?? 0) > 0;
}

function browserStorage(): FsmViewportStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
