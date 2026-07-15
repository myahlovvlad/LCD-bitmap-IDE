# ADR-031: Screen Canonical Serialization

## Status

Accepted.

## Context

Screen packages need stable comparison across object-map insertion order and
runtime environment differences.

## Decision

Canonical serialization recursively sorts object keys, preserves arrays and
omits `undefined` fields. Fingerprints are generated from canonical JSON.

## Consequences

- Screen order and object order stay semantically visible.
- Resource-map insertion order does not affect fingerprints.
- Fingerprints are deterministic identity signals, not cryptographic proofs.
