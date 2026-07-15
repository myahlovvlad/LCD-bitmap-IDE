# ADR-023: Backend Process Compatibility

Status: accepted

`backendProcessId` remains a backend process entity reference by default. Typed effects require the `@lcdide.effects/v1` envelope.

The runtime continues to execute existing backend process requests through the old process lookup path. Typed effects are surfaced as application-layer behavior and do not execute hardware, LCD driver or HAL operations.
