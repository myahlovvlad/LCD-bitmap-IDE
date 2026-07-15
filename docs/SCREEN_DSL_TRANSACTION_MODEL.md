# Screen DSL Transaction Model

## Typed operations

`ScreenDslApplyOperation` is a discriminated union:

```
CreateScreensOperation        — create mode; creates one or more screens
UpdateScreenNameOperation     — update mode; renames an existing screen
UpdateScreenDimensionsOperation — update mode; resizes an existing screen
UpdateScreenObjectsOperation  — update mode; replaces objects on a screen
```

Operations are built by `buildScreenDslApplyOperations` from the preview
`changeSet`. `buildScreenDslApplyTransaction` assembles the full
`ScreenDslApplyTransaction` from operations plus preview metadata.

## Operation ordering

Deterministic ordering within a ChangeSet:
`resources → screens → objects → update → relink → reorder → delete → validate → commit`

In practice, create/clone mode produces a single `screen.dsl.apply` command;
update mode produces `screen.rename`, `screen.resize`, and
`canvas.objects.update` in separate commands within one ChangeSet.

## Transaction fingerprint

Computed by `computeScreenDslTransactionFingerprint` using FNV1a-64 over a
stable JSON string containing:

```
{ projectId, importMode, baseRevision, baseScreenFingerprint,
  sourceFingerprint, identityPlanFingerprint, operations, destructive }
```

The fingerprint is stable across separate process runs given the same inputs.
It does not encode wall-clock time, file paths, or UI-layer state.

## Transaction status lifecycle

```
prepared → validating → applying → committed
                     ↘ rolled-back
         → rejected
         → consumed    (after committed: updatedPreview.lifecycle)
```

`ScreenDslApplyTransactionStatus` in `transactionContract.ts`.
