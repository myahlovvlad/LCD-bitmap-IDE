import type { ProjectChangeSet } from '../changeSet';
import type { ActorIdentity, ProjectCommand } from '../commandTypes';
import { screenInterchangeToLcdScreens, type ScreenInterchangeProjectV1 } from '../../screen-interchange';
import type { ScreenDslDiagnostic, ScreenDslImportMode } from '../../screen-dsl';
import { screenDslError } from '../../screen-dsl';

const IMPORT_TIMESTAMP = '2026-06-25T00:00:00.000Z';

export interface MapScreenDslChangeSetInput {
  projectId: string;
  expectedRevision: number;
  importMode: ScreenDslImportMode;
  actor: ActorIdentity;
  sourceFingerprint: string;
  base: ScreenInterchangeProjectV1;
  candidate: ScreenInterchangeProjectV1;
}

export interface MapScreenDslChangeSetResult {
  changeSet: ProjectChangeSet | null;
  diagnostics: readonly ScreenDslDiagnostic[];
}

export function mapScreenDslDiffToChangeSet(input: MapScreenDslChangeSetInput): MapScreenDslChangeSetResult {
  if (input.importMode !== 'update') {
    return mapCreateOrClone(input);
  }

  const baseScreens = new Map(input.base.screens.map((screen) => [screen.id, screen]));
  const reconstructed = screenInterchangeToLcdScreens(input.candidate);
  const commands: ProjectCommand[] = [];
  for (const screen of input.candidate.screens) {
    const previous = baseScreens.get(screen.id);
    if (!previous) {
      return {
        changeSet: null,
        diagnostics: [screenDslError('SCREEN_DSL_UPDATE_TARGET_MISSING', `Screen "${screen.id}" does not exist in update target.`, `$.screens.${screen.id}`)]
      };
    }
    if (previous.name !== screen.name) {
      commands.push(command(input, 'screen.rename', commands.length, { screenId: screen.id, name: screen.name }));
    }
    if (previous.display.width !== screen.display.width || previous.display.height !== screen.display.height) {
      commands.push(command(input, 'screen.resize', commands.length, { screenId: screen.id, width: screen.display.width, height: screen.display.height }));
    }
    if (JSON.stringify(previous.objects) !== JSON.stringify(screen.objects) || previous.objectOrder.join('\n') !== screen.objectOrder.join('\n')) {
      commands.push(command(input, 'canvas.objects.update', commands.length, { screenId: screen.id, objects: reconstructed[screen.id]?.objects ?? [] }));
    }
  }

  return {
    changeSet: {
      changeSetId: `screen-dsl-${input.sourceFingerprint}`,
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      commands,
      reason: 'Screen DSL Apply',
      timestamp: IMPORT_TIMESTAMP
    },
    diagnostics: []
  };
}

function mapCreateOrClone(input: MapScreenDslChangeSetInput): MapScreenDslChangeSetResult {
  if (input.importMode !== 'create' && input.importMode !== 'clone') {
    return { changeSet: null, diagnostics: [screenDslError('SCREEN_DSL_UNKNOWN_IMPORT_MODE', 'Unsupported Screen DSL import mode.', '$.importMode')] };
  }
  const existingScreenIds = new Set(input.base.screens.map((screen) => screen.id));
  const collision = input.candidate.screens.find((screen) => existingScreenIds.has(screen.id));
  if (collision) {
    return {
      changeSet: null,
      diagnostics: [screenDslError('SCREEN_DSL_SCREEN_ID_COLLISION', `Screen "${collision.id}" already exists.`, `$.screens.${collision.id}`)]
    };
  }
  const resourceConflict = findResourceConflict(input.base, input.candidate);
  if (resourceConflict) {
    return {
      changeSet: null,
      diagnostics: [screenDslError(
        'SCREEN_DSL_RESOURCE_ID_CONFLICT',
        `Resource "${resourceConflict}" already exists with different content.`,
        `$.resources.${resourceConflict}`
      )]
    };
  }
  return {
    changeSet: {
      changeSetId: `screen-dsl-${input.importMode}-${input.sourceFingerprint}`,
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      commands: [command(input, 'screen.dsl.apply', 0, { package: input.candidate, mode: input.importMode })],
      reason: `Screen DSL ${input.importMode} Apply`,
      timestamp: IMPORT_TIMESTAMP
    },
    diagnostics: []
  };
}

function findResourceConflict(base: ScreenInterchangeProjectV1, candidate: ScreenInterchangeProjectV1): string | null {
  for (const [id, resource] of Object.entries(candidate.resources.fonts)) {
    if (base.resources.fonts[id] && !sameJson(base.resources.fonts[id], resource)) {
      return id;
    }
  }
  for (const [id, resource] of Object.entries(candidate.resources.glyphs)) {
    if (base.resources.glyphs[id] && !sameJson(base.resources.glyphs[id], resource)) {
      return id;
    }
  }
  for (const [id, resource] of Object.entries(candidate.resources.bitmaps)) {
    if (base.resources.bitmaps[id] && !sameJson(base.resources.bitmaps[id], resource)) {
      return id;
    }
  }
  return null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortObjectKeys(left)) === JSON.stringify(sortObjectKeys(right));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObjectKeys(item)])
  );
}

function command<Type extends ProjectCommand['type']>(
  input: MapScreenDslChangeSetInput,
  type: Type,
  index: number,
  payload: Extract<ProjectCommand, { type: Type }>['payload']
): Extract<ProjectCommand, { type: Type }> {
  return {
    type,
    meta: {
      commandId: `screen-dsl-${input.sourceFingerprint}-${index + 1}-${type}`,
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      actor: input.actor,
      timestamp: IMPORT_TIMESTAMP
    },
    payload
  } as Extract<ProjectCommand, { type: Type }>;
}
