# Manual Style Guide

This note records the documentation patterns used for the public LCD-bitmap IDE manual. It is intentionally written as a neutral style guide and does not reproduce third-party manual text, tables or procedures.

## Documentation Typology

- Front matter with notices, edition metadata and safety note semantics.
- Contents page with numbered chapters and task-oriented subsections.
- Introduction that lists application modules and defines documentation conventions.
- Installation chapter with requirements, preparation, new install, upgrade and startup flows.
- Software overview chapter with one short section per application module.
- How-to chapters organized around complete user tasks rather than feature descriptions.
- Troubleshooting chapter with symptom-driven entries.
- Procedure steps that use direct imperative verbs and explicit UI targets.
- Tables for module mapping, file extensions, privileges and setup options.
- Notes, tips and cautions separated from procedural steps.

## Applied To LCD-bitmap IDE

The in-app manual follows this pattern:

- Overview and concept model.
- Installation and startup.
- Interface map.
- Typical task workflows.
- Module-focused chapters for FSM, LCD, tags, procedures, runtime and text registry.
- API/MCP automation chapter.
- Troubleshooting and validation guidance.

The generated HTML/PDF manual is produced from `src/renderer/config/operationManual.ts` by `scripts/generate-manual.ts`.
