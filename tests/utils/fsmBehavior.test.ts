import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROCESS_REQUEST_EFFECT,
  RUNTIME_CONTEXT_COMPARE_GUARD,
  createEffectInvocation,
  createGuardInvocation,
  describeTransitionBehavior,
  parseGuardCondition,
  serializeEffectInvocations,
  serializeGuardInvocation
} from '../../src/fsm-behavior';
import { createCompilerSourceSnapshot, normalizeProject } from '../../src/compiler';
import { createDemoProject } from '../../src/entities/project/demo';
import {
  canonicalSerializeFsmInterchange,
  parseFsmMermaid,
  parseFsmPythonDsl,
  projectToFsmInterchange,
  writeFsmMermaid,
  writeFsmPythonDsl
} from '../../src/fsm-interchange';
import { createRuntimeEngine } from '../../src/services/runtimeEngine';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { validateProject } from '../../src/services/projectValidationService';

describe('FSM typed transition behavior contracts', () => {
  it('serializes typed guards with a deterministic restricted condition codec', () => {
    const guard = createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    });
    const condition = serializeGuardInvocation(guard);
    const parsed = parseGuardCondition(condition);

    expect(condition).toBe('@lcdide.guard/v1 runtime.context.compare key="button" operator="==" value="START"');
    expect(parsed.kind).toBe('typed');
    expect(parsed.kind === 'typed' ? parsed.canonical : '').toBe(condition);
  });

  it('keeps legacy conditions opaque and rejects malformed canonical guards', () => {
    expect(parseGuardCondition('button == START')).toEqual({ kind: 'opaque', source: 'button == START' });

    const malformed = parseGuardCondition('@lcdide.guard/v1 runtime.context.compare key=button operator="==" value="START"');
    expect(malformed.kind).toBe('invalid');
    expect(malformed.kind === 'invalid' ? malformed.diagnostics[0]?.code : '').toBe('fsm.behavior.value.unquoted-string');
  });

  it('evaluates typed guards in the runtime simulator without breaking legacy conditions', () => {
    const project = demoProject();
    project.fsm.transitions['tr-main-measure'].condition = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'button',
      operator: '==',
      value: 'START'
    }));
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    const button = runtime.getAvailableButtons().find((candidate) => candidate.fsmEventId === 'START');

    runtime.pressButton(button!.id);

    expect(runtime.currentStateId).toBe('measure');
    expect(runtime.lastTransition?.id).toBe('tr-main-measure');

    const legacyProject = demoProject();
    legacyProject.fsm.transitions['tr-main-measure'].condition = 'button == START';
    const legacyRuntime = createRuntimeEngine(legacyProject);
    legacyRuntime.start('main-menu');
    legacyRuntime.pressButton(button!.id);

    expect(legacyRuntime.currentStateId).toBe('measure');
  });

  it('blocks invalid canonical guards and reports validation diagnostics', () => {
    const project = demoProject();
    project.fsm.transitions['tr-main-measure'].condition = '@lcdide.guard/v1 missing.contract';
    const runtime = createRuntimeEngine(project);
    runtime.start('main-menu');
    const button = runtime.getAvailableButtons().find((candidate) => candidate.fsmEventId === 'START');

    runtime.pressButton(button!.id);

    expect(runtime.currentStateId).toBe('main-menu');
    expect(runtime.eventLog.some((entry) => entry.message.includes('Invalid typed guard'))).toBe(true);
    expect(validateProject(project).some((issue) => issue.id.includes('transition-guard-invalid'))).toBe(true);
  });

  it('round-trips canonical guards through Mermaid and Python DSL byte-stably', () => {
    const project = demoProject();
    const condition = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'timeout_ms',
      operator: '>=',
      value: 1000
    }));
    project.fsm.transitions['tr-main-measure'].condition = condition;
    const model = projectToFsmInterchange(project);

    const mermaid = writeFsmMermaid(model);
    const parsedMermaid = parseFsmMermaid(mermaid);
    expect(parsedMermaid.ok).toBe(true);
    expect(writeFsmMermaid(parsedMermaid.model!)).toBe(mermaid);

    const python = writeFsmPythonDsl(model);
    const parsedPython = parseFsmPythonDsl(python);
    expect(parsedPython.ok).toBe(true);
    expect(writeFsmPythonDsl(parsedPython.model!)).toBe(python);
    expect(canonicalSerializeFsmInterchange(parsedPython.model!)).toBe(canonicalSerializeFsmInterchange(model));
  });

  it('keeps legacy backend process requests distinct from typed effects', () => {
    const project = demoProject();
    project.backendProcesses['process-measure'] = { id: 'process-measure', name: 'Measure', commands: ['MEASURE:START'] };
    project.fsm.transitions['tr-main-measure'].backendProcessId = 'process-measure';

    const behavior = describeTransitionBehavior(project.fsm.transitions['tr-main-measure']);

    expect(behavior.backend).toEqual({ kind: 'legacy-backend-process', processId: 'process-measure' });
    expect(behavior.effects).toEqual([]);
  });

  it('exposes only explicit typed effect envelopes as typed effects', () => {
    const project = demoProject();
    project.fsm.transitions['tr-main-measure'].backendProcessId = serializeEffectInvocations([
      createEffectInvocation(BACKEND_PROCESS_REQUEST_EFFECT, { processId: 'process-measure' })
    ]);

    const behavior = describeTransitionBehavior(project.fsm.transitions['tr-main-measure']);

    expect(behavior.backend.kind).toBe('typed-effects');
    expect(behavior.effects).toEqual([{
      version: 1,
      contractId: BACKEND_PROCESS_REQUEST_EFFECT,
      args: { processId: 'process-measure' }
    }]);
  });

  it('includes typed behavior in normalized compiler IR without changing codegen artifacts directly', () => {
    const project = demoProject();
    project.fsm.transitions['tr-main-measure'].condition = serializeGuardInvocation(createGuardInvocation(RUNTIME_CONTEXT_COMPARE_GUARD, {
      key: 'status',
      operator: '==',
      value: 'READY'
    }));

    const result = normalizeProject(createCompilerSourceSnapshot({ project }));
    const transition = result.ir.fsm.transitions.find((candidate) => candidate.id === 'tr-main-measure');

    expect(transition?.behavior.guard.kind).toBe('typed');
    expect(transition?.behavior.effects).toEqual([]);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });
});

function demoProject() {
  return migrateLegacySnapshot(createDemoProject()).project;
}
