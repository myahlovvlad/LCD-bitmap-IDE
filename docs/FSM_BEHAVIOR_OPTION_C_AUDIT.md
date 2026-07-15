# FSM Behavior Option C Audit

Phase: 3B.1 - Typed Behavior Persistence and Compatibility Hardening

## Storage Summary

Option C keeps schema-v5 unchanged:

- `FsmTransition.condition` stores guard behavior.
- `FsmTransition.backendProcessId` stores either a legacy backend process reference or an explicit typed effect envelope.
- No extra schema-v5 field is added.
- Generated C and binary output remain outside the behavior persistence contract.

## `condition`

Historical meaning: author-entered runtime condition snippet, such as `button == START`.

Current typed meaning: when the value starts with `@lcdide.guard/v1`, it is a canonical typed guard invocation.

Legacy examples:

- `button == START`
- `value > 0`
- `status == READY`

Canonical example:

```text
@lcdide.guard/v1 runtime.context.compare key="button" operator="==" value="START"
```

Collision risk: low. Ordinary strings without the reserved prefix remain opaque legacy strings. Malformed reserved-prefix values are invalid, not opaque.

Maximum cardinality: one guard per transition in schema-v5.

Lossless status: typed, opaque and invalid values preserve raw storage. Canonical typed guards can be re-emitted deterministically.

Malformed behavior: invalid diagnostic; runtime does not execute malformed canonical guards as legacy expressions.

Future Operation Registry impact: guard contracts can be extended by versioned readers without rewriting legacy strings.

## `backendProcessId`

Historical meaning: optional reference to an entry in `project.backendProcesses`.

Current typed meaning: only values starting with `@lcdide.effects/v1` are typed effect storage. Ordinary IDs remain legacy backend process references.

Legacy examples:

- `process-tr-main-measure`
- `process-measure`

Canonical typed effect example:

```text
@lcdide.effects/v1 [{"args":{"processId":"process-measure"},"contractId":"backend.process.request","version":1}]
```

Collision risk: controlled by the reserved `@lcdide.effects/` prefix. A typed effect envelope is never treated as an ordinary backend process ID. An ordinary process ID is never parsed as a typed effect unless it uses the reserved prefix.

Maximum cardinality: the v1 envelope supports an ordered list of up to 8 typed effects. A transition cannot simultaneously persist a legacy backend process reference and typed effects in schema-v5; that combined state is blocked until a future migration.

Lossless status: legacy IDs, typed envelopes, opaque values and invalid reserved values retain their raw storage.

Malformed behavior: invalid diagnostic; runtime does not execute malformed typed effects.

Future Operation Registry impact: typed effect contract IDs can later map to Operation Registry entries. Legacy backend process IDs remain entity references and are not silently converted.

## Required Answers

1. `backendProcessId` is historically and currently an ordinary entity reference unless it starts with the typed effects reserved prefix.
2. One transition can store multiple typed effects only inside `@lcdide.effects/v1`; it cannot also store a legacy backend process reference in the same field.
3. The v1 typed effect envelope preserves ordered effects.
4. An ordinary backend process ID cannot be parsed as typed effect storage without the reserved prefix.
5. A canonical typed effect is not accepted as an ordinary backend process ID by runtime behavior.
6. Unknown backend process IDs remain legacy references and are preserved; validation/runtime report missing process where applicable.
7. Absent means no value, opaque means non-executable preserved raw storage, malformed means reserved-prefix storage that failed validation.
8. Operation Registry can consume typed effect contract IDs later; legacy backend process references remain separate.
9. New codec versions can be added with new prefixes/readers without changing old files.
10. Combined legacy process reference plus typed effects is blocked in schema-v5 and needs a future migration design.
