# ADR-025: Script Document Session

Status: Accepted

Date: 2026-06-25

## Context

Script Studio previously stored Mermaid and Python source in local React state.
That was enough for explicit Preview -> Apply, but not for safe graph-to-script
synchronization, workspace switches or out-of-order preview protection.

## Decision

Introduce a transient `FsmScriptDocumentSession` keyed by project ID and format.
The session stores source text, fingerprints, baseline revision/FSM fingerprint,
preview state and logical request sequence. It is not persisted in schema-v5.

## Consequences

Drafts are now explicit application authoring state. Project state remains the
canonical engineering source, and script edits still do not create command
history.
