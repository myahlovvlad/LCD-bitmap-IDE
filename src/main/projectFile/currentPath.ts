/**
 * Tracks the absolute filesystem path of the project currently open in the
 * single application window, so "Save" can write back to it directly without
 * a dialog. The renderer never learns this path (matches the screenDslFiles
 * security posture) — it only ever gets a basename back from open/save results.
 */

let currentProjectPath: string | null = null;

export function getCurrentProjectPath(): string | null {
  return currentProjectPath;
}

export function setCurrentProjectPath(nextPath: string | null): void {
  currentProjectPath = nextPath;
}
