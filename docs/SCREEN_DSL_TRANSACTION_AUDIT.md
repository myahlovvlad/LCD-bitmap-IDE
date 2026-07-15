# Screen DSL Transaction Lifecycle Audit

Status: final — Phase 4B.3

## Atomicity boundary

`executeProjectChangeSet` in `src/application/changeSet.ts` is the atomicity
boundary. It accepts a `ProjectSession` and a `ProjectChangeSet`, executes all
commands in the set, calls `finalizeMutation`, and returns a new `ProjectSession`.
It never mutates the input session in place.

`applyScreenDslPreview` in `src/application/screenDsl/applyPreview.ts` is the
only public gateway that builds a `ProjectChangeSet` from a preview result and
calls `executeChangeSetWithHooks`. All pre-commit validation runs before
`finalizeMutation` is called.

## Transaction identity

Every Apply produces an `ScreenDslApplyTransaction` with:

- `id` — UUID v4 generated once per Apply call;
- `fingerprint` — deterministic FNV1a-64 hash over `{ projectId, importMode,
  baseRevision, baseScreenFingerprint, sourceFingerprint,
  identityPlanFingerprint, operations, destructive }`. The fingerprint does not
  include wall-clock time, file paths, or UI state.

Two Apply calls with identical inputs will produce identical fingerprints.

## Pre-commit validation

Before `finalizeMutation` is called, `applyScreenDslPreview` checks:

1. Preview lifecycle is not `'consumed'` or `'failed'`.
2. `preview.projectId === session.project.meta.id` (project mismatch guard).
3. `fingerprintScreenDslSource(sourceText) === preview.sourceFingerprint`
   (source drift guard).
4. `preview.baseRevision === session.revision` (revision drift guard).
5. Operation count ≤ `SCREEN_DSL_TRANSACTION_LIMITS.maxOperations`.
6. Affected screen count ≤ `maxAffectedScreens`.
7. Affected object count ≤ `maxAffectedObjects`.

Any failed check returns `applied: false` with a specific diagnostic code and
leaves the caller session unchanged.

## Preview consumption

On successful Apply, `applyScreenDslPreview` returns `updatedPreview` with
`lifecycle: 'consumed'`. Callers must replace their held preview reference with
`updatedPreview` so a second Apply attempt fails with
`SCREEN_DSL_APPLY_PREVIEW_CONSUMED`.

On validation failure, `updatedPreview` is returned with `lifecycle: 'failed'`.

## Revision and history

`finalizeMutation` increments `session.revision` exactly once per Apply. It
creates exactly one history entry per Apply via `createHistoryEntry` /
`appendHistoryEntry`. A failed pre-commit validation never reaches
`finalizeMutation`, so neither revision nor history entry is created.

## Failure injection

`ScreenDslApplyTestHooks` (defined in `src/application/screenDsl/testHooks.ts`)
is a DI interface accepted as an optional second argument to
`applyScreenDslPreview`. Hooks may throw to simulate failures at any operation
boundary. There is no global state, no environment-variable switch, and no
renderer hook.

## Known gap: double-apply with same original session

If the same `'current'` preview is applied twice to the same original
`ProjectSession` reference (before replacing the session reference), both
applications succeed because `baseRevision === session.revision` holds for both.
The consumed lifecycle check only protects against applying the `updatedPreview`
(which has `lifecycle: 'consumed'`). Protection against the original preview
being reused requires callers to also advance the session reference.

This gap is documented in `tests/utils/screenDslUpdateAtomicity.test.ts`
("applying consumed preview to the advanced session is rejected").

## Transaction limits

```
maxOperations:      200
maxAffectedScreens:  20
maxAffectedObjects: 1000
maxCreatedResources: 200
maxDiagnostics:     100
```

Source: `SCREEN_DSL_TRANSACTION_LIMITS` in
`src/application/screenDsl/transactionContract.ts`.
