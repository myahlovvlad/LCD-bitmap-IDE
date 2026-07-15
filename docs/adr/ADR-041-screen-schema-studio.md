# ADR-041: Screen Schema Studio

Status: deferred after application facade

Screen Schema Studio should be a minimal editor surface over the application
Preview/Apply API. It must not parse and mutate Zustand directly.

Required UI states: draft, diagnostics, preview, stale preview, destructive
confirmation, apply success and apply rejection.
