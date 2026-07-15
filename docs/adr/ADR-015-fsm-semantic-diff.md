# ADR-015: FSM Semantic Diff

## Status

Accepted.

## Decision

Compare canonical FSM interchange models by stable IDs and explicit order.
Renames are updates, not delete/create cycles. Layout moves are layout updates.

## Consequences

Round-trip preview can explain semantic impact before Apply and can reject
ambiguous or invalid input before project mutation.
