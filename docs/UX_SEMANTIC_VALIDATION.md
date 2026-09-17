# UX Semantic Validation

This document describes the UX Semantic Contract domain model and the deterministic UX
validator built on top of it. It is a living document — keep it in sync with
`src/domain/uxContract.ts`, `src/services/ux/*` and the automation tools listed in
[API and MCP connectors](API_MCP_CONNECTORS.md).

## Why This Exists

The FSM/screen/control-panel model already tells you whether a transition *exists and executes*
(`run_fsm_scenario`). It says nothing about whether the resulting workflow makes sense to an
operator: whether an error screen has a way out, whether the same action uses two different
button labels on two screens, whether a destructive action can be triggered without confirmation.
The UX Semantic Contract adds a typed layer of intent (roles, goals, policies) on top of the
existing structural model, and a deterministic rule engine reads both to produce traceable
findings — without requiring a cloud LLM.

## Authority Boundary

- **The UX contract** (`project.uxContract`) owns role/intent/policy metadata: what a screen is
  *for*, what a control *means*, what must be true for a goal to succeed.
- **Screens, FSM and control-panel data** own executable/UI structure: what actually renders and
  what actually transitions.
- Exported formats (Screen HTML, FSM Mermaid/Python DSL) are **not** extended to carry UX
  metadata. This is a deliberate boundary: letting an export format also carry authoritative UX
  intent would create two sources of truth for the same fact. An agent that needs both structure
  and intent calls both export tools and reasons over them together (see
  `export_project_ux_review_packet`, which already does this for you).

## Domain Model

`src/domain/uxContract.ts` defines `ProjectUxContract` (version 1), stored as the optional
`project.uxContract` field, normalized on every project load by
`normalizeUxContract()` (mirrors `normalizeHardwareNotificationConfig`: absent input becomes a
fully-populated default contract, and every id reference that no longer exists — a deleted
screen, state, transition or control — is silently dropped). Legacy projects therefore always
load cleanly with an empty contract and produce warnings, not errors, until roles/intents are
declared.

Key types: `ScreenUxMetadata`, `StateUxMetadata`, `TransitionUxMetadata`, `ControlUxMetadata`
(role/purpose/intent per object), `UxTerminologyEntry` (preferred/forbidden labels per intent),
`UxUserGoal` (start/success/failure states, required/prohibited intents, criticality),
`UxScenarioDefinition` (a scripted `run_fsm_scenario`-compatible step list with pass/fail
expectations), and `UxPolicySet` (ten boolean toggles plus `defaultLocale`, all defaulting to
`true`/`'ru'`).

### Extraction layer

`src/services/ux/uxGraphBuilder.ts` builds a pure, framework-independent `ProjectUxGraph` from
the project: screens, states, transitions and controls, each carrying its source id and its
resolved UX metadata, plus a control→transition link derived from the *existing*
`project.bindings` (control panel `fsmEventId` ↔ FSM transition `trigger.eventId`) rather than
from label text. Visible text is extracted per locale from `TextCanvasObject`s for terminology
checks — it is evidence, never the sole source of behavior.

## Deterministic Validator

`src/services/ux/uxValidator.ts` exports `analyzeProjectUx(project, options)`, which builds the
graph, optionally executes scripted scenarios (Part D) and visual layout checks (Part E), runs
every rule module, and returns a `ProjectUxAnalysisReport`:

```ts
{
  verdict: 'pass' | 'needs_review' | 'fail',
  summary: { errors, warnings, infos, suggestions, needsHumanReview },
  coverage: { screensWithRole, statesWithPurpose, transitionsWithIntent,
              interactiveControlsWithIntent, errorStatesWithRecovery, criticalGoalsWithScenario },
  findings: UxValidationFinding[],   // stable order: category, then ruleId, then finding id
  graphSummary: { screens, states, transitions, controls, goals, scenarios },
  scenarioResults?: UxScenarioResult[]
}
```

Every finding carries a `ruleId`, `category`, `severity`, a human-readable `message`, optional
`rationale`/`remediation`, and `affected` ids (`screenIds`/`stateIds`/`transitionIds`/
`controlIds`/`goalIds`/`scenarioIds`) so an agent can always jump straight to the object in
question. Findings are 100% reproducible: the same project and options always produce the same
finding ids in the same order.

**Analysis is separate from the generic project validator on purpose.** `project.validation`
(the existing `ValidationIssue[]`) still gates every command-bus mutation — a UX finding never
blocks an unrelated FSM/screen edit, and an empty/legacy contract never turns into a surprise
blocking error on load. Run `analyze_project_ux` on demand (an MCP/REST tool call, or the "Run
analysis" button in the UX Validation panel), not on every keystroke.

### Rule catalogue

| Rule id | Category | Default severity | What it checks |
|---|---|---|---|
| `ux.screen-state-binding-missing` | structure | warning | State has no bound LCD screen |
| `ux.state-screen-binding-invalid` | structure | error | State references a screen id that no longer exists |
| `ux.user-transition-without-visible-trigger` | structure | error/warning | Button-mechanism transition with no bound control (error); intent-declared event transition with none (warning) |
| `ux.visible-control-without-intent` | structure | warning | Interactive control has no declared UX intent |
| `ux.transition-intent-mismatch-with-control` | semantics | warning | A transition's intent disagrees with its trigger control's intent |
| `ux.control-event-missing-transition` | structure | error | Control fires an event no transition listens for |
| `ux.transition-to-unreachable-state` | structure | warning | Transition's source state is unreachable from any initial state |
| `ux.nonterminal-state-without-exit` | recovery | error | Non-terminal state has no outgoing transition (dead end) |
| `ux.error-state-without-recovery` | recovery | error | Error-role state has no path back to an initial state or declared recovery state |
| `ux.warning-state-without-safe-action` | recovery | warning | Warning-role state has no outgoing transition |
| `ux.result-state-without-next-action` | recovery | warning | Non-terminal result-role state has no next action |
| `ux.progress-state-without-cancel-or-status` | behavior | warning | Progress-role state has neither a cancel/stop control nor declared status info |
| `ux.back-intent-does-not-return-to-logical-context` | behavior | warning | A "back" control's target has no path back to where it was triggered from |
| `ux.unintended-navigation-loop` | behavior | suggestion | A navigation cycle exists with no `rationale` documented on any edge in it |
| `ux.orphan-state` | structure | error | State is unreachable from any initial state |
| `ux.goal-has-no-success-path` | behavior | error | A declared goal's start state cannot reach any declared success state |
| `ux.screen-missing-role` | semantics | warning | Screen has no declared role |
| `ux.state-missing-purpose` | semantics | warning | State has no declared purpose |
| `ux.transition-missing-intent` | semantics | warning | A visibly-triggered transition has no declared intent |
| `ux.intent-label-inconsistent` | terminology | warning | A control/transition label deviates from the intent's preferred label |
| `ux.intent-uses-forbidden-label` | terminology | warning | A label is explicitly forbidden for that intent |
| `ux.same-label-different-intent` | terminology | warning | The same label text is used for two different declared intents |
| `ux.prohibited-action-present-on-screen` | semantics | error | An intent declared prohibited on a screen is actually available there |
| `ux.expected-action-missing-on-screen` | semantics | warning | An intent declared expected on a screen is not available there |
| `ux.primary-action-not-available` | semantics | error | A screen's declared primary action intent is not available on it |
| `ux.destructive-action-without-confirmation` | safety | error | A destructive/critical transition or control has no confirmation requirement |
| `ux.critical-transition-without-rationale` | safety | warning | A critical-risk transition has no documented rationale |
| `ux.error-state-missing-user-guidance` | safety | warning | An error-role state has no visible text and no declared purpose |
| `ux.recovery-action-not-reachable` | safety | error | A declared `recoveryStateId` is not actually reachable |
| `ux.cancel-flow-loses-user-context` | safety | error | A "cancel" control leads into an error-role state |
| `ux.operation-start-without-required-precondition` | safety | error | A goal's `requiredIntents` are not represented anywhere between its start and success states |
| `ux.failure-path-not-modeled` | safety | warning | A destructive/critical goal declares no failure state |
| `ux.critical-goal-without-scenario` | traceability | error | A destructive/critical goal has no scripted UX scenario |
| `ux.scenario-blocked-step` | scenario | error/warning | A scenario step was blocked, or a required visible message never appeared |
| `ux.scenario-unexpected-final-state` | scenario | error/warning | A scenario's actual final state differs from `expectedFinalStateId` |
| `ux.scenario-transition-mismatch` | scenario | warning | A scenario step's actual resulting state differs from its `expectedStateId` |
| `ux.requirement-goal-not-covered-by-state-or-scenario` | traceability | warning | A goal is referenced by no state, screen, or scenario |

Additional deterministic **visual** checks (Part E, reusing the existing render + layout-analysis
pipeline rather than duplicating it) are reported under category `visual`:
`ux.visual-text-overflow` / `ux.visual-control-overlap` (from the same clipped/overlap analysis
`analyze_128x64_screens` already performs), `ux.visual-missing-explanation-text` (an error/warning
screen with no visible text object), `ux.visual-confirmation-incomplete` (a confirmation screen
missing a confirm or cancel control), `ux.visual-control-missing-label`, and
`ux.visual-destructive-control-not-distinguished` (a best-effort, metadata-only heuristic — the
target display is monochrome, so there is no color channel to reason about; it checks for
`helpText` distinguishing the control instead).

### Severity policy

- **error** — invalid references, impossible recovery/goal paths, and explicit policy violations
  (unconfirmed destructive action, prohibited action present). These are things a human
  explicitly declared must never happen, or structural claims that are provably false.
- **warning** — missing metadata on a legacy/unclassified project. Never upgraded to error just
  because a project is old; a freshly-migrated project with zero UX metadata gets warnings, not a
  failing report.
- **suggestion** / **needs_human_review** — ambiguous, graph-derived observations (an
  undocumented navigation loop) or anything imported from an external LLM review.
- Every rule is gated by the relevant `UxPolicySet` boolean where one exists, so a project can
  turn off a policy it doesn't want enforced (e.g. `requireConfirmationForDestructiveActions:
  false` for a device with no destructive actions at all).
- **A heuristic (`source: "heuristic_llm"`) finding can never carry `severity: "error"`** — the
  schema that validates an imported LLM review rejects that severity value outright, so this is
  enforced structurally, not by convention.

## Scenario Integration

`src/services/ux/uxScenarioRunner.ts::runUxScenario()` converts a `UxScenarioDefinition` into the
same step shape `run_fsm_scenario` already accepts and delegates to it directly — no
reimplementation of simulation. It always builds a fresh engine from a project snapshot (exactly
like `run_fsm_scenario`), so running a UX scenario never mutates the open project. A blocked step,
a wrong final state, a per-step state mismatch, or a required visible message that never appeared
each become a `ux.scenario-*` finding with the raw step trace attached as `evidence`.

## Optional LLM UX Review

`export_project_ux_review_packet` builds a self-contained bundle: project purpose/users, the UX
contract, screen HTML per screen, the FSM as Mermaid, the deterministic report, scenario traces,
fixed reviewer instructions, and a strict JSON Schema for the expected response
(`src/services/ux/uxReviewPacket.ts`). Send that packet to any LLM you like — no provider is
wired into the app. `import_project_ux_review` validates the response against the schema and
returns findings tagged `source: "heuristic_llm"`; malformed input is rejected structurally
(never thrown) and nothing is ever written into the project. A human accepts or rejects each
heuristic finding purely client-side — in the UX Validation panel, an "unreviewed" badge and a
dismiss button — with no persisted trace of the decision, since heuristic findings are transient
by design and re-derived fresh on the next import.

## Agent Workflow

```text
export_fsm_script / export_screen_html   → inspect current structure
get_project_ux_contract                  → inspect current UX intent + coverage gaps
preview_project_ux_contract_update       → propose role/intent/policy/goal/scenario changes
apply_project_ux_contract_update         → commit (undoable, revision-checked)
analyze_project_ux                       → deterministic findings, no cloud dependency
run_project_ux_scenario                  → verify one flow behaves as declared
analyze_project_ux (repeat)              → confirm findings cleared
export_project_ux_review_packet          → optional: hand to an external LLM for a second opinion
import_project_ux_review                 → merge its findings as non-blocking suggestions
```

## Example UX Contract — Laboratory Photometer

A representative contract for a measurement workflow: main menu → preparation → measurement →
progress → result → export/save, plus an error/recovery flow.

```json
{
  "version": 1,
  "projectPurpose": "Оператор готовит и запускает фотометрическое измерение, сохраняет и экспортирует результат.",
  "intendedUsers": ["operator", "lab-technician"],
  "policies": { "defaultLocale": "ru" },
  "userGoals": [
    {
      "id": "goal-measure",
      "title": "Выполнить измерение",
      "actorRoles": ["operator"],
      "startStateIds": ["main-menu"],
      "successStateIds": ["save-result"],
      "failureStateIds": ["error"],
      "requiredIntents": ["confirm-cuvette-inserted"],
      "criticality": "caution"
    }
  ],
  "terminology": [
    { "intent": "start-measurement", "preferredLabels": { "ru": "Старт" }, "forbiddenLabels": { "ru": ["ОК", "Далее"] } },
    { "intent": "cancel", "preferredLabels": { "ru": "Отмена" } }
  ],
  "screens": {
    "main-menu": { "role": "navigation", "primaryActionIntent": "start-measurement" },
    "measure": { "role": "progress", "operatorHint": "Измерение занимает около 5 секунд." },
    "save-result": { "role": "result", "requiredRecoveryActionIntents": ["return-to-menu"] },
    "error": { "role": "error", "requiredInformation": ["Причина ошибки", "Как исправить"] }
  },
  "states": {
    "error": { "role": "error", "recoveryStateId": "main-menu" }
  },
  "transitions": {
    "tr-main-measure": { "intent": "start-measurement" },
    "tr-error-main": { "intent": "acknowledge-error", "rationale": "Оператор подтверждает ошибку и возвращается в меню." }
  },
  "scenarios": [
    {
      "id": "sc-measure-happy-path",
      "title": "Успешное измерение",
      "goalId": "goal-measure",
      "initialStateId": "main-menu",
      "steps": [
        { "type": "event", "eventId": "START", "expectedStateId": "measure" },
        { "type": "event", "eventId": "SAVE", "expectedStateId": "save-result" }
      ],
      "expectedFinalStateId": "save-result",
      "expectNoBlockedSteps": true
    }
  ]
}
```

## Example Review Packet (Excerpt)

```json
{
  "version": 1,
  "reviewerInstructions": "You are reviewing the UX of an embedded LCD/HMI operator workflow. Use only the facts in this packet ... Return strict JSON only ...",
  "responseJsonSchema": { "type": "object", "properties": { "findings": { "type": "array", "items": { "...": "..." } } } },
  "screens": [{ "screenId": "main-menu", "role": "navigation", "html": "<section data-lcd-format=\"...\">...</section>" }],
  "fsmMermaid": "stateDiagram-v2\n  [*] --> main_menu\n  ...",
  "deterministicReport": { "verdict": "needs_review", "findings": ["..."] }
}
```

An external LLM's response must match `uxReviewResponseSchema` in `uxReviewPacket.ts`:
`{ findings: [{ category, severity: "suggestion"|"info"|"warning"|"needs_human_review",
message, affected, rationale?, confidence? }] }`. Anything else is rejected structurally by
`import_project_ux_review` and returned as diagnostics, never thrown.

## Safety Limitations

- Deterministic rules reason over the declared contract and the FSM/screen/control-panel
  structure; they cannot detect an intent the contract author never declared (e.g. a screen whose
  *actual* purpose differs from its declared `role`). Coverage metrics in the report exist
  precisely to surface how much of the project is still undeclared.
- The `ux.visual-destructive-control-not-distinguished` check is a metadata-only heuristic on a
  monochrome display — it cannot detect visual distinguishability in the way it could on a color
  screen.
- Heuristic (LLM) findings are exactly as reliable as the reviewer that produced them. They are
  never blocking, are always labeled `source: "heuristic_llm"`, and require a human decision
  (accept/dismiss) before they influence anything downstream of the report itself.
- `analyze_project_ux` is not run automatically on every project mutation (unlike the generic
  validator); call it explicitly after a batch of changes.
