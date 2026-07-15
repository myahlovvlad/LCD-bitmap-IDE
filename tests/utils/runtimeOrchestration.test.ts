import { describe, expect, it, vi } from 'vitest';
import { executeProcedure } from '../../src/services/runtime/actionExecutor';
import { createInstantSimulation, SimulationTransport } from '../../src/services/runtime/SimulationTransport';
import { MutableTagContext, evaluateExpression } from '../../src/services/runtime/TagContext';
import { createOrchestratedEngine } from '../../src/services/runtime/orchestratedRuntimeEngine';
import type { BackendProcedure } from '../../src/domain/procedure';
import type { ExecutionContext } from '../../src/services/runtime/actionExecutor';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { createDemoProject } from '../../src/entities/project/demo';

// ---------------------------------------------------------------------------
// TagContext + ValueExpression
// ---------------------------------------------------------------------------

describe('MutableTagContext', () => {
  it('returns null for unknown tags', () => {
    const ctx = new MutableTagContext();
    expect(ctx.get('unknown')).toBeNull();
  });

  it('stores and retrieves values', () => {
    const ctx = new MutableTagContext({ wavelength: 550 });
    ctx.set('absorbance', 1.23);
    expect(ctx.get('wavelength')).toBe(550);
    expect(ctx.get('absorbance')).toBe(1.23);
  });

  it('snapshots all current values', () => {
    const ctx = new MutableTagContext({ a: 1, b: 'x' });
    expect(ctx.snapshot()).toEqual({ a: 1, b: 'x' });
  });

  it('evaluates literal expressions', () => {
    const ctx = new MutableTagContext();
    expect(evaluateExpression({ kind: 'literal', value: 42 }, ctx)).toBe(42);
    expect(evaluateExpression({ kind: 'literal', value: true }, ctx)).toBe(true);
    expect(evaluateExpression({ kind: 'literal', value: 'hello' }, ctx)).toBe('hello');
  });

  it('evaluates tag expressions', () => {
    const ctx = new MutableTagContext({ wavelength: 530 });
    expect(evaluateExpression({ kind: 'tag', tagId: 'wavelength' }, ctx)).toBe(530);
    expect(evaluateExpression({ kind: 'tag', tagId: 'missing' }, ctx)).toBeNull();
  });

  it('evaluates formula expressions', () => {
    const ctx = new MutableTagContext({ eRef: 100, eSample: 10 });
    const expr = { kind: 'formula' as const, expression: '-Math.log10(eSample / eRef)', deps: ['eRef', 'eSample'] };
    const result = evaluateExpression(expr, ctx);
    expect(typeof result).toBe('number');
    expect(Math.abs((result as number) - 1)).toBeLessThan(0.001);
  });

  it('returns null for formula errors', () => {
    const ctx = new MutableTagContext();
    const expr = { kind: 'formula' as const, expression: 'invalidSyntax !!', deps: [] };
    expect(evaluateExpression(expr, ctx)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SimulationTransport
// ---------------------------------------------------------------------------

describe('SimulationTransport', () => {
  it('returns ok for any command when connected', async () => {
    const transport = createInstantSimulation();
    const result = await transport.sendCommand('connect');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response).toBe('ok.');
  });

  it('returns failure for commands in the fail set', async () => {
    const transport = createInstantSimulation({}, ['MEASURE:START']);
    const result = await transport.sendCommand('MEASURE:START');
    expect(result.ok).toBe(false);
  });

  it('returns failure when disconnected', async () => {
    const transport = createInstantSimulation();
    transport.disconnect();
    const result = await transport.sendCommand('connect');
    expect(result.ok).toBe(false);
    expect(transport.isConnected()).toBe(false);
  });

  it('uses catalog timing (with timeScale=0 no actual delay)', async () => {
    const catalog = {
      'measure': { id: 'measure', command: 'measure', expectedDurationMs: 5000 }
    };
    const transport = new SimulationTransport(catalog, { timeScale: 0 });
    const start = Date.now();
    await transport.sendCommand('measure');
    expect(Date.now() - start).toBeLessThan(50); // no real delay with timeScale=0
  });
});

// ---------------------------------------------------------------------------
// actionExecutor
// ---------------------------------------------------------------------------

describe('executeProcedure', () => {
  function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
    return {
      tags: new MutableTagContext({ zeroValid: false }),
      transport: createInstantSimulation(),
      cliCatalog: { 'connect': { id: 'connect', command: 'connect' } },
      onAudit: vi.fn(),
      ...overrides
    };
  }

  const navProcedure: BackendProcedure = {
    id: 'PROC-NAV',
    name: { ru: 'Навигация', en: 'Navigation', zh: '导航' },
    services: [],
    steps: [{ type: 'audit', message: { ru: 'Старт', en: 'Start', zh: '开始' } }]
  };

  it('returns success for a no-op audit-only procedure', async () => {
    const result = await executeProcedure(navProcedure, makeCtx());
    expect(result.outcome).toBe('success');
    expect(result.auditTrail.some((e) => e.type === 'complete')).toBe(true);
  });

  it('executes cli steps via transport', async () => {
    const transport = createInstantSimulation({ 'connect': { id: 'connect', command: 'connect' } });
    const sendSpy = vi.spyOn(transport, 'sendCommand');
    const procedure: BackendProcedure = {
      id: 'PROC-CLI',
      name: { ru: 'CLI', en: 'CLI', zh: 'CLI' },
      services: [],
      steps: [{ type: 'cli', cliCommandId: 'connect' }]
    };

    const result = await executeProcedure(procedure, makeCtx({ transport }));

    expect(result.outcome).toBe('success');
    expect(sendSpy).toHaveBeenCalledWith('connect');
  });

  it('returns failure when a cli step command fails', async () => {
    const transport = createInstantSimulation({}, ['connect']);
    const procedure: BackendProcedure = {
      id: 'PROC-FAIL',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{ type: 'cli', cliCommandId: 'connect' }]
    };

    const result = await executeProcedure(procedure, makeCtx({ transport }));
    expect(result.outcome).toBe('failure');
  });

  it('sets tag values via setTag steps', async () => {
    const tags = new MutableTagContext({ zeroValid: false });
    const procedure: BackendProcedure = {
      id: 'PROC-ZERO',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{
        type: 'setTag',
        tagId: 'zeroValid',
        value: { kind: 'literal', value: true }
      }]
    };

    await executeProcedure(procedure, makeCtx({ tags }));
    expect(tags.get('zeroValid')).toBe(true);
  });

  it('returns failure when guard step evaluates to false', async () => {
    const tags = new MutableTagContext({ zeroValid: false });
    const procedure: BackendProcedure = {
      id: 'PROC-GUARD',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{ type: 'guard', value: { kind: 'tag', tagId: 'zeroValid' } }]
    };

    const result = await executeProcedure(procedure, makeCtx({ tags }));
    expect(result.outcome).toBe('failure');
    expect(result.failureReason).toContain('guard');
  });

  it('succeeds when guard step passes', async () => {
    const tags = new MutableTagContext({ zeroValid: true });
    const procedure: BackendProcedure = {
      id: 'PROC-GUARD-PASS',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{ type: 'guard', value: { kind: 'tag', tagId: 'zeroValid' } }]
    };

    const result = await executeProcedure(procedure, makeCtx({ tags }));
    expect(result.outcome).toBe('success');
  });

  it('calls onAudit for each step', async () => {
    const onAudit = vi.fn();
    await executeProcedure(navProcedure, makeCtx({ onAudit }));
    expect(onAudit).toHaveBeenCalled();
  });

  it('inserts delay steps without blocking (timeScale 0 simulation)', async () => {
    const procedure: BackendProcedure = {
      id: 'PROC-DELAY',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{ type: 'delay', delayMs: 0 }]
    };

    const result = await executeProcedure(procedure, makeCtx());
    expect(result.outcome).toBe('success');
    expect(result.auditTrail.some((e) => e.type === 'delay')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OrchestratedRuntimeEngine
// ---------------------------------------------------------------------------

describe('OrchestratedRuntimeEngine', () => {
  it('delegates navigation-only events to inner engine (fast path)', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation(), { bypassProcedures: true });
    engine.start('main-menu');

    await engine.sendEventAsync('START');

    expect(engine.currentStateId).toBe('measure');
    expect(engine.lastTransition?.id).toBe('tr-main-measure');
  });

  it('stays in current state when no transition matches', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation());
    engine.start('main-menu');

    await engine.sendEventAsync('SAVE');

    expect(engine.currentStateId).toBe('main-menu');
  });

  it('exposes tag context with default values', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation());
    // demo project has no tags, so snapshot should be empty
    expect(engine.tags.snapshot()).toEqual({});
  });

  it('runs a BackendProcedure and commits state on success', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;

    // Attach a real BackendProcedure to an existing transition
    const transitionId = 'tr-main-measure';
    const transition = project.fsm.transitions[transitionId];
    if (!transition) throw new Error('Demo transition missing');

    const procedure: BackendProcedure = {
      id: 'PROC-TEST',
      name: { ru: 'Тест', en: 'Test', zh: '测试' },
      services: [],
      steps: [{ type: 'audit', message: { ru: 'ok', en: 'ok', zh: 'ok' } }]
    };
    project.procedures = { 'PROC-TEST': procedure };
    transition.backendProcessId = 'PROC-TEST';

    const engine = createOrchestratedEngine(project, createInstantSimulation());
    engine.start('main-menu');

    await engine.sendEventAsync('START');

    expect(engine.procedureStatus).toBe('success');
    expect(engine.currentStateId).toBe('measure');
    expect(engine.lastProcedureRun?.procedureId).toBe('PROC-TEST');
  });

  it('routes to failureTargetStateId when procedure fails', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const transitionId = 'tr-main-measure';
    const transition = project.fsm.transitions[transitionId];
    if (!transition) throw new Error('Demo transition missing');

    const procedure: BackendProcedure = {
      id: 'PROC-FAIL',
      name: { ru: '', en: '', zh: '' },
      services: [],
      steps: [{ type: 'cli', cliCommandId: 'connect' }],
      failureTargetStateId: 'error'
    };
    project.procedures = { 'PROC-FAIL': procedure };
    transition.backendProcessId = 'PROC-FAIL';

    // Simulate CLI failure
    const transport = createInstantSimulation({ 'connect': { id: 'connect', command: 'connect' } }, ['connect']);
    const engine = createOrchestratedEngine(project, transport);
    engine.start('main-menu');

    await engine.sendEventAsync('START');

    expect(engine.procedureStatus).toBe('failure');
    expect(engine.currentStateId).toBe('error');
  });

  it('drops a second event while a procedure is in flight', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation());
    engine.start('main-menu');

    // Fire two async events concurrently
    const first = engine.sendEventAsync('START');
    const second = engine.sendEventAsync('START');
    await Promise.all([first, second]);

    // Only one transition should have been committed
    expect(engine.currentStateId).toBe('measure');
  });

  it('synchronous sendEvent still works for navigation transitions', () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation(), { bypassProcedures: true });
    engine.start('main-menu');

    engine.sendEvent('START');

    expect(engine.currentStateId).toBe('measure');
  });

  it('reset clears procedure status', async () => {
    const project = migrateLegacySnapshot(createDemoProject()).project;
    const engine = createOrchestratedEngine(project, createInstantSimulation(), { bypassProcedures: true });
    engine.start('main-menu');
    await engine.sendEventAsync('START');

    engine.reset();

    expect(engine.procedureStatus).toBe('idle');
    expect(engine.lastProcedureRun).toBeNull();
  });
});
