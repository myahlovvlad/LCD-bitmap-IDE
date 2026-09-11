# Full workspace information architecture and themes — design

## Decision and scope

The approved approach is an incremental redesign: retain the existing project
model, `.lcdproj` format, router modes, FSM/runtime behavior, MCP command
contracts and editor capabilities; replace the application shell and clarify
each workspace in successive deliveries. A visual-only reskin and a wholesale
rewrite are explicitly out of scope.

The application is an engineering workbench for an ECROS-5400UV
spectrophotometer, not a generic dashboard. Its primary job is to let an
operator or supplier prove the chain:

`FSM state -> LCD 128x64 screen -> physical key -> event/tag -> procedure -> alarm/recovery`.

No UI-only action may mutate the project or change its revision. This includes
theme selection, panel collapse, selected group, active inspector tab and FSM
canvas viewport.

## Global shell

The desktop frame has exactly five stable regions:

1. **Header** — product identity, project name, separate project/schema and
   IDE software version, Open, Save, Export, language, global Settings and
   theme selector.
2. **Activity bar** — compact labelled category selectors.
3. **Workspace navigator** — the entries in the selected category.
4. **Workspace host** — the selected editor, including its local toolbar and
   any canvas, preview or table.
5. **Status bar** — display profile, project counts, validation, save state and
   active model/device context.

The activity bar groups the existing route modes without renaming or removing
them:

| Group | Existing workspaces | Primary question answered |
| --- | --- | --- |
| Interface | LCD editor, Panel, Text registry, Screen DSL | What does the instrument show and how is it operated? |
| Logic | FSM editor, Alarms | What state is the instrument in and why can it change? |
| Hardware | Tags, Procedures | Which device values/actions implement the model? |
| Verify and deliver | HMI model, Runtime, HMI handoff | Does the model run, and is it ready for the supplier/device? |

Settings stays a global header action rather than an orphaned workspace. Every
existing workspace must remain directly routeable; a deep link automatically
opens the containing activity group. The navigator keeps stable test IDs but
tests must select its containing group before clicking an entry.

On a 1280 x 720 desktop the shell keeps the work area usable. The navigator and
secondary inspectors can collapse; Save, the validation status and the active
workspace title remain visible. There is one primary action per workspace;
secondary commands move to a compact toolbar or overflow rather than becoming
another global row of buttons.

## Theme system

Theme preference is an independent UI preference:

- Values are `system`, `light`, and `dark`.
- First use defaults to `system`.
- `system` resolves from `prefers-color-scheme`; it responds to an OS change
  while the IDE is open.
- The explicit choice is persisted in guarded local storage and is restored
  before the first substantive render. Storage failure falls back to `system`.
- The resolved theme is exposed through `data-theme` on the document root.

CSS semantic tokens, rather than workspace-specific literal colors, define
page background, surfaces, borders, primary action, focus, warning, error,
text and muted text. Each theme must meet readable contrast and retain visible
keyboard focus. The simulated LCD's device palette is not recolored by the
application theme: its phosphor/monochrome appearance is part of the rendered
instrument content.

The header identifies **Software vX** and **Project vY / schema Z** separately.
The software version is read-only build metadata; project metadata stays
editable where it is currently edited.

## Shared editor pattern

Where a workspace has a collection and a selected object, it uses the same
three-part layout:

- **Navigator**: searchable object list, filters and create/import action.
- **Work area**: canvas, preview, table or procedure steps.
- **Inspector**: properties, links, validation and usage.

The pattern does not force an inspector on Runtime or HMI handoff when it adds
no value. Sidebars are collapsible and their width/selection state is UI-only.
Selected objects display a human title first and technical ID as copyable
metadata. Validation always says what is missing and offers a link to the
responsible object; it never gives a generic disabled control without reason.

## Workspace information architecture

### FSM editor

The FSM editor is the authoritative logic graph. Its navigator selects layer,
subsystem or overview; the work area holds the graph; the inspector presents
the selected state or transition, its screen binding, events, guards,
procedures and impacted alarms. The operator's 2D viewport is retained per
project and graph representation through tab changes and reloads. Auto-layout
is explicit and is the only normal automatic fit action.

### LCD editor and screen DSL

The LCD editor owns the catalogue of 128x64 screens, raster preview and screen
element inspector. The inspector has separate **Appearance**, **Data/Tags**,
**FSM bindings** and **Diagnostics** sections. The DSL/HTML view is a source
tool for the selected screen: it renders an import preview, change summary and
diagnostics before apply. It never silently overwrites a screen. The existing
HTML round-trip/MCP commands remain adapters to this screen model rather than a
second source of truth.

### Instrument panel

The panel work area depicts the physical keypad. Selecting a control opens an
inspector with its emitted event, permitted FSM states, current screen
behavior, and blocked-state reason. It links directly to the HMI trace and
FSM transition. A clickable button has a real event binding; a visually drawn
but unbound button is validation-visible as an error, not a silent no-op.

### Text registry

Texts are shown as a searchable catalogue with RU, EN and ZH values side by
side, screen usage and a 128x64 overflow indication. Editing a text updates
only the text registry; screen rendering is the observable consumer. Missing
translation and LCD clipping are separate diagnostics.

### Tags and procedures

Tags use a catalogue plus inspector that answers type, unit, producer,
consumers and last simulated value. Procedures show a step/command work area,
preconditions, callers and simulation trace. Neither workspace invents values
locally: all references link to the project model.

### Alarms

An alarm shows severity, triggering condition, affected states/screens,
operator message, acknowledgement/recovery action and procedure dependency.
The work area favours a concise condition-impact-recovery trace over a
decorative graph. Alarm severity must always be textual as well as colored.

### HMI model

HMI is the integration workspace, not another independent screen painter. A
user selects a physical key or an FSM state and sees the full chain between
state, bound LCD screen, control/event, tag mutations, procedure and
alarm/recovery. It has three explicit modes: **Design** (configure bindings),
**Simulation** (exercise them) and **Coverage** (find gaps). A blank scenario
pane gives a direct first action such as “Select a control” and explains the
result rather than showing unrelated global tags.

### Runtime

Runtime is a simulated instrument session. It presents connection/simulation
state, current FSM state, LCD output, usable physical keys, current procedure
and event/tag trace. Disabled keys display their guard or unavailable-binding
reason. The express timer is visibly labelled as simulated and reports its
time multiplier; it advances only runtime time and never project data.

### HMI handoff

HMI handoff is a three-step delivery wizard:

1. **Validate** — blocking links, missing screens, unbound keys, coverage and
   required translations.
2. **Supplier package** — exportable HMI/FSM/DSL/text assets, version and
   traceability summary for the Chinese embedded team.
3. **Device connection** — optional serial/COM diagnostics and logs, clearly
   marked unavailable when hardware is not connected.

It does not imply that the IDE generates an embedded firmware binary. The
hand-off explicitly identifies the additional C/C++ source, MCU/toolchain,
drivers and update procedure needed by the supplier.

## Data flow and error rules

The project store remains the sole source of project truth. Workspaces read
and mutate it through existing application mutation services. Theme, viewport,
sidebar and route presentation are stored separately as guarded local UI
preferences. Runtime simulation state is separate and is reset only by the
existing runtime commands.

Invalid bindings, missing screens, missing translations, unsupported display
content and disabled runtime buttons surface through the common validation
model. UI errors must link to the edit location when known. The application
must not make the September ECROS project look valid merely because a preview
renders; warnings and blocking items retain their severity.

## Delivery sequence

1. **Foundation**: complete the common shell, theme preference, responsive
   behavior, stable test navigation and settings access; finish and verify FSM
   retained viewport work already started.
2. **Interface and logic**: recompose LCD, panel, texts, DSL, tags, procedures
   and alarms around the shared editor pattern and explicit validation links.
3. **HMI and delivery**: make HMI traceable, make Runtime explain enabled and
   disabled controls, and split HMI handoff into validation/package/connection.

Each delivery is independently testable and keeps current project files
loadable. A later delivery may not depend on a destructive project migration.

## Acceptance checks

1. First start follows the system theme; manual choice persists and changes
   neither project revision nor exported `.lcdproj` content.
2. Software and project/schema versions are visibly distinct.
3. All current workspace modes are reachable from exactly one group and through
   their existing direct routes; Settings remains reachable globally.
4. A user can select an HMI key and trace its state, screen, event/tag,
   procedure and alarm/recovery without opening unrelated tabs manually.
5. Runtime explains each unavailable visible key and labels simulated/express
   time; it never silently ignores a configured control.
6. Panel, LCD, FSM and HMI validation identify unbound controls and missing
   screen bindings with a navigable corrective action.
7. The 128x64 preview is readable in both app themes and remains device-colored.
8. Focused unit tests cover theme resolution/persistence and UI-only state;
   Playwright covers all groups, theme switch, deep routes, HMI trace entry and
   FSM viewport preservation. Renderer typecheck and build pass.
9. The supplier package includes a clear non-firmware limitation and the
   version/validation summary required to reproduce the HMI behavior.
