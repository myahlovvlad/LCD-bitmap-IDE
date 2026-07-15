import {
  fingerprintScreenInterchange,
  projectToScreenInterchange,
  screenToScreenInterchangePackage,
  serializeScreenInterchange,
  validateScreenInterchange,
  type ScreenInterchangeProjectV1,
  type ScreenInterchangeValidationResult
} from '../screen-interchange';
import type { ApplicationWorkspace } from './workspace';
import type { ProjectSession } from './projectSession';

export interface ScreenInterchangeReadModel {
  package: ScreenInterchangeProjectV1;
  validation: ScreenInterchangeValidationResult;
  canonicalJson: string;
  fingerprint: string;
}

export function exportWorkspaceScreenInterchange(
  workspace: ApplicationWorkspace,
  screenIds?: readonly string[]
): ScreenInterchangeReadModel {
  return readModel(projectToScreenInterchange(workspace.project, { screenIds }));
}

export function exportSessionScreenInterchange(
  session: ProjectSession,
  screenIds?: readonly string[]
): ScreenInterchangeReadModel {
  return exportWorkspaceScreenInterchange(session.workspace, screenIds);
}

export function exportWorkspaceScreenInterchangeScreen(
  workspace: ApplicationWorkspace,
  screenId: string
): ScreenInterchangeReadModel {
  return readModel(screenToScreenInterchangePackage(workspace.project, screenId));
}

export function exportSessionScreenInterchangeScreen(
  session: ProjectSession,
  screenId: string
): ScreenInterchangeReadModel {
  return exportWorkspaceScreenInterchangeScreen(session.workspace, screenId);
}

function readModel(packageV1: ScreenInterchangeProjectV1): ScreenInterchangeReadModel {
  return {
    package: packageV1,
    validation: validateScreenInterchange(packageV1),
    canonicalJson: serializeScreenInterchange(packageV1),
    fingerprint: fingerprintScreenInterchange(packageV1)
  };
}
