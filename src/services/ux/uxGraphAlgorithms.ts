/** Pure graph algorithms shared by the deterministic UX rule modules. */
import type { ProjectUxGraph, UxControlNode } from './uxGraphBuilder';

/** State ids a control is reachable/usable from, mirroring ControlPanelButton.allowedStates/disabledStates. */
export function controlAvailableStateIds(graph: ProjectUxGraph, control: UxControlNode): Set<string> {
  const allIds = graph.states.map((s) => s.stateId);
  const base = control.allowedStates && control.allowedStates.length > 0 ? control.allowedStates : allIds;
  const disabled = new Set(control.disabledStates ?? []);
  return new Set(base.filter((id) => !disabled.has(id)));
}

/** Controls (buttons) usable while the FSM is in `stateId`. */
export function controlsAvailableOnState(graph: ProjectUxGraph, stateId: string): UxControlNode[] {
  return graph.controls.filter((control) => controlAvailableStateIds(graph, control).has(stateId));
}

function adjacency(graph: ProjectUxGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const transition of graph.transitions) {
    map.set(transition.from, [...(map.get(transition.from) ?? []), transition.to]);
  }
  return map;
}

function reverseAdjacency(graph: ProjectUxGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const transition of graph.transitions) {
    map.set(transition.to, [...(map.get(transition.to) ?? []), transition.from]);
  }
  return map;
}

/** State ids reachable by following transitions forward from any of `startIds`. */
export function forwardReachable(graph: ProjectUxGraph, startIds: readonly string[]): Set<string> {
  const adj = adjacency(graph);
  const visited = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** State ids that can reach any of `targetIds` by following transitions forward. */
export function reverseReachable(graph: ProjectUxGraph, targetIds: readonly string[]): Set<string> {
  const radj = reverseAdjacency(graph);
  const visited = new Set<string>(targetIds);
  const queue = [...targetIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const prev of radj.get(current) ?? []) {
      if (!visited.has(prev)) {
        visited.add(prev);
        queue.push(prev);
      }
    }
  }
  return visited;
}

/** True if there is a directed path from `fromId` to any id in `toIds` (fromId included as trivial match). */
export function hasPathTo(graph: ProjectUxGraph, fromId: string, toIds: ReadonlySet<string>): boolean {
  if (toIds.has(fromId)) return true;
  const adj = adjacency(graph);
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (toIds.has(next)) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** The FSM's declared initial state ids, falling back to states with no incoming transition
 *  when nothing is explicitly marked initial (keeps reachability analysis meaningful on
 *  malformed/legacy graphs instead of silently reporting everything as orphaned). */
export function initialStateIds(graph: ProjectUxGraph): string[] {
  const declared = graph.states.filter((s) => s.isInitial).map((s) => s.stateId);
  if (declared.length > 0) return declared;
  return graph.states.filter((s) => s.incomingTransitionIds.length === 0).map((s) => s.stateId);
}

/** Tarjan's SCC algorithm. Returns only components of size > 1 or a single state with a
 *  self-loop — i.e. actual cycles, not every trivially-singleton "component". */
export function findCycles(graph: ProjectUxGraph): string[][] {
  const adj = adjacency(graph);
  const indexMap = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let index = 0;
  const result: string[][] = [];

  function strongConnect(v: string) {
    indexMap.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indexMap.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indexMap.get(w)!));
      }
    }

    if (lowlink.get(v) === indexMap.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      const hasSelfLoop = component.length === 1 && (adj.get(component[0]) ?? []).includes(component[0]);
      if (component.length > 1 || hasSelfLoop) result.push(component);
    }
  }

  for (const state of graph.states) {
    if (!indexMap.has(state.stateId)) strongConnect(state.stateId);
  }
  return result;
}
