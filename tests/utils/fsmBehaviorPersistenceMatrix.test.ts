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
import { validateProject } from '../../src/services/projectValidationService';

describe('FSM behavior persistence matrix', () => {
  it.each([
    ['empty', null, null, 'empty', 'none', false],
    ['legacy opaque guard', 'button == START', null, 'opaque', 'none', false],
    ['canonical guard', typedGuard(), null, 'typed', 'none', false],
    ['malformed canonical guard', '@lcdide.guard/v1 missing.contract', null, 'invalid', 'none', true],
    ['legacy process ID', null, 'process-measure', 'empty', 'legacy-backend-process', false],
    ['canonical effect', null, typedEffects(), 'empty', 'typed-effects', false],
    ['typed guard and legacy process', typedGuard(), 'process-measure', 'typed', 'legacy-backend-process', false],
    ['typed guard and typed effect', typedGuard(), typedEffects(), 'typed', 'typed-effects', false],
    ['opaque condition and opaque backend', 'status == READY', '@lcdide-effect-process', 'opaque', 'opaque', false],
    ['invalid guard and typed effect', '@lcdide.guard/v1 missing.contract', typedEffects(), 'invalid', 'typed-effects', true]
  ])('%s', (_name, condition, backendProcessId, guardKind, backendKind, hasValidationError) => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.backendProcesses['process-measure'] = { id: 'process-measure', name: 'Measure', commands: ['MEASURE:START'] };
    project.fsm.transitions['tr-main-measure'].condition = condition;
    project.fsm.transitions['tr-main-measure'].backendProcessId = backendProcessId;

    const behavior = describeTransitionBehavior(project.fsm.transitions['tr-main-measure']);
    const issues = validateProject(project);

    expect(behavior.guard.kind).toBe(guardKind);
    expect(behavior.backend.kind).toBe(backendKind);
    expect(issues.some((issue) => issue.severity === 'error')).toBe(hasValidationError);
  });
});

function typedGuard(): string {
  return serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
    key: 'button',
    operator: '==',
    value: 'START'
  }));
}

function typedEffects(): string {
  return serializeEffectInvocations([
    createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
  ]);
}
