# Screen DSL Identity Policy

Canonical export always includes stable IDs for screens, objects and resources.

V1 diffing matches existing entities by `id`. Array index and display names are
never hidden identity. Reordering an existing object is reported separately from
delete/create churn.

`localKey` is reserved for proposed new entities in later import/apply work.
The current parser does not generate committed project IDs. Preview/apply code
must allocate proposed IDs deterministically and persist those IDs only after an
explicit Apply.
