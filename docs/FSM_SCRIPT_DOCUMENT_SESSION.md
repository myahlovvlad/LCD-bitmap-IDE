# FSM Script Document Session

`FsmScriptDocumentSession` is a transient authoring contract. It is safe to keep
in renderer/application memory, but it is not a project schema field.

## Identity

Document identity is:

```text
projectId + format
```

Mermaid and Python-like DSL have independent sessions.

## Fields

- `sourceText`: current authoring text.
- `sourceFingerprint`: deterministic fingerprint of `sourceText`.
- `baseRevision`: project revision used for the current document baseline.
- `baseFsmFingerprint`: canonical FSM fingerprint used for the current
  document baseline.
- `generatedSourceFingerprint`: fingerprint of the last generated clean source.
- `dirty`: true when source text differs from the generated clean source.
- `status`: clean, dirty, scheduled, parsing, invalid, preview-ready, stale,
  conflicted, applying, applied or failed.
- `requestSequence`: monotonic logical preview request sequence.
- `activeRequestSequence`: latest in-flight logical request.
- `preview`: accepted preview result for this document only.
- `diagnostics`: parser/dry-run diagnostics.
- `staleReason`: graph, source, project, request, preview or apply rejection.

The session does not contain project snapshots, command history, DOM nodes,
timers, renderer selections or editor references.

## Fingerprints

The source fingerprint depends only on source text. The FSM fingerprint depends
on the canonical FSM interchange model. Neither depends on time, active
workspace, selection, zoom, path or machine name.
