# Screen DSL Create Mode

Date: 2026-06-25

Create mode imports new screens from a Screen DSL document. It never matches by
screen name or title and never mutates existing screens.

Preview resolves the document into Screen Interchange, computes semantic create
operations against an empty scoped base, validates pixel budgets and checks the
full project for collisions. Apply is allowed only when every imported screen ID
is absent from the project and every same-ID resource has identical canonical
content.

Apply maps to one `screen.dsl.apply` command inside one `ProjectChangeSet`.
Undo removes the created screen aggregate. Redo restores the same screen and
object IDs.

Deferred outside the application slice:

- Screen Schema Studio UI controls;
- Electron file import/export;
- explicit FSM link creation policy;
- global shared resource creation commands.
