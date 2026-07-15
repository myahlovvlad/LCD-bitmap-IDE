# ADR: FSM Typed Transition Contracts

Status: accepted for Phase 3B

## Decision

Phase 3B introduces typed transition behavior as an application-layer contract:

- canonical typed guards are persisted in `FsmTransition.condition`;
- legacy condition strings are preserved as opaque expressions;
- malformed canonical guard strings are invalid and do not execute as legacy expressions;
- `FsmTransition.backendProcessId` is exposed as a typed `backend.process.request` effect;
- no schema-v6 field, Operation Registry, MCP adapter or hardware operation backend is introduced.

## Canonical Guard Format

The schema-v5-safe guard representation is:

```text
@lcdide.guard/v1 <contractId> <arg>=<json-safe-value> ...
```

Example:

```text
@lcdide.guard/v1 runtime.context.compare key="button" operator="==" value="START"
```

Only JSON-safe scalar values and arrays of scalar values are allowed. Strings are JSON-quoted. Numbers must be finite.

## Compatibility

Legacy strings such as `button == START` remain byte-preserved and are evaluated by the existing simulator compatibility path.

Canonical strings are parsed strictly. A malformed canonical string is reported as invalid rather than treated as legacy behavior.

## Boundary

Typed effects currently describe application backend process requests only. They do not call LCD drivers, HAL functions or hardware pin operations. Altium-generated board configuration and driver selection remain future L2/L1 integration work.
