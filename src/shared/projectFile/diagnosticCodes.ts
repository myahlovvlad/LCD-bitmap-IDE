/**
 * Stable diagnostic codes for native project file operations.
 * These codes appear in ProjectFileDiagnostic.code and must not change
 * across releases (they may be stored in project logs or shown in UI).
 */

export const PROJECT_FILE_TOO_LARGE = 'PROJECT_FILE_TOO_LARGE';
export const PROJECT_FILE_IS_DIRECTORY = 'PROJECT_FILE_IS_DIRECTORY';
export const PROJECT_FILE_READ_FAILED = 'PROJECT_FILE_READ_FAILED';
export const PROJECT_FILE_WRITE_FAILED = 'PROJECT_FILE_WRITE_FAILED';
export const PROJECT_FILE_RENAME_FAILED = 'PROJECT_FILE_RENAME_FAILED';
export const PROJECT_FILE_INVALID_IPC_PAYLOAD = 'PROJECT_FILE_INVALID_IPC_PAYLOAD';
