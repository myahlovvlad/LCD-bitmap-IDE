import { describe, expect, it } from 'vitest';
import { createHistory, historyReducer } from '../../src/shared/lib/history';

describe('history reducer', () => {
  it('pushes, undoes and redoes project snapshots', () => {
    let history = createHistory('a', 3);
    history = historyReducer(history, { type: 'push', value: 'b' });
    history = historyReducer(history, { type: 'push', value: 'c' });

    expect(history.present).toBe('c');
    history = historyReducer(history, { type: 'undo' });
    expect(history.present).toBe('b');
    history = historyReducer(history, { type: 'redo' });
    expect(history.present).toBe('c');
  });

  it('trims overflow beyond the configured limit', () => {
    let history = createHistory(0, 2);
    history = historyReducer(history, { type: 'push', value: 1 });
    history = historyReducer(history, { type: 'push', value: 2 });
    history = historyReducer(history, { type: 'push', value: 3 });

    expect(history.past).toEqual([1, 2]);
  });

  it('keeps identity for unavailable undo/redo and resets history', () => {
    const initial = createHistory('a', 2);
    expect(historyReducer(initial, { type: 'undo' })).toBe(initial);
    expect(historyReducer(initial, { type: 'redo' })).toBe(initial);
    const pushed = historyReducer(initial, { type: 'push', value: 'b' });
    expect(historyReducer(pushed, { type: 'reset', value: 'c' })).toEqual({
      past: [],
      present: 'c',
      future: [],
      limit: 2
    });
  });
});
