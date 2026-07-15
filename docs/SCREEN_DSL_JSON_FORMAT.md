# Screen DSL JSON Format

Screen DSL JSON V1 uses the same semantic contract as YAML V1:
`format = lcd-bitmap-ide/screen`, `version = 1`, `layoutMode = explicit`.

Canonical JSON is emitted by `writeCanonicalScreenDslJson()`. It is stable,
deterministic and intended for machine comparison. Comments are not supported
in JSON and are not preserved.

Parser restrictions:

- duplicate keys are rejected before `JSON.parse`;
- `__proto__`, `prototype` and `constructor` keys are rejected;
- oversized sources are rejected;
- expressions are plain strings and are not executed.

JSON is the preferred format for automated tests and deterministic fixtures.
