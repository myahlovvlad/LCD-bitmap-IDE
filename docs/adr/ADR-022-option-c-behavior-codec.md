# ADR-022: Option C Behavior Codec

Status: accepted

Option C keeps schema-v5 unchanged while adding explicit typed behavior storage:

- guards use `condition` with `@lcdide.guard/v1`;
- typed effects use `backendProcessId` with `@lcdide.effects/v1`;
- ordinary legacy values are preserved;
- malformed reserved-prefix values are invalid.

This avoids schema-v6 during Phase 3B.1 and keeps live sync deferred.
