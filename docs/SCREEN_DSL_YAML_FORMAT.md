# Screen DSL YAML Format

Screen DSL YAML V1 is a restricted canonical representation, not general YAML.
It is intentionally limited to top-level Screen DSL keys with JSON-compatible
flow values for complex data.

Forbidden YAML features:

- custom tags;
- anchors;
- aliases;
- merge keys;
- multiple documents;
- nested block syntax outside the canonical writer shape.

The YAML writer emits semantically equivalent data to the JSON writer. Comments
are non-semantic and are not preserved by canonical export.
