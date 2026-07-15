# ADR-001: Domain Boundaries

## Status

Accepted for Phase 1A.

## Context

The repository is an offline Vite, React, TypeScript and Electron IDE for LCD bitmap screens, FSM flows, control panels, simulation and firmware exports. The audit found that several non-renderer layers imported renderer-owned contracts and helpers.

## Existing Problem

`src/model`, `src/services` and `src/entities` depended on `src/renderer/types/domain`, `src/renderer/config/constants` and `src/renderer/core/projectInterop`. This made renderer code the source of domain contracts and allowed future domain behavior to accidentally depend on UI infrastructure.

## Decision

Create `src/domain` as the independent owner of core contracts and pure defaults:

- localization and language codes;
- display and LCD defaults;
- canvas object contracts;
- font and glyph contracts plus pure glyph helpers;
- legacy project contracts used by import and migration;
- schema-v5 project contracts.

`src/model/project.ts` remains as a compatibility re-export for existing imports. `src/renderer/types/domain.ts` remains as a temporary renderer compatibility facade. Pure project interoperability helpers were moved to `src/services/projectInterop.ts`; the old renderer path now re-exports them.

## Dependency Rules

`src/domain`, `src/model`, `src/services` and `src/entities` must not import:

- `src/renderer`;
- `src/features`;
- React or React DOM;
- Zustand;
- Electron;
- UI-specific libraries such as React Flow.

Renderer and features may import domain contracts. Services and entities may import domain and shared libraries.

## Compatibility Facade

The renderer facade exists to avoid a broad one-step rewrite of UI imports:

- `src/renderer/types/domain.ts` re-exports domain types, mapping legacy FSM/project names to the old renderer-facing names.
- `src/renderer/core/fonts.ts` re-exports pure font helpers from `src/domain/fonts`.
- `src/renderer/core/projectInterop.ts` re-exports pure interop helpers from `src/services/projectInterop`.

These facades are intentionally transitional.

## Alternatives Considered

- Keep renderer as the contract owner: rejected because it preserves the original architecture violation.
- Introduce npm workspaces now: rejected because the current codebase does not need physical package boundaries for Phase 1A.
- Rewrite Zustand mutations into commands immediately: rejected because that belongs to Phase 1B and would expand the scope.

## Consequences

The domain boundary is now testable and protected by an architecture boundary test. Existing renderer imports continue to compile through facades, reducing migration risk.

## Migration Impact

Schema version remains 5. Existing schema-v5 payloads, legacy snapshots and portable `.lcdproj` imports remain supported. No project ID, screen ID, state ID, transition ID, object ID or C export format was intentionally changed.

## Security Impact

Non-renderer layers no longer depend on renderer modules, reducing the chance that future automation, services or import paths gain accidental UI or Electron coupling. This does not yet change CSP, Electron sandboxing or dependency audit status.

## Testing Impact

Added an AST-based architecture boundary test covering static imports, re-exports and dynamic imports in `src/domain`, `src/model`, `src/services` and `src/entities`. Regression tests also cover schema-v5 ID preservation and portable `.lcdproj` migration.

## Follow-up Work

Phase 1B should introduce the typed application command bus, project revision model, dry-run ChangeSet flow, validation-before-commit and a Zustand adapter over application commands.
