/**
 * IPC channel name constants for Screen DSL file operations.
 * Using these constants prevents dynamic channel dispatch and makes
 * the IPC surface auditable.
 */

export const SCREEN_DSL_FILE_OPEN_CHANNEL = 'screen-dsl:file:open' as const;
export const SCREEN_DSL_FILE_SAVE_CHANNEL = 'screen-dsl:file:save' as const;

export type ScreenDslFileChannel =
  | typeof SCREEN_DSL_FILE_OPEN_CHANNEL
  | typeof SCREEN_DSL_FILE_SAVE_CHANNEL;
