/**
 * @module shared/lib/history
 * @description Bounded undo/redo reducer for project-wide history. Zustand owns
 * application state, while this pure reducer documents and tests the behavior
 * required by the refactoring brief: push, undo, redo and overflow trimming.
 */

export interface HistoryState<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  readonly limit: number;
}

export type HistoryAction<T> =
  | { type: 'push'; value: T }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

/** Creates a bounded history object with an empty undo/redo stack. */
export function createHistory<T>(present: T, limit = 50): HistoryState<T> {
  return { past: [], present, future: [], limit };
}

/**
 * Applies a history action.
 *
 * @param state - Current immutable history state.
 * @param action - History command.
 * @returns New history state with bounded `past` stack.
 */
export function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>
): HistoryState<T> {
  if (action.type === 'reset') {
    return createHistory(action.value, state.limit);
  }

  if (action.type === 'push') {
    const past = [...state.past, state.present].slice(-state.limit);
    return { ...state, past, present: action.value, future: [] };
  }

  if (action.type === 'undo') {
    if (state.past.length === 0) {
      return state;
    }
    const previous = state.past[state.past.length - 1];
    return {
      ...state,
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, state.limit)
    };
  }

  if (state.future.length === 0) {
    return state;
  }
  const next = state.future[0];
  return {
    ...state,
    past: [...state.past, state.present].slice(-state.limit),
    present: next,
    future: state.future.slice(1)
  };
}
