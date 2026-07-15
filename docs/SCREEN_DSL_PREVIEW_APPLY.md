# Screen DSL Preview And Apply

Preview result is bound to:

- project ID;
- base revision;
- target screen fingerprint;
- source fingerprint;
- import mode;
- deterministic identity plan.

Apply is explicit and never automatic. A source edit after Preview invalidates
Apply. A project revision change after Preview invalidates Apply. A target
screen fingerprint change after Preview invalidates Apply.

Destructive object deletes are represented in the semantic diff and require
`confirmDestructive` at Apply time.

Implemented now:

- update mode Preview;
- update mode dry-run ChangeSet;
- update mode explicit Apply;
- create mode exact-ID Preview and Apply;
- clone mode deterministic ID rewrite and Apply;
- same-ID screen/resource collision blocking;
- stale revision/source/screen protection;
- destructive confirmation;
- one ChangeSet history entry;
- Undo/Redo through existing session history patches.

Deferred:

- Screen Schema Studio UI;
- Electron file import/export;
- Playwright Screen Schema E2E.
