# ADR-049: Screen DSL Preview Consumption Lifecycle

Status: Accepted

Date: 2026-06-25

## Context

A `ScreenDslPreviewResult` is computed against a specific project revision and
source fingerprint. If it is applied twice, the second application could succeed
or fail depending on whether the session reference was advanced. Without explicit
lifecycle tracking, consumers had no signal for "this preview is already spent."

## Decision

`ScreenDslPreviewResult` carries a `lifecycle` field:
`'current' | 'stale' | 'applying' | 'consumed' | 'failed'`.

`createScreenDslPreview` returns previews with `lifecycle: 'current'`.

`applyScreenDslPreview` returns `updatedPreview` in every result (both success
and failure). On success, `updatedPreview.lifecycle` is `'consumed'`. On
validation failure, it is `'failed'`. Callers must replace their held preview
reference with `updatedPreview` after each Apply attempt.

Applying a preview with `lifecycle: 'consumed'` returns `applied: false` with
`SCREEN_DSL_APPLY_PREVIEW_CONSUMED`. Applying with `lifecycle: 'failed'` returns
`SCREEN_DSL_APPLY_PREVIEW_FAILED`.

## Consequences

The lifecycle field makes double-apply visible without requiring a separate
registry or mutable preview ID tracking. The known gap (same `'current'` preview
applied to the same original session twice) is documented in
`SCREEN_DSL_TRANSACTION_AUDIT.md`. Full protection requires callers to also
advance their session reference.
