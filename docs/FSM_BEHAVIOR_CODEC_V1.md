# FSM Behavior Codec V1

## Guard Storage

Prefix:

```text
@lcdide.guard/v1
```

Format:

```text
@lcdide.guard/v1 <contractId> <arg>=<json-safe-scalar-or-array> ...
```

Arguments are sorted by key on write. Strings are JSON-quoted. Numbers must be finite. Arrays may contain only scalar JSON-safe values.

## Effect Storage

Prefix:

```text
@lcdide.effects/v1
```

Format:

```text
@lcdide.effects/v1 <canonical-json-array>
```

The payload is an ordered array of typed effect invocations:

```json
[{"args":{"processId":"process-measure"},"contractId":"backend.process.request","version":1}]
```

Object keys are emitted in canonical order. Effect order is significant.

## Storage States

- `none`: no storage.
- `legacy-backend-process`: ordinary backend process entity reference.
- `typed-effects`: valid `@lcdide.effects/v1` envelope.
- `opaque`: preserved raw non-executable value.
- `invalid`: reserved-prefix value with malformed payload or unsupported version.

## Limits

- Maximum storage length: 512 characters.
- Maximum typed effects: 8.
- Maximum arguments per invocation: 16.
- Maximum string argument length: 160.
- Maximum scalar array length: 16.
- Maximum diagnostics: 8.

The parser does not use `eval`, `Function`, dynamic import, child processes or shell execution.

## Script Synchronization Compatibility

Phase 3C controlled synchronization treats guard/effect storage as project FSM
data, not as executable script. Preview, refresh and stale-state handling must
not canonicalize opaque legacy strings, convert ordinary backend process IDs to
typed effects or rewrite malformed reserved-prefix values. Existing codec limits
and diagnostics remain the behavior boundary.
