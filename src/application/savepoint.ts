import type { ApplicationWorkspace } from './workspace';

export interface WorkspaceSavepoint {
  fingerprint: string;
  revision: number;
  savedAt: string | null;
}

export function createWorkspaceSavepoint(
  workspace: ApplicationWorkspace,
  revision: number,
  savedAt: string | null = null
): WorkspaceSavepoint {
  return {
    fingerprint: fingerprintWorkspace(workspace),
    revision,
    savedAt
  };
}

export function isWorkspaceDirty(workspace: ApplicationWorkspace, savepoint: WorkspaceSavepoint): boolean {
  return fingerprintWorkspace(workspace) !== savepoint.fingerprint;
}

export function fingerprintWorkspace(workspace: ApplicationWorkspace): string {
  return JSON.stringify(workspace);
}
