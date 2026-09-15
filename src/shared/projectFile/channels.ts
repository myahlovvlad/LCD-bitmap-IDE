/**
 * IPC channel name constants for native project file open/save operations.
 * Using these constants prevents dynamic channel dispatch and makes
 * the IPC surface auditable.
 */

export const PROJECT_FILE_OPEN_CHANNEL = 'project-file:open' as const;
export const PROJECT_FILE_SAVE_CHANNEL = 'project-file:save' as const;
export const PROJECT_FILE_RESET_PATH_CHANNEL = 'project-file:reset-path' as const;

export type ProjectFileChannel =
  | typeof PROJECT_FILE_OPEN_CHANNEL
  | typeof PROJECT_FILE_SAVE_CHANNEL
  | typeof PROJECT_FILE_RESET_PATH_CHANNEL;
