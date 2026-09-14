import { describe, expect, it } from 'vitest';
import {
  createFsmViewportCache,
  type FsmViewportContext,
  type FsmViewportStorage
} from '../../src/features/fsm/fsmViewportCache';

const FULL_GRAPH: FsmViewportContext = { projectId: 'ecros-5400uv', representation: 'all' };

class MemoryStorage implements FsmViewportStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('FSM viewport cache', () => {
  it('retains a viewport in memory for a tab remount', () => {
    const cache = createFsmViewportCache();
    cache.write(FULL_GRAPH, { x: 120, y: -48, zoom: 0.72 });

    expect(cache.read(FULL_GRAPH)).toEqual({ x: 120, y: -48, zoom: 0.72 });
  });

  it('restores a persisted viewport in a newly created cache', () => {
    const storage = new MemoryStorage();
    createFsmViewportCache(storage).write(FULL_GRAPH, { x: 72, y: 30, zoom: 1.4 });

    expect(createFsmViewportCache(storage).read(FULL_GRAPH)).toEqual({ x: 72, y: 30, zoom: 1.4 });
  });

  it('keeps overview and subsystem viewports independent', () => {
    const cache = createFsmViewportCache();
    cache.write(FULL_GRAPH, { x: 0, y: 0, zoom: 0.5 });
    cache.write({ projectId: 'ecros-5400uv', representation: 'subsystem:photometry' }, { x: 240, y: 90, zoom: 1.2 });

    expect(cache.read(FULL_GRAPH)).toEqual({ x: 0, y: 0, zoom: 0.5 });
    expect(cache.read({ projectId: 'ecros-5400uv', representation: 'subsystem:photometry' })).toEqual({ x: 240, y: 90, zoom: 1.2 });
  });

  it('ignores malformed persisted data without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem('lcd-bitmap-ide.workspace.fsm-viewport.v1', '{not-json');

    expect(createFsmViewportCache(storage).read(FULL_GRAPH)).toBeNull();
  });
});
