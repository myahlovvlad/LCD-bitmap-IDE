# FSM Script Studio Audit

Phase 3A starts from the existing FSM Script Studio and replaces direct project
replacement with explicit semantic preview and apply.

| Component | File | Function | Input | Output | Responsibility | Preserves IDs | Preserves layout | Deterministic | Executes arbitrary code | Round-trip support | Migration risk | Target layer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Script UI | `src/features/fsm-script/FsmScriptStudio.tsx` | Displays Mermaid/Python text, imports local text files, previews and applies script changes. | Active `ProjectSession`, edited text. | Preview status and explicit apply request. | Feature UI over application facade. | Yes via interchange directives. | Yes via interchange directives. | Yes for generated text. | No. | Phase 3A semantic preview/apply. | Medium: previous Apply replaced project snapshot. | Renderer/feature facade. |
| Legacy script converters | `src/features/fsm-script/fsmScript.ts` | Existing lightweight Mermaid/Python helpers. | Legacy projection text/project. | `ScriptFsmModel`. | Compatibility tests only. | Partial. | No. | Mostly. | No Python execution. | Partial, lossy. | Medium: kept for compatibility tests. | Feature legacy. |
| FSM workspace integration | `src/features/fsm/FsmWorkspace.tsx` | Opens Script Studio and applies previews through store/application session. | Zustand store session. | Command history update. | Renderer adapter. | Yes. | Yes. | Depends on explicit user Apply. | No. | Yes. | Low after Phase 3A. | Renderer adapter. |
| Application facade | `src/application/fsmRoundTrip/fsmRoundTripFacade.ts` | Export, parse, semantic diff, ChangeSet dry-run and explicit apply. | `ProjectSession`, text, format. | `FsmScriptPreview`, `ProjectCommandResult`. | Application boundary. | Yes. | Yes. | Yes. | No. | Yes. | Low. | Application. |
| Interchange model | `src/fsm-interchange/*` | Canonical authoring/interchange model, writers, parsers, diff and project apply. | Domain project or script text. | `FsmInterchangeModelV1`, diagnostics, source map, semantic diff. | Renderer-independent model layer. | Yes. | Yes. | Yes. | No. | Yes. | Low. | Domain-adjacent pure layer. |
| Existing FSM importer | `src/renderer/core/fsmImporter.ts` | Imports bundled/legacy FSM source. | Text fixture. | Legacy imported project model. | Existing importer path. | Legacy-specific. | Legacy-specific. | Yes for fixtures. | No Python. | Not Phase 3A target. | Low, unchanged. | Renderer core legacy. |

## Findings

- Previous Script Studio Apply called `loadProjectSnapshot` with a rebuilt
  project, bypassing Command Bus history semantics for script import.
- Previous Mermaid/Python formats were useful but lossy: stable transition IDs,
  graph layout, handles and event metadata were not represented losslessly.
- Existing Python-like parser was regex-based and did not execute code, but it
  silently ignored unsupported lines. Phase 3A parsers now return diagnostics
  with line/column.
- Graph layout source of truth is `project.fsm.graphLayout`; Phase 3A preserves
  coordinates through explicit interchange layout entries.
- Schema-v5 remains unchanged.

## Phase 3A Target

The supported path is:

```text
ProjectSession
-> FsmInterchangeModelV1
-> Mermaid/Python-like DSL text
-> safe parser
-> candidate FsmInterchangeModelV1
-> semantic diff
-> typed ChangeSet dry-run
-> explicit Apply
-> Command Bus history
```

Live synchronization is deferred.
