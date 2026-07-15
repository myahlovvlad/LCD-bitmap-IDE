# ADR-028: Script Preview Race Protection

Status: Accepted

Date: 2026-06-25

## Context

Debounced preview introduces asynchronous result ordering. A slower parse/dry-run
must not replace a newer result.

## Decision

Every preview request captures project ID, format, request sequence, source
fingerprint, base revision and FSM fingerprint. Results are accepted only when
all captured values still match the current document session.

## Consequences

Out-of-order results are ignored. Production code does not need delay hooks;
race behavior is covered by injected coordinator tests.
