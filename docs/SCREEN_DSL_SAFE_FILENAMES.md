# Screen DSL Safe Filenames

Date: 2026-06-25

`createSafeScreenDslFilename()` and
`createSafeScreenDslProjectFilename()` generate deterministic export names.

Policy:

- preserve safe Unicode;
- strip path prefixes and traversal;
- remove `< > : " / \ | ? *` and ASCII control characters;
- trim trailing spaces and dots;
- cap stems at 128 characters;
- fallback to `screen`;
- protect Windows reserved names including `CON`, `PRN`, `AUX`, `NUL`,
  `CLOCK$`, `COM1`-`COM9` and `LPT1`-`LPT9`;
- append `.lcdscreen.yaml` or `.lcdscreen.json` exactly once.

The main process sanitizes suggested filenames again before opening the save
dialog because renderer input is untrusted.
