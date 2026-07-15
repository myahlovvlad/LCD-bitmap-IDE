import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  createEffectInvocation,
  createGuardInvocation,
  serializeEffectInvocations,
  serializeGuardInvocation
} from '../../src/fsm-behavior';
import { createCompilerSourceSnapshot, normalizeProject } from '../../src/compiler';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('FSM behavior compiler visibility', () => {
  it('separates typed guard, typed effects, legacy backend and opaque storage in compiler IR', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.transitions['tr-main-measure'].condition = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    }));
    project.fsm.transitions['tr-main-measure'].backendProcessId = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);
    project.fsm.transitions['tr-measure-save'].backendProcessId = 'process-save';
    project.fsm.transitions['tr-measure-error'].backendProcessId = '@lcdide-effect-process';

    const result = normalizeProject(createCompilerSourceSnapshot({ project }));
    const transitions = Object.fromEntries(result.ir.fsm.transitions.map((transition) => [transition.id, transition]));

    expect(transitions['tr-main-measure'].behavior.guard.kind).toBe('typed');
    expect(transitions['tr-main-measure'].behavior.backend.kind).toBe('typed-effects');
    expect(transitions['tr-measure-save'].behavior.backend.kind).toBe('legacy-backend-process');
    expect(transitions['tr-measure-error'].behavior.backend.kind).toBe('opaque');
  });
});
