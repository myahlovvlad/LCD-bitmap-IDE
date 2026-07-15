import { describe, expect, it } from 'vitest';
import {
  applyFsmScriptPreview,
  createFixedApplicationCommandContext,
  createProjectSession,
  exportFsmScript,
  previewFsmScriptImport,
  redoProjectSession,
  undoProjectSession
} from '../../src/application';
import {
  parseFsmMermaid,
  parseFsmPythonDsl,
  projectToFsmInterchange,
  canonicalSerializeFsmInterchange,
  writeFsmMermaid,
  writeFsmPythonDsl
} from '../../src/fsm-interchange';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import type { LcdBitmapProject } from '../../src/domain';

const timestamp = '2026-06-24T03:00:00.000Z';

describe('FSM semantic round-trip core', () => {
  it('canonicalizes domain FSM deterministically while preserving IDs, layout, handles and screen links', () => {
    const project = demoProject();
    const first = projectToFsmInterchange(project);
    const reordered: LcdBitmapProject = {
      ...project,
      fsm: {
        ...project.fsm,
        states: Object.fromEntries(Object.entries(project.fsm.states).reverse()),
        events: Object.fromEntries(Object.entries(project.fsm.events).reverse()),
        transitions: Object.fromEntries(Object.entries(project.fsm.transitions).reverse())
      }
    };
    const second = projectToFsmInterchange(reordered);

    expect(canonicalSerializeFsmInterchange(first)).toBe(canonicalSerializeFsmInterchange(second));
    expect(first.states.map((state) => state.id)).toEqual(project.fsm.stateOrder);
    expect(first.states[0]?.screenId).toBe(project.fsm.states[project.fsm.stateOrder[0]].screenId);
    expect(first.layout[0]).toEqual(expect.objectContaining(project.fsm.graphLayout[project.fsm.stateOrder[0]]));
  });

  it('round-trips Mermaid byte-stably with lcdide directives', () => {
    const model = projectToFsmInterchange(demoProject());
    const firstText = writeFsmMermaid(model);
    const parsed = parseFsmMermaid(firstText);
    const secondText = writeFsmMermaid(parsed.model!);

    expect(parsed.ok).toBe(true);
    expect(firstText).toBe(secondText);
    expect(parseFsmMermaid(secondText).sourceMap.some((entry) => entry.entityType === 'transition')).toBe(true);
  });

  it('round-trips the Python-like DSL without executing Python', () => {
    const model = projectToFsmInterchange(demoProject());
    const firstText = writeFsmPythonDsl(model);
    const parsed = parseFsmPythonDsl(firstText);
    const secondText = writeFsmPythonDsl(parsed.model!);

    expect(parsed.ok).toBe(true);
    expect(firstText).toBe(secondText);
    expect(firstText).toContain('fsm.transition(');
  });

  it('reports line and column diagnostics for malformed or executable Python-like DSL', () => {
    const parsed = parseFsmPythonDsl([
      'from lcd_bitmap_ide import FSM, State, Event',
      'import os',
      'exec("print(1)")',
      'not valid syntax'
    ].join('\n'));

    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'fsm.python.blocked-construct',
      'fsm.python.blocked-construct',
      'fsm.python.syntax'
    ]);
    expect(parsed.diagnostics[0]).toEqual(expect.objectContaining({ line: 2, column: 1 }));
  });

  it('previews without mutating and applies through one atomic ChangeSet history entry', () => {
    const session = createProjectSession(demoProject(), 4);
    const text = exportFsmScript(session, 'mermaid').replace('title="Measurement"', 'title="Measure Updated"');
    const preview = previewFsmScriptImport(session, text, 'mermaid', createFixedApplicationCommandContext(timestamp));

    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations.some((operation) => operation.type === 'state.update')).toBe(true);
    expect(session.revision).toBe(4);
    expect(session.project.fsm.states.measure.title).toBe('Measurement');
    expect(preview.dryRun?.status).toBe('dry-run');
    expect(preview.dryRun?.candidate?.revision).toBe(5);

    const applied = applyFsmScriptPreview(session, preview, createFixedApplicationCommandContext(timestamp));
    expect(applied.status).toBe('applied');
    expect(applied.session.revision).toBe(5);
    expect(applied.session.history.entries).toHaveLength(1);
    expect(applied.session.project.fsm.states.measure.title).toBe('Measure Updated');

    const undone = undoProjectSession(applied.session);
    const redone = undone ? redoProjectSession(undone) : null;
    expect(undone?.project.fsm.states.measure.title).toBe('Measurement');
    expect(redone?.project.fsm.states.measure.title).toBe('Measure Updated');
  });

  it('rejects stale previews and keeps no-op imports out of history', () => {
    const session = createProjectSession(demoProject(), 1);
    const preview = previewFsmScriptImport(session, exportFsmScript(session, 'python'), 'python', createFixedApplicationCommandContext(timestamp));
    const stale = createProjectSession({
      project: { ...session.project, meta: { ...session.project.meta, name: 'Changed elsewhere' } },
      fontGlyphs: session.workspace.fontGlyphs,
      loadedFonts: session.workspace.loadedFonts,
      savedMeasurements: session.workspace.savedMeasurements
    }, 2);

    expect(preview.ok).toBe(true);
    expect(preview.diff?.operations).toEqual([]);
    expect(applyFsmScriptPreview(session, preview, createFixedApplicationCommandContext(timestamp)).status).toBe('noop');
    const rejected = applyFsmScriptPreview(stale, preview, createFixedApplicationCommandContext(timestamp));
    expect(rejected.status).toBe('rejected');
    expect(rejected.diagnostics[0]).toEqual(expect.objectContaining({ code: 'fsm.roundtrip.stale-preview' }));
  });
});

function demoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}
