# Screen DSL Security

Screen DSL V1 is data-only. It does not execute JavaScript, Python, shell
commands, template expressions, environment variables, external URLs or file
references.

JSON security controls:

- duplicate key scanner;
- prototype key rejection;
- parser source size limit.

YAML security controls:

- no tags;
- no anchors;
- no aliases;
- no merge keys;
- no multi-document YAML;
- no arbitrary object construction.

Invalid input returns diagnostics and must not mutate project state.

Screen DSL file workflow security controls:

- renderer receives no arbitrary filesystem API;
- preload exposes only `screenDslFiles.open()` and `screenDslFiles.save(request)`;
- IPC channels are static: `screen-dsl:file:open` and `screen-dsl:file:save`;
- main process validates extension, size, UTF-8 encoding and save payloads;
- absolute paths are not returned to renderer;
- opening a file never previews or applies automatically;
- canonical export uses sanitized suggested filenames and dialog-derived paths.
