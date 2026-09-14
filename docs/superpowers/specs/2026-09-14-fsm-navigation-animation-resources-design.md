# FSM Navigation and Animation Resources Design

## Goal

Restore visible FSM transitions in read-only mode, make navigator and FSM sidebars independently understandable and collapsible, improve the existing raster-import-to-pixel-editing workflow, and add exportable 1bpp animation resources reusable as full-screen or bitmap-layer content.

## Confirmed Product Decisions

- Animation resources are persisted in `.lcdproj` and exported to firmware as frame arrays and timing metadata.
- One animation resource can be bound either to an entire LCD screen or to a bitmap object on a screen.
- Full-screen and layer animation use the same 1bpp frames, duration and loop semantics.
- Runtime-tag text is the preferred representation for changing numeric information such as a countdown; animation is for pixel graphics.
- The global workspace navigator and local FSM state/inspector panes are independent controls.

## FSM Graph

All `StateNode` handles remain mounted for every node so a persisted transition referring to `s-*` or `t-*` is renderable in both read-only and edit modes. Read-only mode disables connection interaction and visually suppresses the handle affordance; it does not remove geometry required by React Flow.

The FSM canvas reports `shownTransitions / totalTransitions`. It reports a nonzero hidden count with the active reason: overview, focused subsystem, or layer filtering. The status exposes a control that restores all layers, clears focused subsystem and exits overview. In overview, only transitions whose endpoints are shown are drawn; the counter explicitly makes the simplification observable. The all-screens view remains the complete transition view.

## Navigation and Panels

The application-wide command is named `Collapse navigator` / `Свернуть навигатор` and changes only the workspace navigator to icon mode. It no longer applies global CSS that hides workspace entity sidebars.

`FsmWorkspace` owns persistent left and right collapse flags. A collapsed pane consumes a narrow, visible rail containing its own restore control. The grid template switches to the rail width, so no unused full-width column remains. Resizing is disabled while the corresponding pane is collapsed. The controls expose correct `aria-label`, `aria-expanded`, tooltip and keyboard focus behavior.

## Raster Import

The existing `PixelImporter` remains the single conversion pipeline for PNG, JPEG, BMP and SVG: bounded file validation, fit to target raster, thresholding and optional dithering. Applying an import to the current screen creates a selected bitmap object, preserving the current canvas for manual pixel editing. The workflow exposes fit mode and destination position before applying. "Insert and edit bitmap" switches to the editor with the new object selected. This same converter creates animation frames.

## Animation Domain and Rendering

Project data gains an `animations` catalog and order. An `AnimationResource` has an id, name, width, height, loop mode and ordered 1bpp frames. Each frame has an id, bitmap bytes and a positive `durationMs`.

An `AnimationBinding` is either:

- a full-screen binding owned by an `LcdScreen`, which uses display-sized frames and renders in place of the static screen; or
- a bitmap-layer binding owned by a `BitmapCanvasObject`, which replaces that object's static bytes at its x/y geometry while rendering the rest of the screen normally.

The renderer accepts an animation clock and deterministically resolves a frame by cumulative duration. It falls back to static screen/object pixels when a binding has no valid resource or when no clock is supplied. Project migration normalizes absent animation fields to empty catalogs and removes bindings to missing resources.

## Animation Authoring and Preview

The LCD workspace has an animation-resource panel. It supports create, rename, add a frame from the raster importer, duplicate frame, remove frame, reorder frames, edit duration, select loop/non-loop, and assign the resource to the selected screen or bitmap object. Full-screen assignment is disabled with an actionable reason unless every frame matches screen dimensions. Layer assignment is disabled unless frame dimensions match the selected bitmap object.

The panel has play, pause, replay and frame scrub controls. The LCD preview advances only while playing and uses the deterministic resolver; tests use an injected clock rather than wall-clock timing.

## Firmware Export

The compiler exports each resource as one 1bpp byte array per frame and a typed C frame table:

```c
typedef struct { const uint8_t *bytes; uint32_t byte_count; uint32_t duration_ms; } lcd_animation_frame_t;
typedef struct { const lcd_animation_frame_t *frames; uint16_t frame_count; bool loop; } lcd_animation_t;
```

The generated project metadata maps screen and bitmap bindings to animation identifiers. Export order follows persisted `animationOrder` and frame order so the output is deterministic. Existing static screen backends remain byte-for-byte stable when a project has no animations.

## Quality Requirements

- Regression tests prove persisted transitions render when edit mode is off.
- E2E checks verify local FSM panes collapse without a blank grid column and global navigator compaction leaves those panes visible.
- Unit tests cover animation migration, frame timing, binding validation, raster-import selection and deterministic firmware output.
- Browser tests cover import-to-edit and animation preview controls without console errors.
- Existing project files without animation fields continue to load and export.
