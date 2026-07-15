import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  createEffectInvocation,
  createGuardInvocation,
  describeTransitionBehavior,
  serializeEffectInvocations,
  serializeGuardInvocation
} from '../../src/fsm-behavior';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createProjectSession, redoProjectSession, undoProjectSession } from '../../src/application';

describe('FSM behavior migration and history compatibility', () => {
  it('keeps legacy migration backend process IDs as legacy backend references', () => {
    const legacy = createDemoProject();
    legacy.project.transitions['tr-main-measure'].cliCommands = ['MEASURE:START'];
    const snapshot = migrateLegacySnapshot(legacy);
    const transition = snapshot.project.fsm.transitions['tr-main-measure'];

    expect(transition.backendProcessId).toBe('process-tr-main-measure');
    expect(describeTransitionBehavior(transition).backend).toEqual({
      kind: 'legacy-backend-process',
      processId: 'process-tr-main-measure'
    });
  });

  it('preserves raw behavior storage through undo and redo', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const guard = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'status',
      operator: '==',
      value: 'READY'
    }));
    const effects = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);
    project.fsm.transitions['tr-main-measure'].condition = guard;
    project.fsm.transitions['tr-main-measure'].backendProcessId = effects;
    const session = createProjectSession(project, 10);

    const undone = undoProjectSession(session);
    const redone = undone ? redoProjectSession(undone) : null;

    expect(undone).toBeNull();
    expect(redone).toBeNull();
    expect(session.project.fsm.transitions['tr-main-measure'].condition).toBe(guard);
    expect(session.project.fsm.transitions['tr-main-measure'].backendProcessId).toBe(effects);
  });
});
