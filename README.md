# LCD-bitmap IDE

**LCD-bitmap IDE** is an offline desktop workbench for designing monochrome embedded HMI projects: LCD screens, finite-state-machine navigation, button bindings, runtime tags, procedures, alarms and firmware-ready display assets.

The project is designed for embedded UI engineers, firmware developers, laboratory-instrument prototyping teams and technical writers who need one deterministic source file for a small display workflow. A portable `.lcdproj` file keeps the visual LCD model, FSM behavior, text registry, runtime metadata and export settings together.

## Product Scope

LCD-bitmap IDE helps you design and validate the operator-facing interface around a measurement or device-control workflow:

- model setup, run, result, warning, error and service states;
- draw pixel-accurate 128x64 monochrome LCD screens;
- bind physical buttons and runtime tags to FSM behavior;
- preview the workflow before target hardware integration;
- export screen assets for embedded firmware projects;
- let local LLM agents inspect and edit the open project through REST or MCP.

The application does not acquire physical measurements by itself. Real acquisition requires your own instrument firmware, backend service or hardware connector.

## Download

Desktop builds are published from [GitHub Releases](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases).

| Platform | Artifact |
|---|---|
| Windows | [Setup x64](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest/download/LCD-bitmap-IDE-0.1.1-Setup-x64.exe) · [Portable x64](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest/download/LCD-bitmap-IDE-0.1.1-Portable-x64.exe) |
| Linux | [AppImage x86_64](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest/download/LCD-bitmap-IDE-0.1.1-x86_64.AppImage) · [deb amd64](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest/download/LCD-bitmap-IDE-0.1.1-amd64.deb) · [tar.gz x64](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest/download/LCD-bitmap-IDE-0.1.1-x64.tar.gz) |
| Developers | Source checkout with `npm ci` and `npm run electron:dev` |

If a direct asset link is not available yet, open the [latest Release page](https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest) and download the matching file from the asset list.

## Quick Start From Source

```bash
git clone https://github.com/myahlovvlad/LCD-bitmap-IDE.git
cd LCD-bitmap-IDE
npm ci
npm run electron:dev
```

For browser-only development:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Documentation Downloads

Two beginner-oriented manuals are included in English, Russian and Chinese. Each manual is available as HTML, PDF and DOCX.

### Operation User Manual

| Language | HTML | PDF | DOCX |
|---|---|---|---|
| English | [HTML](docs/user-manuals/operation-user-manual.en.html) | [PDF](docs/user-manuals/operation-user-manual.en.pdf) | [DOCX](docs/user-manuals/operation-user-manual.en.docx) |
| Русский | [HTML](docs/user-manuals/operation-user-manual.ru.html) | [PDF](docs/user-manuals/operation-user-manual.ru.pdf) | [DOCX](docs/user-manuals/operation-user-manual.ru.docx) |
| 简体中文 | [HTML](docs/user-manuals/operation-user-manual.zh.html) | [PDF](docs/user-manuals/operation-user-manual.zh.pdf) | [DOCX](docs/user-manuals/operation-user-manual.zh.docx) |

### LLM Project Lifecycle Manual

| Language | HTML | PDF | DOCX |
|---|---|---|---|
| English | [HTML](docs/user-manuals/llm-project-lifecycle-manual.en.html) | [PDF](docs/user-manuals/llm-project-lifecycle-manual.en.pdf) | [DOCX](docs/user-manuals/llm-project-lifecycle-manual.en.docx) |
| Русский | [HTML](docs/user-manuals/llm-project-lifecycle-manual.ru.html) | [PDF](docs/user-manuals/llm-project-lifecycle-manual.ru.pdf) | [DOCX](docs/user-manuals/llm-project-lifecycle-manual.ru.docx) |
| 简体中文 | [HTML](docs/user-manuals/llm-project-lifecycle-manual.zh.html) | [PDF](docs/user-manuals/llm-project-lifecycle-manual.zh.pdf) | [DOCX](docs/user-manuals/llm-project-lifecycle-manual.zh.docx) |

Manual index: [docs/user-manuals/index.html](docs/user-manuals/index.html)

## Core Capabilities

- **LCD authoring:** text, lines, rectangles, bitmap layers, glyph editing and special UI elements under strict monochrome display bounds.
- **FSM modeling:** draggable states, event-labeled transitions, validation and automatic graph layout.
- **Control-panel binding:** connect physical button events to the screen workflow.
- **Runtime preview:** step through state flows and validate operator paths before hardware handoff.
- **Text registry:** maintain multilingual screen copy and CSV handoff.
- **Screen DSL:** review and edit screen layouts as structured JSON/YAML.
- **Embedded exports:** C headers, raw binary frame buffers, XBM, Arduino PROGMEM, Rust embedded-graphics and ESP-IDF-style assets.
- **Automation:** local REST API and MCP endpoint for Codex, Claude Code, OpenCode, LM Studio, Ollama wrappers and shell scripts.

## Public Demo

The repository includes a neutral demo project:

- [examples/universal-lcd-demo.lcdproj](examples/universal-lcd-demo.lcdproj)
- [examples/screen-dsl/](examples/screen-dsl/)

The demo is intentionally generic and excludes proprietary implementation files, private device identifiers, decompiled code and vendor-specific screen catalogs.

## API And MCP

The Electron desktop build starts local-only automation endpoints:

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

Connector setup and agent workflows are documented in [docs/API_MCP_CONNECTORS.md](docs/API_MCP_CONNECTORS.md).

## Quality Gates

```bash
npm run typecheck
npm test
npm run test:renderer
npm run test:importer
npm run build
npm run docs:user
```

Use `npm run check` for the browser acceptance gate and `npm run check:full` for the broader local release gate.

## Documentation Build

The downloadable manuals are generated by:

```bash
npm run docs:user
```

The generator writes HTML, PDF and DOCX artifacts into `docs/user-manuals/`.

## Project Layout

```text
src/
  application/    command bus, project sessions and ChangeSet application
  compiler/       normalized IR and deterministic embedded exports
  domain/         shared project, FSM, LCD, tag and procedure models
  entities/       schema-first project and screen factories
  features/       React workspaces for FSM, LCD, runtime, tags and docs
  main/           Electron main process, REST API and MCP server
  renderer/       React shell, store, i18n, manual and rendering utilities
  screen-dsl/     JSON/YAML screen authoring DSL
docs/
  user-manuals/   generated HTML/PDF/DOCX manuals
  site/           product landing page
  SECURITY.md
  TESTING.md
examples/
  universal-lcd-demo.lcdproj
```

## Security Boundary

The public branch is intentionally sanitized. It does not include proprietary device projects, reverse-engineered firmware artifacts, private logs, generated confidential documentation, private keys or commercial screen catalogs.

REST and MCP servers bind to `127.0.0.1` and are intended for local developer automation only. Do not expose these ports through a public tunnel.

## License

MIT © Vlad Myahlov.
