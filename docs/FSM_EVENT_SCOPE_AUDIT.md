# FSM Event Scope Audit

## Outcome

FSM event definitions live in one project registry so IDs remain stable for
button bindings, runtime input, import/export and code generation. Registry
storage does not mean every event is globally usable.

Each event now has an explicit authoring scope:

- `global` — reusable by transitions from any state;
- `state` — usable only by transitions whose `from` state equals the event's
  `sourceStateId`.

Older project files omit `scope` and therefore remain global by default.

## Editor behavior

- A new event created from a transition inspector is local to that transition's
  source state.
- The event selector shows whether each option is global or local.
- Route creation only offers global events and local events owned by the
  selected source state.
- A shared global event cannot be converted in place while another source state
  uses it. Create a new event instead; this avoids silently changing unrelated
  transitions.
- Project validation blocks a transition that references a local event owned by
  a different state.

## Runtime semantics

Runtime dispatch still receives a stable event ID. The runtime already selects
candidate transitions from the active state, so local scope adds an authoring
and validation constraint without changing deterministic dispatch.

## Interchange limitation

FSM Interchange V1 intentionally keeps its existing event contract. Applying a
Mermaid or Python-like FSM round trip recreates event definitions as global
unless a later interchange version adds scope metadata. Native `.lcdproj`
save/load preserves event scope.
