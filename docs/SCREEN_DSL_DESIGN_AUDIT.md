# Screen DSL Design Audit

Date: 2026-06-25

Branch: `refactor/schema-first-screen-dsl`

Baseline commit: `c698c57 fix(renderer): fallback localized bitmap text by glyph coverage`

## Scope

Phase 4B adds a text-facing Screen DSL on top of `ScreenInterchangeModelV1`.
The DSL is not a new screen domain model. It is an authoring representation
that parses to a bounded DTO and then converts to the existing
`src/screen-interchange` package.

## Required Questions

1. Can `ScreenInterchangeModelV1` be the direct YAML/JSON contract?

   Not directly. It is already a deterministic semantic interchange contract,
   but it contains internal fields such as `kind`, traceability records and
   resource catalogs in record form. A text-facing DTO is still needed for
   format/version fields, explicit layout mode, import policy, local identity
   and parser diagnostics.

2. Is a separate text-facing DTO needed?

   Yes. `ScreenDslDocumentV1` should normalize JSON/YAML text before producing
   a `ScreenInterchangeProjectV1`. This keeps parser/CST concerns out of
   project state and out of Screen Interchange.

3. Which fields are mandatory in canonical DSL?

   `format`, `version`, `layoutMode`, `project`, `screens` and `resources`.
   Canonical export must include stable screen IDs, object IDs, object order,
   geometry, localized text and resource references.

4. Which fields can be optional for new entities?

   Handwritten create/clone documents may omit stable IDs and use `localKey`.
   The parser does not generate committed IDs; preview/application code must
   allocate proposed IDs deterministically from document identity.

5. How does DSL distinguish existing ID and proposed local identity?

   Stable identity uses `id`. Proposed identity uses `localKey`. The two are
   separate fields and must not be fuzzy-matched by name or array index.

6. Which resources can be transferred losslessly?

   Phase 4A supports fonts, glyph override resources and bitmap byte resources.
   Current conversion can reconstruct screen objects, bitmap bytes and glyph
   override data losslessly for supported object kinds.

7. Can current Command Bus atomically create/update screens?

   It can atomically execute a `ProjectChangeSet`. Screen-level commands exist
   for create, duplicate, rename, resize, delete, reorder, create from template,
   add/update/delete objects and replace a screen object list.

8. Which object mutations already have commands?

   `canvas.object.add`, `canvas.object.update`, `canvas.objects.update`,
   `canvas.objects.delete`, `canvas.bitmapLayer.add` and
   `canvas.selection.set`.

9. Which commands are missing?

   There is no dedicated `screen.dsl.apply` command and no single command for
   replacing a whole screen including metadata, dimensions and object order.
   Phase 4B can map update mode to existing `screen.rename`, `screen.resize`
   and `canvas.objects.update` commands for the first vertical slice.

10. Can multi-screen import be applied in one ChangeSet?

   Yes for existing commands, as long as all commands share the same
   `projectId` and `expectedRevision`. Full resource collision handling still
   needs a facade.

11. Where is pure raster preview?

   The pure raster path is `src/renderer/utils/render.ts` and compiler lowering
   mirrors it in `src/compiler/lowering/rendering.ts`. Tests use renderer utils
   as the current raster characterization oracle.

12. How are text/glyph bounds computed?

   `LCDCanvas.getObjectBounds` measures text through `FontRenderer` and
   `renderTextBitmask`. The language fallback now checks glyph coverage via
   `resolveLocalizedBitmapText`.

13. Is there a safe YAML parser dependency?

   No YAML parser dependency is present in `package.json`. To avoid adding a
   major dependency in the first slice, Phase 4B should support a strict
   canonical YAML subset emitted by the writer and reject custom tags, aliases,
   merges and multi-document YAML.

14. Is there a source-aware JSON parser?

   No dependency is present. A small internal scanner is needed for duplicate
   key detection and approximate line/column diagnostics before `JSON.parse`.

15. Do parser dependencies detect duplicate keys?

   There are no parser dependencies for YAML/JSON beyond native `JSON.parse`.
   Native JSON parsing does not reject duplicate keys, so Phase 4B must scan
   for them before parsing.

16. Does current IPC safely open `.yaml/.yml/.json`?

   Current file import patterns exist in renderer components, but no dedicated
   Screen Schema Studio IPC/file workflow exists yet. The first slice should
   keep parsing pure and defer UI file dialogs until the minimal studio.

17. Which architectural risks does text import create?

   Risks: duplicate keys hiding values, YAML executable/custom constructs,
   prototype pollution, resource overwrite, accidental full-project replacement,
   stale preview apply, object delete ambiguity, unsupported layout constructs
   being silently accepted, and direct Zustand mutation bypassing Command Bus.

## Parser Decision

Initial implementation uses:

- strict source-aware JSON scanner for duplicate keys and prototype keys;
- canonical JSON writer using stable key order through Screen Interchange
  canonicalization;
- restricted YAML writer/reader for canonical export shape only;
- no custom YAML tags, aliases, anchors, merge keys or multiple documents;
- unsupported layout modes diagnosed as `SCREEN_DSL_UNSUPPORTED_LAYOUT_MODE`.

## Source Of Truth

`ScreenInterchangeProjectV1` remains the semantic source for DSL conversion.
`ScreenDslDocumentV1` is transient authoring data. Project mutation must pass
through preview and existing Command Bus/ChangeSet paths.
