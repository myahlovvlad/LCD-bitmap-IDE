import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  createEffectInvocation,
  parseBackendBehaviorStorage,
  serializeEffectInvocations
} from '../../src/fsm-behavior';
import { createDemoProject } from '../../src/entities/project/demo';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';

describe('FSM behavior legacy compatibility', () => {
  it('runs legacy backend process references through the existing runtime path', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.backendProcesses['process-measure'] = { id: 'process-measure', name: 'Measure', commands: ['MEASURE:START'] };
    project.fsm.transitions['tr-main-measure'].backendProcessId = 'process-measure';
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');

    runtime.sendEvent('START');

    expect(runtime.eventLog.some((event) => event.type === 'backend' && event.backendProcessId === 'process-measure')).toBe(true);
  });

  it('does not treat typed effect envelopes as ordinary backend process IDs', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const encoded = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);
    project.backendProcesses[encoded] = { id: encoded, name: 'Should not be reached', commands: ['NOOP'] };
    project.fsm.transitions['tr-main-measure'].backendProcessId = encoded;
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');

    runtime.sendEvent('START');

    expect(parseBackendBehaviorStorage(encoded).kind).toBe('typed-effects');
    expect(runtime.eventLog.some((event) => event.message.includes('Should not be reached'))).toBe(false);
    expect(runtime.eventLog.some((event) => event.message.includes('Typed effects requested'))).toBe(true);
  });

  it('keeps unknown backend process IDs as legacy references and reports missing process at runtime', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    project.fsm.transitions['tr-main-measure'].backendProcessId = 'missing-process';
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');

    runtime.sendEvent('START');

    expect(runtime.eventLog.some((event) => event.message.includes('Missing backend process "missing-process"'))).toBe(true);
  });
});
