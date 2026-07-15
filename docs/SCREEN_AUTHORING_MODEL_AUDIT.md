# Screen Authoring Model Audit

Date: 2026-06-25

Branch: `refactor/screen-interchange-model-v1`

Baseline commit: `47ed99c feat(fsm): integrate controlled script synchronization`

## Scope

This audit captures the current LCD screen authoring model before introducing
Screen Interchange Model V1. Phase 4A must preserve schema-v5, renderer output
and generated C/binary output.

## Current Sources

| Area | File path | Type | Canonical owner | Persisted | Authoring relevance | Renderer usage | Compiler/export usage | Ordering semantics | Lossless interchange requirement | Target field |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project screen order | `src/domain/project.ts` | `LcdBitmapProject.screenOrder` | schema-v5 project | Yes | Yes | Screen list, all-screen export order | Compiler source snapshots, all-screen C/binary | Array order is semantic | Preserve exact order and referenced screen IDs | `project.screenOrder` |
| Screen entity | `src/domain/project.ts` | `LcdScreen` | schema-v5 project | Yes | Yes | LCD workspace/editor | Export and compiler snapshot | Project `screenOrder` | Preserve IDs, metadata, dimensions and objects | `screens[]` |
| Screen geometry | `src/domain/project.ts` | `LcdScreen.width/height` | screen entity | Yes | Yes | Canvas size, hit testing, export dimensions | Binary length and render dimensions | N/A | Preserve exact numeric dimensions | `screen.display.width/height` |
| Screen metadata | `src/domain/project.ts` | name, description, tags, timestamps | screen entity | Yes | Yes | Lists/properties/templates | Symbols/traceability indirectly | N/A | Preserve metadata, mark timestamps as metadata not raster semantics | `screen.meta` |
| Object list | `src/domain/canvas.ts` | `CanvasObject[]` | `LcdScreen.objects` | Yes | Yes | Editor, renderer, selection | Render/codegen/compiler | Array order is authoring order; raster sorts by `zIndex` | Preserve array order and `zIndex` | `screen.objects[].order`, `zIndex` |
| Selection | `src/domain/project.ts` | `selectedObjectIds` | renderer UI state stored in screen | Yes | Runtime/UI only | Editor selection | Not compiler/export | Array order is UI selection only | Keep out of authoring equality; preserve in trace metadata if needed | Not in V1 authoring payload |
| Text object | `src/domain/canvas.ts` | `TextCanvasObject` | screen object | Yes | Yes | Draw text via active language fallback | Render/codegen/compiler | Object order + zIndex | Preserve localized text, x/y, font variant, pending translation | `object.type=text` |
| Line object | `src/domain/canvas.ts` | `LineCanvasObject` | screen object | Yes | Yes | Bresenham render | Render/codegen/compiler | Object order + zIndex | Preserve endpoints | `object.type=line` |
| Rect object | `src/domain/canvas.ts` | `RectCanvasObject` | screen object | Yes | Yes | Outline/filled render | Render/codegen/compiler | Object order + zIndex | Preserve x/y/width/height/filled | `object.type=rect` |
| Icon object | `src/domain/canvas.ts` | `IconCanvasObject` | screen object | Yes | Partially supported | Renderer draws placeholder rectangle | Compiler normalizes icon metadata | Object order + zIndex | Preserve iconId and geometry; raster compatibility is placeholder rectangle | `object.type=icon` |
| Bitmap object | `src/domain/canvas.ts` | `BitmapCanvasObject` | screen object | Yes | Yes | Byte unpack/draw | Render/codegen/compiler | Object order + zIndex | Preserve byte array, dimensions, name and placement | `object.type=bitmap` + resource ref |
| Special object | `src/domain/canvas.ts` | `SpecialCanvasObject` | screen object | Yes | Yes | Built-in widget drawing, optional glyph override | Render/codegen/compiler | Object order + zIndex | Preserve kind, value, checked, glyph ref/override | `object.type=special` |
| Invert object | `src/domain/canvas.ts` | `InvertCanvasObject` | screen object | Yes | Yes | Inverts rectangular pixels after earlier objects | Render/codegen/compiler | Order/zIndex highly semantic | Preserve rectangle and zIndex exactly | `object.type=invert` |
| Font variants | `src/domain/canvas.ts`, `src/domain/fonts.ts` | `FontVariant` | domain/font state | Yes/auxiliary | Yes | FontRenderer text/special glyph render | Render/codegen/compiler | N/A | Preserve references as stable variant keys | `resources.fonts` and object refs |
| Project glyphs | `src/domain/project.ts` | `ProjectGlyph` | schema-v5 project | Yes | Yes | Future glyph workflows | Compiler/source data | N/A | Preserve glyph IDs and glyph bitmap data | `resources.glyphs` |
| Loaded font glyphs | `ProjectSnapshotV5.fontGlyphs` | auxiliary workspace data | workspace/session | Save snapshot auxiliary | Yes | FontRenderer | Render/codegen via workspace | N/A | Include when exporting project interchange; selected-screen closure should include referenced variants | `resources.fontTables` |
| Bitmap bytes | `BitmapCanvasObject.bytes` | number array | object inline | Yes | Yes | unpackBytesToFrameBuffer | Render/codegen/compiler | Byte order is vertical-LSB for bitmap resource | Preserve byte-for-byte | `resources.bitmaps` with object ref |
| FSM-screen links | `FsmState.screenId`, `ProjectBindings.statesByScreenId` | state references + derived bindings | FSM state is authoritative | Yes/derived | Traceability | Linked state display/navigation | Not screen raster | State order controls linked-state order | Preserve traceability, not required for single-screen authoring equality | `trace.linkedStateIds` |

## Required Questions

1. Where is the canonical source of screen geometry?

   `LcdScreen.width` and `LcdScreen.height` in schema-v5 are canonical for
   screen dimensions. Object geometry lives on each `CanvasObject`.

2. Where is the canonical source of object order?

   `LcdScreen.objects` array order is the authoring order. Raster rendering
   filters visible objects and sorts by `zIndex`; equal `zIndex` relies on
   stable JavaScript sort preserving original array order.

3. Are there separate layers or only a flat object list?

   There are no separate screen layers. The current model is a flat object list
   with `zIndex`.

4. What is the source of truth: objects, pixel buffer or both?

   Editable objects are the source of truth. Raster framebuffers, packed bytes,
   C arrays and screenshots are derived. Bitmap object byte arrays are inline
   source data for that object, not a whole-screen source buffer.

5. Which screen representations are derived?

   Framebuffer, packed binary bytes, C arrays/headers, screenshots, thumbnails,
   validation output and compiler IR are derived.

6. Which object types are actually supported?

   `text`, `line`, `rect`, `icon`, `bitmap`, `special` and `invert`. `icon`
   currently renders as a placeholder rectangle, so it is authoring-preserved
   but has limited raster semantics.

7. Which object fields are used by the renderer?

   Common fields: `type`, `zIndex`, `visible`. Hit testing also uses `locked`
   and geometry. Type-specific render fields are text localized values,
   coordinates, dimensions, bitmap bytes, special widget fields and invert
   rectangle fields.

8. Which object fields are used by compiler/export?

   Export uses renderer render semantics through `renderCanvasObjects`.
   Compiler normalization preserves object IDs, type, order, zIndex, visibility,
   lock/source metadata and type-specific fields. Production C/binary export
   remains renderer-owned.

9. How are glyph/font references stored?

   Text objects reference `fontVariant`. Special objects may reference
   `fontVariant`, `glyphChar` and optional inline `glyphOverride`. Project
   glyphs and loaded font glyph tables are separate project/workspace resources.

10. How are bitmap resources stored?

    Bitmap objects store `bytes` inline with `name`, `width`, `height`, `x` and
    `y`. There is no global bitmap resource catalog today.

11. How are localization/text values stored?

    `TextCanvasObject.text` is `LocalizedText` with language keys. Rendering
    selects active language, then falls back to `ru`, then `en`.

12. What data can be lost in domain -> interchange -> domain?

    No current field needs to be lost if V1 preserves all object unions and
    metadata. `selectedObjectIds` is UI state, not authoring state; excluding it
    from authoring equality is intentional.

13. Is schema migration required for lossless interchange?

    No. Current schema-v5 fields are sufficient for a lossless authoring
    snapshot of supported object types.

14. Does object interpretation depend on React/Canvas/DOM?

    Authoring interpretation does not need React, Canvas or DOM. Raster output
    is currently implemented by renderer utilities, so raster comparison in
    Phase 4A should call the existing renderer only from tests/adapters, not
    from the interchange model.

15. Can we create a renderer-independent snapshot?

    Yes. `src/domain` already exposes renderer-independent project/screen/object
    contracts. Screen Interchange V1 can import `src/domain` but must not import
    `src/renderer`, React, Zustand, Electron or compiler backends.

## Source-of-Truth Decision

Screen Interchange Model V1 will treat schema-v5 `LcdScreen` objects as the
canonical input and will produce a renderer-independent authoring/interchange
snapshot. It will not use `NormalizedCompilerIrV1` as editable source.

## Risks

- `icon` object raster behavior is intentionally placeholder-like today.
- Whole-screen raster equality is not authoring equality; `zIndex` and object
  order must be compared separately.
- Auxiliary `fontGlyphs` can affect rendered bytes while not being part of the
  persisted `LcdScreen`; project-level interchange should include a resource
  closure for available font tables when supplied by an application workspace.
- Existing all-screen C header uses the constant `SCREEN_BYTE_LENGTH` in table
  rows; Phase 4A must not change that production behavior.

## Stop Condition Review

No stop condition is present:

- `47ed99c` exists and is the Phase 4A base.
- Working tree was clean before the audit.
- Canonical screen and object sources are identifiable.
- Lossless authoring interchange does not require schema-v5 changes.
- Renderer-independent conversion can be implemented from domain contracts.
- Generated C/binary paths do not need to change.
