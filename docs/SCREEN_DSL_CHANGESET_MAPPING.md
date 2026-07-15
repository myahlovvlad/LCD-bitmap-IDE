# Screen DSL ChangeSet Mapping

Update-mode DSL candidates map to existing typed commands:

- screen name change -> `screen.rename`
- screen dimension change -> `screen.resize`
- object create/update/delete/reorder -> `canvas.objects.update`

This intentionally avoids project snapshot replacement and direct Zustand
mutation. The mapping runs through `ProjectChangeSet` and `executeProjectChangeSet`.

Create and clone modes map to one `screen.dsl.apply` project command. That
command reconstructs screens from the Screen Interchange package and inserts
only screens that are not already present in the project. Create mode preserves
incoming IDs. Clone mode receives the preview-rewritten package, so screen,
object and resource IDs are already deterministic and collision-free before
mutation.

Resource collisions are not silently overwritten. Same-ID resources are allowed
only when their canonical content is identical; otherwise Apply is blocked with
`SCREEN_DSL_RESOURCE_ID_CONFLICT`.
