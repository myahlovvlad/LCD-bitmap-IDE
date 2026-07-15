# Screen DSL File IPC

Date: 2026-06-25

Screen DSL file IPC is intentionally feature-specific.

Channels:

- `screen-dsl:file:open`;
- `screen-dsl:file:save`.

Preload API:

```ts
window.spectroDesigner.screenDslFiles.open()
window.spectroDesigner.screenDslFiles.save(request)
```

The renderer cannot pass a channel name, final absolute path, file descriptor,
Node Buffer or callback. Save requests contain only:

- `format`;
- `operation`;
- `suggestedFilename`;
- `content`.

The main process performs runtime validation and returns serializable result
objects with basename-only filenames.
