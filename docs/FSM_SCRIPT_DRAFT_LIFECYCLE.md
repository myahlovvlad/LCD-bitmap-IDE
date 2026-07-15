# FSM Script Draft Lifecycle

## Clean Document

1. Script Studio creates source from the canonical graph.
2. Source and generated fingerprints match.
3. Graph changes can refresh the document automatically.
4. No project revision or history is created.

## Dirty Document

1. User edits, pastes or imports source.
2. Source fingerprint differs from generated fingerprint.
3. Preview may run automatically after debounce.
4. Preview remains a dry-run.
5. Apply remains explicit.

## Graph Change

- Clean document: regenerated safely from the new graph.
- Dirty document: source text is preserved and status becomes stale.
- Existing stale preview cannot apply.

## Workspace Switch

Script Studio uses an in-memory cache keyed by project ID and format. Dirty
drafts survive workspace switches in the running app session. They are still not
portable project state and are not written to `.lcdproj`.

## Project Switch

A different project ID gets a different transient document identity. Project
switching does not merge drafts between projects.
