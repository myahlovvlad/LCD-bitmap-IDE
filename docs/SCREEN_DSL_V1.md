# Screen DSL V1

Date: 2026-06-25

Screen DSL V1 is a text-facing import/export layer for LCD screen authoring.
It sits above `ScreenInterchangeProjectV1` and does not replace project state,
the compiler IR, the renderer, or Command Bus mutation paths.

## Canonical Document

Required root fields:

- `format`: must be `lcd-bitmap-ide/screen`
- `version`: must be `1`
- `layoutMode`: must be `explicit`
- `project`: project metadata and display configuration from Screen Interchange
- `screens`: ordered screen DTOs with explicit geometry and object identity
- `resources`: font, glyph and bitmap resource catalogs

Objects use `kind` in the DSL document and convert to Screen Interchange
`type` internally. Supported object kinds are:

- `text`
- `line`
- `rect`
- `icon`
- `bitmap`
- `special`
- `invert`

Canonical JSON is emitted as a single-line stable JSON document ending with a
newline. Canonical YAML is intentionally a restricted top-level form where
complex values are embedded as JSON-compatible flow values.

## Layout Policy

Only explicit LCD coordinates are accepted in V1. The parser rejects layout
modes such as `grid`, `auto`, `stack`, templates, or computed constraints with
`SCREEN_DSL_UNSUPPORTED_LAYOUT_MODE`.

This keeps V1 deterministic and avoids introducing a layout compiler before the
screen import/apply flow is proven.

## Identity Policy

Existing entities are matched by stable `id`. V1 diffing is identity-aware:
object updates with the same `id` are reported as `object.update`, not as
delete/create churn.

The first implementation does not yet allocate new committed IDs from
handwritten `localKey` values. That belongs in the later apply/import facade.

## Validation

Validation covers:

- format, version and layout mode
- duplicate screen IDs
- duplicate object IDs within a screen
- `objectOrder` vs `objects` array mismatch
- object `order` vs array order conflict
- finite integer geometry
- fully or partially out-of-bounds geometry warnings
- missing resource references
- 128x64 vertical page byte budget
- missing bitmap glyph coverage warnings

Warnings do not make the document invalid unless an error is also present.

## Parser Security

JSON input is scanned before `JSON.parse` to reject:

- duplicate object keys
- `__proto__`
- `prototype`
- `constructor`
- sources larger than the parser limit

YAML input is not general YAML. The V1 parser rejects:

- multiple documents
- custom tags
- anchors
- aliases
- merge keys
- unsupported nested block syntax

No YAML tags, references, executable constructs, implicit object merges, or
prototype-writing keys are allowed.

## Current Slice

Implemented in this slice:

- `src/screen-dsl` pure model, JSON/YAML parser/writer, conversion, diff and validation
- JSON and restricted YAML round-trip tests
- parser security tests
- pixel budget and glyph diagnostics tests
- performance envelope test
- architecture boundary coverage

Not implemented yet:

- Screen Schema Studio UI
- file dialog import/export workflow
- preview/apply coordinator
- atomic `screen.dsl.apply` facade over Command Bus/ChangeSet
- E2E coverage for stale preview, destructive import and UI apply flows
