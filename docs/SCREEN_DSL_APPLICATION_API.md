# Screen DSL Application API

Date: 2026-06-25

The application API lives in `src/application/screenDsl` and is independent
from React, Zustand, Electron, DOM and filesystem APIs.

## Export

`exportScreenDsl(session, format, screenIds?)` exports selected screens through
the Screen Interchange read model and writes canonical JSON or restricted YAML.

## Preview

`createScreenDslPreview(session, request)` performs:

```text
source text
-> parser
-> ScreenDslDocumentV1
-> ScreenInterchangeProjectV1 candidate
-> Screen Interchange validation
-> Screen DSL pixel-budget validation
-> deterministic identity plan
-> semantic diff
-> ChangeSet mapping
-> ChangeSet dry-run
-> byte-budget raster summary
```

Preview is read-only. It does not mutate `ProjectSession`, does not reserve IDs,
does not increment revision and does not write history.

## Apply

`applyScreenDslPreview(session, request)` requires a previously created
applyable preview. It rejects stale revision, stale source text, target screen
fingerprint changes and missing destructive confirmation.

The application facade supports exact Apply for update, create and clone modes.
Create mode preserves stable DSL screen/object IDs after collision checks. Clone
mode rewrites screen, object and resource IDs through the deterministic preview
identity plan before Apply.

Screen DSL Apply currently mutates the application project model only. It does
not create FSM state links from `linkedStateIds`, does not replace schema-v5 and
does not bypass the normal `ProjectChangeSet` history path.

## Transaction contract

`applyScreenDslPreview` returns an `ApplyScreenDslPreviewResult` with:

- `applied` — boolean success flag;
- `result` — new `ProjectSession` on success, `null` on failure;
- `transaction` — `ScreenDslApplyTransaction` on success, `null` on failure;
- `updatedPreview` — preview with updated `lifecycle` (`'consumed'` or `'failed'`);
- `diagnostics` — error list on failure.

The `transaction.fingerprint` is deterministic and does not encode wall-clock
time or file-system paths. See `SCREEN_DSL_TRANSACTION_AUDIT.md`.

## Document session

`ScreenDslSessionCoordinator` in `src/application/screenDslSession/` manages
transient editing sessions keyed by `{ projectId, format, importMode,
targetScreenIds }`. Session state is not persisted in schema-v5.
See `SCREEN_DSL_DOCUMENT_SESSION.md` and `SCREEN_DSL_SESSION_LIFECYCLE.md`.
