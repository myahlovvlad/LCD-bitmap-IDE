# FSM Interchange Model V1

`FsmInterchangeModelV1` is the authoring round-trip contract for Phase 3A. It
is separate from compiler IR and is not persisted into `.lcdproj`.

The model stores:

- machine identity: project id and name
- states: stable id, title, state type, initial/terminal flags, subsystem,
  origin, linked screen id, runtime id, legacy ids and explicit order
- events: stable id, name, description, legacy trigger and explicit order
- transitions: stable id, source/target state ids, event id, trigger mechanism
  metadata, handles, kind, condition, source, backend process id and explicit
  order
- layout: state id, x/y, optional width/height and explicit order

Canonicalization sorts by explicit order and then id, normalizes absent optional
values and serializes with stable key ordering. UI selection, session revision,
history and validation timestamps are not part of the interchange model.
