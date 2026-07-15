# Screen DSL Resource Policy

Screen DSL V1 transfers the resource types already supported by
ScreenInterchangeModelV1:

- fonts;
- glyph overrides;
- bitmap byte resources.

Resource references are explicit. Missing references are errors. External URLs,
absolute file paths and path traversal references are not part of V1 and must
remain rejected by the future import facade.

The current core validation detects missing resource references and missing
bitmap payloads.

The application facade also enforces resource collision policy for create and
clone Apply. A same-ID font, glyph or bitmap resource may be reused only when
canonical resource content is identical. Different content under an existing ID
blocks Apply with `SCREEN_DSL_RESOURCE_ID_CONFLICT`. Clone mode avoids ordinary
collisions by rewriting resource IDs through the preview identity plan.
