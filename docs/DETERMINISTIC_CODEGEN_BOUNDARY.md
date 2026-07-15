# Deterministic Codegen Boundary

Phase 2B defines code generation as a compiler artifact boundary, not a renderer
utility call.

## Boundary

```text
CompilerSourceSnapshot
-> NormalizedCompilerIrV1
-> LoweredTargetIrV1
-> CodegenBackend
-> CodegenArtifactSet
```

The renderer may request exports through `src/application/codegenFacade.ts`, but
it does not format C arrays or concatenate binary screen payloads.

## Legacy Target

The first target profile is `legacy-lcd-vertical-lsb`:

- monochrome 128x64 display
- vertical page packing with LSB at the top
- 16 C bytes per row
- historical all-screen table byte length of 1024
- current symbol sanitization without collision de-duplication

These rules are compatibility policy, not recommended future device-pack
behavior.

## Artifacts

Backends return `CodegenArtifactSet` with:

- artifact kind, path, media type, byte length and content
- SHA-256 digest for every artifact
- manifest with backend id, target profile id and source fingerprint

## Verification

`tests/utils/deterministicCodegenBoundary.test.ts` compares compiler-generated
artifacts with the legacy renderer generator byte-for-byte. The dedicated gates
are:

- `npm run test:codegen-equivalence`
- `npm run test:compile-fixtures`
- `npm run test:compiler`

Phase 2B is allowed to switch production export buttons only while these
equivalence tests pass.
