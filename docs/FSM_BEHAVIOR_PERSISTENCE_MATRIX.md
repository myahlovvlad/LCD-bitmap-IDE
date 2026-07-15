# FSM Behavior Persistence Matrix

| Condition | backendProcessId | Parse Result | Validation | Runtime | Round-trip | Compiler Visibility | Diagnostic |
|---|---|---|---|---|---|---|---|
| empty | empty | empty guard + none backend | pass | no behavior | lossless | `guard.empty`, `backend.none` | none |
| legacy opaque | empty | opaque guard + none backend | pass | legacy guard evaluator | lossless | `guard.opaque` | none |
| canonical guard | empty | typed guard + none backend | pass | typed guard evaluator | deterministic canonical | `guard.typed` | none |
| malformed canonical | empty | invalid guard + none backend | error | transition not selected | raw preserved | `guard.invalid` | `transition-guard-invalid` |
| empty | legacy process ID | empty guard + legacy backend reference | pass if process exists | existing backend process path | lossless | `backend.legacy-backend-process` | missing process if absent |
| empty | canonical effect | empty guard + typed effects | pass | typed effect log, no hardware execution | deterministic canonical | `backend.typed-effects` | none |
| canonical guard | legacy process ID | typed guard + legacy backend reference | pass if process exists | typed guard, legacy backend | lossless | both states distinct | missing process if absent |
| canonical guard | canonical effect | typed guard + typed effects | pass | typed guard, typed effects | deterministic canonical | both states distinct | none |
| opaque condition | opaque backendProcessId | opaque guard + opaque backend | pass | legacy guard only; backend ignored | raw preserved | `guard.opaque`, `backend.opaque` | none |
| malformed canonical | canonical effect | invalid guard + typed effects | error | guard blocks transition | raw preserved | invalid guard + typed effects | `transition-guard-invalid` |

## Repository Fixture Variants

- Demo transition `tr-main-measure` starts as no guard and no backend behavior.
- Migrated legacy `cliCommands` create `process-tr-main-measure`, which remains a legacy backend process reference.
- Existing condition snippets such as `button == START` remain opaque legacy guard strings.
- Mermaid and Python-like DSL directives persist both fields as explicit transition attributes.

## Save, Diff and History

Semantic diff compares transition records by value, so opaque-to-typed conversion is explicit. Undo/Redo restores raw `condition` and `backendProcessId` bytes through existing history patches.

## Blocked Combination

Schema-v5 has only one `backendProcessId` field. It can hold a legacy backend process reference or a typed effects envelope, not both. A future migration must add a structured behavior field before mixed legacy-reference plus typed-effect editing is allowed.
