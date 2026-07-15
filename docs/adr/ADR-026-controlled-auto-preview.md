# ADR-026: Controlled Auto-Preview

Status: Accepted

Date: 2026-06-25

## Context

Users need fast feedback while editing script text, but automatic Apply would
turn free text editing into hidden graph mutation.

## Decision

Allow debounced automatic Preview only. Auto-preview may parse, diff and dry-run
the existing ChangeSet. It never calls Apply.

## Consequences

Apply remains explicit. Tests assert that auto-preview does not increment
revision or create command history.
