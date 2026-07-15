import { describe, expect, it } from 'vitest';
import { parseMermaidStateDiagram, parsePythonFsmScript } from '../../src/features/fsm-script/fsmScript';

describe('FSM script converters', () => {
  it('parses Mermaid stateDiagram-v2 transitions', () => {
    const model = parseMermaidStateDiagram(`
stateDiagram-v2
  direction LR
  [*] --> main_menu
  main_menu --> measure_mode : BTN_OK / start_scan()
  measure_mode --> main_menu : BTN_BACK
`);

    expect(model.initialStateId).toBe('main_menu');
    expect(model.screens.map((screen) => screen.id)).toEqual(['main_menu', 'measure_mode']);
    expect(model.transitions).toHaveLength(2);
  });

  it('parses the LCD-bitmap IDE Python DSL without evaluating code', () => {
    const model = parsePythonFsmScript(`
from lcd_bitmap_ide import FSM, Screen
fsm = FSM()
s1 = Screen("main_menu", title="Main menu")
s1.text("LCD-bitmap IDE", x=0, y=0, font=1)
s2 = Screen("measure_mode")
fsm.initial(s1)
fsm.transition(s1, s2, condition=btn("OK"))
`);

    expect(model.initialStateId).toBe('main_menu');
    expect(model.screens[0]?.texts[0]?.text).toBe('LCD-bitmap IDE');
    expect(model.transitions[0]?.trigger).toBe('BTN_OK');
  });
});
