# ADR-024: Malformed Behavior Storage

Status: accepted

Malformed reserved-prefix behavior storage is invalid, not opaque legacy data.

This prevents a typo in canonical storage from falling back into legacy execution. Raw values remain stored so users can repair or explicitly convert them later.
