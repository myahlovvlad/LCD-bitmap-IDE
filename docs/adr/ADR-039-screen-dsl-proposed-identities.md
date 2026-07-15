# ADR-039: Screen DSL Proposed Identities

Status: accepted for preview planning

The parser does not generate committed IDs. Preview creates a deterministic
identity plan from project ID, revision, import mode and source fingerprint.

The plan does not reserve IDs in `ProjectSession`. Apply must use the plan from
the still-current Preview or reject as stale.
