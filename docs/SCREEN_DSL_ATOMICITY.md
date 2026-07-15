# Screen DSL Atomicity

Screen DSL Apply uses the existing `ProjectChangeSet` transaction model.

Properties:

- all mapped commands share one `projectId` and `expectedRevision`;
- dry-run returns a candidate without mutating the caller session;
- Apply finalizes once;
- one Apply increments revision once;
- one Apply creates one history entry;
- Undo restores the whole import;
- Redo reapplies the same committed object IDs.

If ChangeSet envelope validation or final project validation fails, the original
session is returned unchanged.
