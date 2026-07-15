# Screen Interchange Validation

`validateScreenInterchange` performs structural validation for Screen
Interchange V1 packages.

## Errors

- Wrong package kind or version.
- Project schema other than v5.
- Invalid display dimensions.
- Unsupported color mode or packing.
- `screenOrder` entry without a screen.
- `objectOrder` mismatch or missing object.
- Missing bitmap, glyph or font resource referenced by an object.

## Warnings

- Screen outside exported `screenOrder`.
- Object `order` differing from array index.
- Unused font, glyph or bitmap resources.

Validation is pure. It does not repair packages, execute code, mutate project
state or call the renderer/compiler.
