import type { FsmInterchangeModelV1 } from './types';

export type FsmSemanticDiffOperation =
  | { readonly type: 'state.create'; readonly id: string; readonly after: FsmInterchangeModelV1['states'][number] }
  | { readonly type: 'state.update'; readonly id: string; readonly before: FsmInterchangeModelV1['states'][number]; readonly after: FsmInterchangeModelV1['states'][number] }
  | { readonly type: 'state.delete'; readonly id: string; readonly before: FsmInterchangeModelV1['states'][number] }
  | { readonly type: 'event.create'; readonly id: string; readonly after: FsmInterchangeModelV1['events'][number] }
  | { readonly type: 'event.update'; readonly id: string; readonly before: FsmInterchangeModelV1['events'][number]; readonly after: FsmInterchangeModelV1['events'][number] }
  | { readonly type: 'event.delete'; readonly id: string; readonly before: FsmInterchangeModelV1['events'][number] }
  | { readonly type: 'transition.create'; readonly id: string; readonly after: FsmInterchangeModelV1['transitions'][number] }
  | { readonly type: 'transition.update'; readonly id: string; readonly before: FsmInterchangeModelV1['transitions'][number]; readonly after: FsmInterchangeModelV1['transitions'][number] }
  | { readonly type: 'transition.delete'; readonly id: string; readonly before: FsmInterchangeModelV1['transitions'][number] }
  | { readonly type: 'layout.update'; readonly id: string; readonly before?: FsmInterchangeModelV1['layout'][number]; readonly after: FsmInterchangeModelV1['layout'][number] };

export interface FsmSemanticDiff {
  readonly operations: readonly FsmSemanticDiffOperation[];
}

export function diffFsmInterchange(before: FsmInterchangeModelV1, after: FsmInterchangeModelV1): FsmSemanticDiff {
  return {
    operations: [
      ...diffById('state', before.states, after.states),
      ...diffById('event', before.events, after.events),
      ...diffById('transition', before.transitions, after.transitions),
      ...diffLayout(before.layout, after.layout)
    ]
  };
}

function diffById<
  Kind extends 'state' | 'event' | 'transition',
  Item extends { id: string }
>(
  kind: Kind,
  beforeItems: readonly Item[],
  afterItems: readonly Item[]
): FsmSemanticDiffOperation[] {
  const operations: FsmSemanticDiffOperation[] = [];
  const before = new Map(beforeItems.map((item) => [item.id, item]));
  const after = new Map(afterItems.map((item) => [item.id, item]));
  for (const [id, beforeItem] of before) {
    const afterItem = after.get(id);
    if (!afterItem) {
      operations.push({ type: `${kind}.delete`, id, before: beforeItem } as unknown as FsmSemanticDiffOperation);
    } else if (JSON.stringify(beforeItem) !== JSON.stringify(afterItem)) {
      operations.push({ type: `${kind}.update`, id, before: beforeItem, after: afterItem } as unknown as FsmSemanticDiffOperation);
    }
  }
  for (const [id, afterItem] of after) {
    if (!before.has(id)) {
      operations.push({ type: `${kind}.create`, id, after: afterItem } as unknown as FsmSemanticDiffOperation);
    }
  }
  return operations;
}

function diffLayout(
  beforeItems: FsmInterchangeModelV1['layout'],
  afterItems: FsmInterchangeModelV1['layout']
): FsmSemanticDiffOperation[] {
  const operations: FsmSemanticDiffOperation[] = [];
  const before = new Map(beforeItems.map((item) => [item.stateId, item]));
  for (const after of afterItems) {
    const beforeItem = before.get(after.stateId);
    if (JSON.stringify(beforeItem) !== JSON.stringify(after)) {
      operations.push({ type: 'layout.update', id: after.stateId, before: beforeItem, after });
    }
  }
  return operations;
}
