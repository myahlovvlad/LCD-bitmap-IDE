import { describe, expect, it } from 'vitest';
import { parseFsmMermaid, parseFsmPythonDsl } from '../../src/fsm-interchange';

describe('FSM script parser security', () => {
  it('does not execute or accept Python execution constructs', () => {
    for (const source of ['open("x")', '__import__("os")', 'subprocess.run("dir")', 'while True: pass']) {
      const parsed = parseFsmPythonDsl(source);
      expect(parsed.ok).toBe(false);
      expect(parsed.diagnostics[0]?.code).toBe('fsm.python.blocked-construct');
    }
  });

  it('diagnoses duplicate and prototype-pollution IDs', () => {
    const parsed = parseFsmMermaid([
      'stateDiagram-v2',
      '%% lcdide:machine version=1 projectId="safe"',
      '%% lcdide:state id=__proto__ title="Bad" type=process initial=false terminal=false subsystem=default origin=test order=0'
    ].join('\n'));

    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'fsm.state.invalid-id')).toBe(true);
  });
});
