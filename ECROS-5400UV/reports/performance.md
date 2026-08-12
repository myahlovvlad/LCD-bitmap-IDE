# ECROS performance baseline

## Method

Playwright Chromium production preview; six search and graph-toolbar interactions; p95 budget: dispatch <= 16.7 ms, settle <= 500 ms.

Playwright Electron production main/preload bundle; opening demo and FSM workspace, then main-process and renderer snapshot.

## After

- Browser dispatch p95: 5.100000001490116 ms
- Browser settle p95: 70.70000000298023 ms
- Long tasks >200 ms: 0
- Electron startup to FSM snapshot: 7751.48 ms
- Main resident set: 113236 KiB
- Renderer JavaScript heap: 60300000 bytes
- React Flow nodes / viewport-visible nodes / edges: 308 / 290 / 605
- LCD renderer instances on FSM canvas: 1

## Before / after

A comparable historical baseline was not stored in the repository. The **before** field is deliberately null; this report does not invent a comparison. The current figures are the reproducible baseline for future releases.

## Residual risks

- The initial JavaScript chunk remains above the Vite warning threshold; WebGL FSM stays lazy-loaded but the main bundle needs a future split.
- OS-level CPU and renderer RSS must be profiled on target hardware before a regulated-device release.
