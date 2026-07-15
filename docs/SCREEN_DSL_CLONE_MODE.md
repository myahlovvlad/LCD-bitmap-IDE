# Screen DSL Clone Mode

Date: 2026-06-25

Clone mode treats IDs in the source document as origin trace and creates new
committed IDs before Apply. Repeated Preview for the same session/source returns
the same identity plan.

Preview rewrites:

- screen IDs;
- object IDs and object order;
- object resource references;
- bitmap references;
- special glyph override references;
- font, glyph and bitmap resource IDs;
- bitmap `sourceObjectId` links.

FSM `linkedStateIds` are intentionally omitted from clone output. The original
screen remains unchanged. Apply uses the rewritten package through
`screen.dsl.apply`, so Undo removes only the clone and Redo restores the same
clone IDs.

Deferred outside the application slice:

- visible clone identity plan UI;
- raster equality display in Screen Schema Studio;
- optional explicit FSM-link copy policy.
