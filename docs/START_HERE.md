# Start Here

LCD-bitmap IDE models an embedded device interface as one connected project.
Do not begin by trying every workspace. Begin with the device workflow and add
detail in the order below.

Russian version: [START_HERE.ru.md](START_HERE.ru.md).

## The Short Mental Model

```text
Project
  ├─ Behavior: events → FSM states → transitions
  ├─ Presentation: LCD screens → canvas objects → text and bitmap resources
  ├─ Interaction: physical controls → events
  ├─ Data and actions: tags → procedures → alarms
  ├─ Validation: runtime simulation
  └─ Delivery: handoff package and firmware exports
```

The FSM answers **what the device is doing**. A screen answers **what the
operator sees**. A control binding answers **which event the operator sends**.
Tags, procedures and alarms connect the interface to runtime data and device
actions. Runtime validates the combined model; it is not a second copy of the
project.

## Recommended First Project

1. Open **Demo** and run the built-in **Tour** once.
2. In **FSM**, define the smallest useful path: initial state, one action, one
   result or error state.
3. In **LCD**, assign and draw one screen per state that needs a distinct view.
4. In **Control panel**, bind buttons to existing FSM events.
5. Add **Tags**, **Procedures** and **Alarms** only when the workflow needs live
   values, backend actions or fault handling.
6. In **Runtime**, exercise the normal path, cancellation and at least one error
   path.
7. Save the `.lcdproj`, then use **Handoff** or the firmware export commands.

Use **Screen DSL**, **Text registry**, automation API/MCP and advanced settings
after the first runtime-valid project works. They are alternate authoring and
integration surfaces, not separate project models.

## Rules That Prevent Rework

- Create events before binding controls or transitions to them.
- Keep state IDs, screen IDs, event IDs and tag IDs stable after integration.
- Reuse a screen only when two states genuinely present the same operator view.
- Treat the `.lcdproj` domain model as the source of truth. Script documents,
  compiler IR, runtime state and UI selections are projections or transient
  state.
- Resolve validation errors before export. Test failure, cancellation and
  recovery paths, not only the happy path.
- Never put executable JavaScript in conditions. The runtime accepts a small,
  declarative expression model by design.

## Where To Go Next

- [Conceptual model](CONCEPTUAL_MODEL.md) — entities, layers and sources of truth.
- [Operation manual](operation_manual.md) — controls and task procedures.
- [Documentation index](DOCUMENTATION_INDEX.md) — the right document for each job.
- [Architecture](ARCHITECTURE.md) — developer-facing boundaries and data flow.
- [API and MCP connectors](API_MCP_CONNECTORS.md) — local automation.
- [Technical debt register](TECHNICAL_DEBT.md) — known cleanup and redesign work.

## Developer Bootstrap

```bash
npm ci
npm run electron:dev
```

For browser-only renderer work, use `npm run dev`. For the Tauri/Rust shell, see
[apps/tauri/README.md](../apps/tauri/README.md). Before submitting a change, run
the narrowest relevant test command and at least:

```bash
npm run typecheck
npx vitest run tests/utils/architectureBoundary.test.ts
```
