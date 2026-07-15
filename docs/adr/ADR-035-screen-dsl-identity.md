# ADR-035: Screen DSL Identity

Status: accepted for core slice

Stable `id` is the only identity used for existing screens, objects and
resources. Names and array indexes are never identity.

`localKey` is reserved for future proposed entities and must be resolved by the
Preview/Apply layer, not by the parser.
