# FSM Python-Like DSL

The Python-like DSL is declarative text. It is not executable Python.

Supported calls:

```python
fsm = FSM(version=1, project_id="project", name="Name")
fsm.state(id="main", title="Main", type="initial", initial=true, x=80, y=80)
fsm.event(id="OK", name="OK")
fsm.transition(id="tr-main-next", from="main", to="next", event="OK")
```

The parser rejects executable constructs such as `import os`, `exec`, `eval`,
`open`, `subprocess`, loops, function/class definitions and dunder import
patterns. Unsupported lines produce diagnostics with line and column.

Legacy `Screen(...)`, `fsm.transition(s1, s2, condition=btn("OK"))` and the old
`from lcd_bitmap_ide import FSM, State, Event` line are accepted for
compatibility, but the canonical writer emits only the declarative
`fsm = FSM(...)` and `fsm.state/event/transition` form.

Phase 3A.1 E2E coverage verifies that the canonical authoring text contains no
import/eval/exec/function boilerplate, preserves transition handles and
round-trips after autosave reload.
