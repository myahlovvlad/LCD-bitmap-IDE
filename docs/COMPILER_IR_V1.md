# Normalized Compiler IR v1

`COMPILER_IR_VERSION` is `1`.

The IR is a deterministic semantic representation of a schema-v5 project. It is
not the production backend format and does not contain target-packed
framebuffer bytes except where existing bitmap canvas objects already store
source bytes.

## Top-Level Shape

```ts
interface NormalizedCompilerIrV1 {
  irVersion: 1;
  source: {
    projectId: string;
    projectName: string;
    projectVersion: string;
    projectSchemaVersion: number;
    sourceFingerprint?: string;
  };
  display: NormalizedDisplayIr;
  fsm: NormalizedFsmIr;
  screens: readonly NormalizedScreenIr[];
  localization: NormalizedLocalizationIr;
  resources: NormalizedResourceIr;
  symbols: CompilerSymbolTable;
  traceability: CompilerTraceabilityMap;
}
```

## Ordering

- Screens use `project.screenOrder`.
- FSM states, events and transitions use their explicit order arrays.
- Canvas objects are normalized by `zIndex`, then original object order.
- Dictionary insertion order is ignored.
- Changing an explicit order changes IR order and fingerprint.

## Symbols

Symbols are centralized in `CompilerSymbolTable`. The current policy preserves
legacy sanitization semantics:

- non-alphanumeric characters become `_`;
- identifiers starting with a digit are prefixed with `_`;
- collisions are diagnosed but not automatically de-duplicated in Phase 2A.

Phase 2B can introduce backend-specific de-duplication after equivalence tests
prove compatibility.

## Diagnostics

Stable diagnostic codes currently include:

- `compiler.source.display-unsupported`
- `compiler.source.screen-missing`
- `compiler.source.state-missing`
- `compiler.source.transition-endpoint-missing`
- `compiler.source.event-missing`
- `compiler.source.symbol-collision`
- `compiler.source.resource-too-large`

## Traceability

Traceability links map IR paths back to source project paths for screens,
canvas objects, FSM states, FSM events and FSM transitions. This is the basis
for future IR-to-output reports and semantic round-trip diffs.

## Fingerprint

IR fingerprinting uses canonical JSON plus a documented `fnv1a64` adapter. The
fingerprint is deterministic for the same semantic IR. Validation timestamps
and application session runtime state are excluded from source fingerprints.
