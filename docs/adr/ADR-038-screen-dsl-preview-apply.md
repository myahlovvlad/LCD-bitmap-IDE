# ADR-038: Screen DSL Preview And Apply

Status: accepted for update-mode integration slice

Screen DSL text must not mutate project state while the user edits or previews
it. Preview creates an immutable result bound to project revision, source
fingerprint and target screen fingerprint. Apply is explicit and rejects stale
previews.

The first implementation supports update-mode Apply and blocks create/clone
Apply until exact-ID creation is available.
