# Screen Schema Studio UX

Date: 2026-06-25

Screen Schema Studio is available from the LCD workspace toolbar through the
`Schema` action. It is a transient authoring surface for Screen DSL text and is
not stored inside `.lcdproj`.

Implemented behavior:

- JSON/YAML source editor;
- create/update/clone import modes;
- generated canonical source from the current project selection;
- explicit Preview before Apply;
- diagnostics, semantic changes, raster byte summary and pixel budget summary;
- destructive Apply confirmation;
- stale Preview protection after project changes;
- explicit Apply through the application facade and Command Bus/ChangeSet;
- Undo/Redo as one project history entry;
- Open DSL File and Export Canonical actions through a feature-specific file
  adapter.

File operations are intentionally transient. Opening a DSL file only replaces
the current draft after dirty-draft confirmation. It never previews
automatically, never applies automatically and never increments the project
revision. Export Canonical writes generated source from the current project
state and does not replace the active draft.
