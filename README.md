# LCD-bitmap IDE

**LCD-bitmap IDE** is an offline engineering workbench for monochrome LCD interfaces, finite-state-machine navigation, bitmap fonts, physical control panels and firmware-ready screen exports.

It is built for embedded HMI teams that need a deterministic design source: one portable `.lcdproj` file contains the FSM graph, LCD screens, control panel bindings, tags, procedures, alarms and runtime simulation metadata.

## Capabilities

- Pixel-accurate LCD editor for text, lines, rectangles, bitmaps, glyphs and special UI elements.
- FSM editor with draggable states, event-labelled transitions, validation and ELK-based layout.
- Physical control panel designer with button-to-event bindings.
- Runtime preview for stepping through state flows without target hardware.
- Text registry for multilingual screen copy and CSV hand-off.
- Screen DSL import/export for structured review and agent-assisted edits.
- Embedded exports: C headers, raw binary, XBM, Arduino PROGMEM, Rust embedded-graphics and ESP-IDF.
- Local REST API and MCP endpoint for CLI tools, Codex, Claude Code, OpenCode, LM Studio and Ollama-based agents.

## Download

Desktop installers and portable builds are published from [GitHub Releases](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases).

- Windows: Setup or Portable build.
- Linux: AppImage, deb or tar.gz.
- Developers: clone the repository and run the desktop app locally.

## Quick Start From Source

```bash
git clone https://github.com/myahlovvlad/LCD-bitmap-IDE.git
cd LCD-bitmap-IDE
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`.

For the desktop app:

```bash
npm run electron:dev
```

## Public Demo

The repository includes a neutral bundled demo project and Screen DSL examples:

- `examples/universal-lcd-demo.lcdproj`
- `examples/screen-dsl/`

The demo is intentionally generic. It does not contain proprietary instrument firmware, decompiled code, real device screen catalogs, serial-number mappings or vendor-specific specifications.

## Beginner Manuals

Generated user manuals are available in HTML, PDF and DOCX:

- [Manual index](docs/user-manuals/index.html)
- Operation user manual: [EN PDF](docs/user-manuals/operation-user-manual.en.pdf), [RU PDF](docs/user-manuals/operation-user-manual.ru.pdf), [ZH PDF](docs/user-manuals/operation-user-manual.zh.pdf)
- LLM project lifecycle manual: [EN PDF](docs/user-manuals/llm-project-lifecycle-manual.en.pdf), [RU PDF](docs/user-manuals/llm-project-lifecycle-manual.ru.pdf), [ZH PDF](docs/user-manuals/llm-project-lifecycle-manual.zh.pdf)

The operation manual is written for first-time users. It walks through opening the demo, modeling a measurement-oriented UI workflow, previewing setup/run/result/error paths and exporting firmware assets. Physical measurement acquisition still requires your instrument firmware, backend service or hardware connector.

## API And MCP

The Electron build starts local-only automation endpoints:

- REST API: `http://127.0.0.1:8766`
- MCP endpoint: `http://127.0.0.1:8767/mcp`

Examples:

```bash
curl http://127.0.0.1:8766/api/health
curl http://127.0.0.1:8766/api/project/meta
curl http://127.0.0.1:8766/api/fsm/states
curl -X POST http://127.0.0.1:8766/api/runtime/event \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"START\"}"
```

See [docs/API_MCP_CONNECTORS.md](docs/API_MCP_CONNECTORS.md) for agent workflows and connector examples.

## Development

```bash
npm run typecheck
npm test
npm run test:renderer
npm run test:importer
npm run build
npm run docs:user
```

Use `npm run check` for the browser acceptance gate and `npm run check:full` for the broader local release gate.

## Project Layout

```text
src/
  application/    command bus, project sessions, ChangeSet application
  compiler/       normalized IR and deterministic embedded exports
  domain/         shared project, FSM, LCD, tag and procedure models
  entities/       schema-first project/screen factories and validators
  features/       React workspaces for FSM, LCD, runtime, tags and docs
  main/           Electron main process, REST API and MCP server
  renderer/       React shell, store, i18n, manual and rendering utilities
  screen-dsl/     JSON/YAML screen authoring DSL
docs/
  API_MCP_CONNECTORS.md
  SECURITY.md
  TESTING.md
  site/
examples/
  universal-lcd-demo.lcdproj
```

## License

MIT © Vlad Myahlov.
