# Screen Interchange Object Model

Screen Interchange V1 keeps the current LCD screen authoring model explicit and
lossless for supported schema-v5 object kinds.

## Supported Objects

- `text`: localized text, x/y, font variant and pending translation flag.
- `line`: x0/y0/x1/y1.
- `rect`: x/y/width/height and filled flag.
- `icon`: icon id and rectangle.
- `bitmap`: rectangle plus `bitmapRef`.
- `special`: kind, rectangle, checked/value, optional font, glyph char and
  optional `glyphOverrideRef`.
- `invert`: rectangle.

Every object includes stable `id`, `order`, `zIndex`, `visible`, `locked`,
`source` and `resourceRefs`.

## Authoring Equality

Authoring equality is based on screen metadata, object order, object fields and
resource content. UI-only `selectedObjectIds` is not part of the screen object
model; it is carried in traceability for optional reconstruction.

Raster equality remains renderer-owned and is covered by existing renderer and
legacy codegen characterization tests.
