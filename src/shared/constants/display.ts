/**
 * @module shared/constants/display
 * @description Canonical LCD geometry used by the editor, importer, renderer,
 * preview mode, firmware export, and schema defaults. The values mirror the
 * original monolithic LCD simulator and must remain stable for 128x64 projects.
 */

/** Logical LCD width in pixels. */
export const SCREEN_W = 128;

/** Logical LCD height in pixels. */
export const SCREEN_H = 64;

/** Default editor scale inherited from the working HTML prototype. */
export const LCD_SCALE = 5;

/** Default framebuffer byte length for vertical LSB page packing. */
export const LCD_PAGE_PACKED_BYTES = SCREEN_W * Math.ceil(SCREEN_H / 8);

/** Maximum accepted imported project or image file size. */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
