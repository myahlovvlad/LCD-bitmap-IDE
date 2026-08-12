# ECROS-5400UV Change Log

## Phase 0 — ID Migration (2026-08-12T08:12:48.271Z)

- Source: C:\Users\Vlad Myahlov\Documents\GitHub\lcd-editor\ECROS-5400UV\ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj
- Backup: C:\Users\Vlad Myahlov\Documents\GitHub\lcd-editor\ECROS-5400UV\backups\ECROS-5400UV_FSM_BACKUP_2026-08-12T08-12-48.lcdproj
- SHA-256 original: f36aaed94f41a2d09a4b7b5273ba259c31ff8abf5a4406bd91dea6b9e060bef5
- States auto-renamed: 298
- Ambiguous (skipped): 1

### Files changed
- ECROS-5400UV/ECROS-5400UV_FSM_12-08-2026-runtime-complete.lcdproj
- ECROS-5400UV/reports/ (all report files)
- ECROS-5400UV/backups/ECROS-5400UV_FSM_BACKUP_2026-08-12T08-12-48.lcdproj
## Post-migration validation (2026-08-12T08:12:48.368Z)
- SHA-256 migrated: 22ef26f1914e1d37edfd283415825f96fd0a6c0bfe8c030af817b7b3cb0ae404
- States: 299
- Screens: 299
- Transitions: 605
- Post-migration backup: C:\Users\Vlad Myahlov\Documents\GitHub\lcd-editor\ECROS-5400UV\backups\ECROS-5400UV_FSM_POST-MIGRATION_2026-08-12T08-12-48.lcdproj

## Layer visibility presets (2026-08-12T09:46:41.361Z)

- Backup: C:\Users\Vlad Myahlov\Documents\GitHub\lcd-editor\ECROS-5400UV\backups\ECROS-5400UV_FSM_PRE-LAYER-PRESETS_2026-08-12T09-46-41-238Z.lcdproj
- SHA-256 before: 22ef26f1914e1d37edfd283415825f96fd0a6c0bfe8c030af817b7b3cb0ae404
- Added one single-layer visibility preset for each existing layer: diagnostic, photometry, quantitative, settings, shared, files, main-menu, kinetics, multiwave, user
- Total presets: 10
- SHA-256 after: 984fa9186fe86f45fe2996536134af6f3f0f35da5306f9ab63c003dfb3f070ec

## Runtime, HMI and graph verification (2026-08-12)

- Runtime guard evaluation now resolves dotted instrument tags such as `alarm.*` and `device.error` from the active tag context.
- Event priority is deterministic: a satisfiable local `SYS.ERR` route pre-empts a manual or automatic request; no target state is invented when an active state has no declared fault route.
- HMI uses localized LCD rendering, disabled-action feedback, an explicit context menu and responsive/collapsible inspector layout.
- ECROS runtime coverage: 599 executable routes passed; six duplicate `UI.ESC` route pairs require an authoritative guard or priority decision and are listed in `ambiguous-decisions.md`.
- Topological reachability: 299 of 299 states/screens.
- Performance snapshot: 299 FSM state nodes, 605 edges, 1 FSM LCD renderer instance; details are in `performance.md`.
