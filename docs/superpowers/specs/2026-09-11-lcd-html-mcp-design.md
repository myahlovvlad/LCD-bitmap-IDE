# LCD HTML Interchange and MCP Design

## Goal

Give Codex and firmware integrators a concise, readable and lossless text representation of every LCD screen, and expose controlled conversion in both directions through the existing MCP automation registry.

## Scope

The feature handles LCD screen layout only. It does not create embedded C/C++ firmware, change an FSM transition, execute JavaScript from an imported file, or accept arbitrary browser layouts as an instrument screen.

## Canonical model

The existing `LcdScreen` / Screen DSL model remains the source of truth. HTML is a deterministic interchange view that always contains an explicit 128 by 64 pixel coordinate system and the full object metadata needed to rebuild the screen.

Each document uses a single root:

```html
<section data-lcd-format="lcd-bitmap-ide/html" data-lcd-version="1"
  data-lcd-screen-id="photometry" data-lcd-width="128" data-lcd-height="64">
  <lcd-text data-lcd-id="title" data-lcd-x="0" data-lcd-y="0"
    data-lcd-font="2" data-lcd-text-en="Photometry" data-lcd-text-ru="Фотометрия"></lcd-text>
  <lcd-rect data-lcd-id="header" data-lcd-x="0" data-lcd-y="9"
    data-lcd-width="128" data-lcd-height="1" data-lcd-filled="true"></lcd-rect>
</section>
```

The only accepted layout elements are `lcd-text`, `lcd-line`, `lcd-rect`, `lcd-icon`, `lcd-bitmap`, `lcd-special`, and `lcd-invert`. Their `data-lcd-*` attributes map one-to-one to the corresponding canvas-object fields. The document may contain a generated `<style>` and `<template data-lcd-preview>` for human viewing, but those elements are ignored during import. Scripts, event attributes, remote URLs, CSS-derived geometry, unknown tags inside the screen root, and attributes not in the schema are rejected.

## Bidirectional conversion

`screenToLcdHtml(screen)` emits stable ordering by z-index then object id, HTML-escapes values, includes all visual fields and a fixed pixel-preview stylesheet. The generated HTML is legible to Codex: each visual object occupies one element and coordinates are visible as named attributes.

`lcdHtmlToScreen(source)` parses the restricted document without executing it, validates format/version/dimensions/object attributes, and produces an existing Screen Interchange / Screen DSL candidate. Import works in two phases: preview returns diagnostics and a semantic diff; apply requires the current project revision and uses the existing atomic Screen DSL apply path. The converter never silently clips or drops an object.

Round-trip contract: `HTML → screen → HTML` is canonical and stable; `screen → HTML → screen` preserves screen id, dimensions, object ordering and all supported object fields. Rendered pixel buffers before and after a supported round trip must be identical.

## MCP contract

Read tools:

- `export_screen_html({ screenId })` returns `html`, `screenId`, 128×64 dimensions, SHA-256 and layout diagnostics.
- `analyze_128x64_screens({ screenId? })` audits one screen or all project screens for exact dimensions, clipping, overlap and spacing. It does not modify the project.

Write tools:

- `preview_screen_html_import({ html, mode, targetScreenId? })` validates and returns screen diagnostics, the proposed canonical HTML and semantic changes. It has no side effects.
- `apply_screen_html_import({ html, mode, targetScreenId?, expectedRevision })` repeats validation and applies the existing atomic Screen DSL change set. It requires `project:write`, an optimistic revision, and supports dry-run.

`mode` follows existing Screen DSL semantics: `create`, `update`, or `clone`. A read tool may never mutate a project; an apply tool may not accept an HTML import that produced any error-level diagnostic.

## Error handling and safety

The parser imposes a 512 KiB source limit and the existing maximum object count. It reports paths such as `screens[0].objects[2].data-lcd-x` in structured diagnostics. Non-128×64 documents are valid only if the project explicitly uses a different profile; the ECROS analyzer will mark them noncompliant and never resize them automatically.

## Verification

Tests must demonstrate:

1. deterministic HTML export for text, line, rectangle and every remaining supported object type;
2. rejection of scripts, unknown elements, event attributes, non-integer coordinates and missing localized text;
3. canonical `screen → HTML → screen` object equality and zero framebuffer differences for a 128×64 fixture;
4. preview does not change the project and apply creates exactly one undoable revision;
5. registry/MCP schema parity for all four new tools;
6. ECROS September project can export selected real screens and the 128×64 analyzer reports a structured summary.
