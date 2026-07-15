# Screen Interchange Resource Model

Screen Interchange V1 separates resource payloads from authoring objects so
packages can validate closure before reconstruction.

## Resource Kinds

- `fonts`: font resources keyed by `font:<variant>`.
- `glyphs`: inline glyph override resources keyed by
  `glyph:<screenId>:<objectId>:override`.
- `bitmaps`: bitmap byte resources keyed by `bitmap:<screenId>:<objectId>`.

Bitmap objects store `bitmapRef` and not inline bytes. Special objects store
`glyphOverrideRef` when an inline glyph override exists. Text and special
objects include font refs in `resourceRefs`.

## Closure

A package is valid only when every object resource reference resolves inside
the package. Unused resources are warnings; missing object refs are errors.

The resource model does not introduce a global bitmap catalog or font editor
format. It mirrors the current schema-v5 authoring data.
