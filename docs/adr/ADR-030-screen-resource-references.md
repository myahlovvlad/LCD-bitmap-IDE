# ADR-030: Screen Resource References

## Status

Accepted.

## Context

Bitmap bytes and inline glyph overrides are authoring resources but were stored
inside screen objects.

## Decision

Move bitmap bytes and glyph overrides into package resources and store refs on
the corresponding interchange objects.

## Consequences

- Validation can prove resource closure.
- Reconstruction remains lossless for current schema-v5 screen objects.
- No new global resource catalog is introduced in project schema v5.
