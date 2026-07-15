# FSM Transition Semantics Audit

Phase: 3B - Typed Guard, Effect and Transition Contracts
Base commit: `0d21a41`
Branch: `refactor/typed-transition-contracts`

## Baseline

The Phase 3A.1 acceptance baseline passed before Phase 3B changes:

- `npm run typecheck`
- `npm run test:fsm-roundtrip`
- `npm run test:fsm-security`
- `npm run test:fsm-roundtrip:integration`
- `npm run test:fsm-roundtrip:acceptance`
- `npm run test:coverage`
- `npm run test:renderer`
- `npm run test:importer`
- `npm run test:compiler`
- `npm run test:codegen-equivalence`
- `npm run test:compile-fixtures`
- `npm run build`

`npm run build` still reports the existing Vite chunk-size warning.

The completed Phase 3A.1 state was archived as:

- `D:\Vlad Myahlov\phase-3a1-complete.bundle`

## Current Transition Fields

The schema-v5 domain transition model is `FsmTransition` in `src/domain/project.ts`.

Persisted transition behavior fields:

- `trigger`: event, mechanism, button, timer and fact trigger data.
- `condition: string | null`: current guard-like expression slot.
- `backendProcessId: string | null`: current effect-like backend process request.
- `kind`, `source`, `sourceHandle` and `targetHandle`: metadata/layout, not behavior storage.

There is no structured `behavior`, `guard`, `effect` or extension-map field in schema-v5.

The interchange model (`src/fsm-interchange/types.ts`) mirrors the same behavior fields. Mermaid and Python DSL exporters persist `condition` and `backendProcessId` as explicit transition directive attributes.

The runtime simulator currently evaluates legacy condition strings with a small comparator grammar and logs backend process requests by `backendProcessId`. Compiler IR carries `condition` and `backendProcessId` but does not lower them to generated C behavior.

## Persistence Decision

Decision: **Option C - restricted canonical string codec for guards, explicit versioned backend storage for typed effects.**

Rationale:

- schema-v5 can losslessly persist a typed guard only through the explicit `condition` field.
- schema-v5 can losslessly persist typed effects only when `backendProcessId` uses the explicit `@lcdide.effects/v1` envelope.
- ordinary `backendProcessId` values remain backend process entity references.
- There is no schema-v5 field for arbitrary effect invocation lists.
- Hiding JSON in `name`, `source`, comments, Mermaid labels or unrelated strings is forbidden.

Compatibility rules:

- Canonical guard strings in `condition` parse into typed guard invocations.
- Unknown legacy condition strings stay opaque and are preserved byte-for-byte.
- Malformed canonical guard strings are invalid and must not execute as legacy expressions.
- `backendProcessId` without the typed effect prefix maps to a legacy backend process reference.
- `@lcdide.effects/v1` maps to typed effects.
- Unknown or missing backend process references remain validation/runtime diagnostics, not hardware operation invocations.

## Architecture Boundary

Phase 3B is an L3 Application Layer change:

- FSM contracts.
- Screen/runtime simulator transition behavior.
- Semantic round-trip and command/history visibility.

Out of scope for this phase:

- L2 LCD driver behavior (`lcd_send_cmd`, `lcd_draw_bitmap`, `btn_read`).
- L1 HAL bindings (`SPI_Transmit`, `GPIO_WritePin`, `I2C_Read`).
- Hardware/Altium artifacts (`board_config.h`, netlists, BOM-driven driver selection).
- Operation Registry and hardware backend operations.
- MCP or AI-agent adapters.
- Generated C or binary output changes.

The user-provided Altium-to-firmware flow is recorded as a later hardware/profile integration boundary. Phase 3B must not turn typed effects into hardware operations.
