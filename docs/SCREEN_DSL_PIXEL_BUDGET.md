# Screen DSL Pixel Budget

The V1 pixel-budget guard keeps LCD geometry explicit and deterministic.

For a 128x64 monochrome vertical-page screen, framebuffer size is:

```text
ceil(64 / 8) * 128 = 1024 bytes
```

Validation reports:

- invalid integer geometry as errors;
- fully out-of-bounds geometry as warnings;
- partially out-of-bounds geometry as warnings;
- missing glyph coverage as warnings.

Validation does not clamp, crop, move or auto-layout objects.
