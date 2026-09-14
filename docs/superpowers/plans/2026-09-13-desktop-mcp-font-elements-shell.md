# Desktop delivery completion plan

1. Characterize the existing Tauri MCP server and add failing protocol/status
   tests before changing its lifecycle or bridge.
2. Add font parser/render/persistence tests, then repair normalization and add
   an import preview summary.
3. Define a pure selected-element export model and tests; connect JSON, C,
   binary and PNG downloads to the LCD editor.
4. Create the shared icon master/assets and point Electron and Tauri packaging
   to the same identity.
5. Add a persisted compact-navigation preference, accessible toggle and CSS
   layout behavior; cover it with E2E geometry and theme assertions.
6. Run full unit, browser, Electron and Tauri checks, rebuild distributables,
   then publish the permanent GitHub release.

