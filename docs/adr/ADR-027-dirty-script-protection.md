# ADR-027: Dirty Script Protection

Status: Accepted

Date: 2026-06-25

## Context

Graph changes can produce a newer canonical script while the user is editing an
older draft. Replacing that draft silently would lose work.

## Decision

Clean documents may auto-refresh from graph changes. Dirty documents are
preserved and marked stale. Refreshing a dirty document requires confirmation;
Discard is explicit.

## Consequences

The UI favors preserving user text over automatic reconciliation. Semantic merge
is deferred.
