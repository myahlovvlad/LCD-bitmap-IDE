/**
 * @module entities/project/factory
 * @description Project factories used by Project Manager, demo project loading
 * and v3/v4 migration. A project starts universal by default and is not tied to
 * a particular spectrophotometer model.
 */

import { DEFAULT_DISPLAY_CONFIG, type ImportedProjectModel, type LegacyProject as Project } from '../../domain';
import { sanitizePlainText } from '../../shared/lib/security';
import { createScreenState } from '../screen/factory';

export interface NewProjectInput {
  name: string;
  deviceModel?: string;
  firmwareVersion?: string;
  author?: string;
}

/** Creates a new portable LCD project with one blank screen. */
export function createBlankProject(input: NewProjectInput): ImportedProjectModel {
  const now = new Date().toISOString();
  const screen = createScreenState(0, 'Main Menu Demo');
  const id = `lcd-project-${Date.now()}`;
  const project: Project = {
    id,
    name: sanitizePlainText(input.name, 160) || 'Universal LCD project',
    version: '1.0.0',
    modelId: 'Universal-LCD-128x64',
    firmwareVersion: sanitizePlainText(input.firmwareVersion ?? '', 80) || null,
    author: sanitizePlainText(input.author ?? '', 160) || null,
    lastModified: now,
    display: DEFAULT_DISPLAY_CONFIG,
    states: { [screen.state.id]: screen.state },
    transitions: {},
    canvasByStateId: { [screen.canvas.stateId]: screen.canvas },
    graphLayout: { [screen.state.id]: screen.layout },
    auditTrail: []
  };

  return { project, stateOrder: [screen.state.id], transitionOrder: [] };
}
