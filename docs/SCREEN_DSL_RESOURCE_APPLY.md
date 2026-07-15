# Screen DSL Resource Apply

Date: 2026-06-25

Screen DSL V1 resources are imported through the screen aggregate path used by
Screen Interchange. For the current project model, bitmap payloads are
reconstructed into bitmap canvas objects. Font and glyph resources remain
document dependencies for validation and reference integrity.

Create and clone Apply enforce this policy:

- same ID and same canonical content: reuse;
- same ID and different canonical content: block Apply with
  `SCREEN_DSL_RESOURCE_ID_CONFLICT`;
- clone mode resource IDs: rewritten by the preview identity plan;
- missing referenced resource: validation error before Apply.

The current implementation does not add a separate global resource-create
command. That remains a future requirement if screen resources become shared
project entities outside reconstructed canvas objects.
