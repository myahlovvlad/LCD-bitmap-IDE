# ADR-036: Screen DSL Import ChangeSet

Status: deferred after core slice

Screen DSL Apply must eventually map a validated candidate and semantic diff to
a typed ProjectChangeSet. It must not assign directly to Zustand or replace the
whole project snapshot.

The current implementation stops before application mutation and exposes the
pure data needed for that facade.
