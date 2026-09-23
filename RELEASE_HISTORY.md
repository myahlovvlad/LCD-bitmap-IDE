# Release history

This file is the concise product-facing record of published releases and work
prepared for the next release. Technical detail and every individual change are
kept in [CHANGELOG.md](CHANGELOG.md).

## Unreleased

## v0.1.21

- BDF bitmap fonts can be exported with Unicode-safe glyph names and imported
  back without bitmap changes.
- Text Registry can show only chosen translation columns, export that subset to
  CSV, and set the display language of the filtered LCD text in bulk.
- Runtime can start and execute a chosen UX scenario, show its user route on an
  interactive map, and display a live diagnostic-warming countdown.
- Settings can check whether a newer GitHub Release is available.
- The GitHub-hosted Tauri workflow builds native packages for Windows x64,
  Linux x64, macOS Apple Silicon and macOS Intel.

## v0.1.20

- Current stable desktop release line.
- Includes Electron and Tauri desktop distribution, native Tauri packages for
  Windows, Linux and both macOS architectures, and SHA-256 release checksums.

## v0.1.2

- Introduced the Tauri 2 desktop shell and native package automation.
- Added serial transport, ECROS command profiles, runtime orchestration and
  multilingual localization.

## v0.1.1-public

- Prepared the public open-source distribution, universal demo project and
  user/developer documentation.

## Build and publish policy

- The **Tauri — Windows, Linux, macOS** workflow is used for verification and
  produces CI artifacts retained for 30 days.
- Pushing a `v*` tag starts the **Release** workflow, which publishes release
  assets and `SHA256SUMS.txt` on GitHub Releases after all native jobs pass.
- A manually dispatched release requires an explicit permanent version tag;
  use a matching version in the application manifests before publishing.
