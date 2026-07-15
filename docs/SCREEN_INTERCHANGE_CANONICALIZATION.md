# Screen Interchange Canonicalization

Screen Interchange V1 has deterministic serialization for package comparison
and fingerprints.

## Rules

- Object keys are sorted recursively.
- Array order is preserved.
- `undefined` fields are omitted.
- Output JSON ends with one newline.
- Fingerprints use a deterministic `simv1-<hex>` prefix.

The canonical form is independent of JavaScript object insertion order for
resource maps, while preserving screen order and object order as authoring
data.

The fingerprint is a package identity signal, not a cryptographic security
primitive.
