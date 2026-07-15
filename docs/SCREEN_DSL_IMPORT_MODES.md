# Screen DSL Import Modes

The V1 application facade supports three import modes:

- `create`: add new screens; existing project screens are not changed.
- `update`: update only listed screens; a target screen object list is complete
  state, so missing existing objects are proposed deletes.
- `clone`: use source IDs as origin trace and create new committed IDs.

All modes run through Preview first. Preview is read-only and computes semantic
diff, deterministic identity plan, dry-run status and raster summary. Apply is
explicit and bound to the preview revision/source fingerprint.

Create mode fails if any imported screen ID already exists. Clone mode rewrites
the package using the identity plan before diffing and applying, so it can import
a copy of an existing screen without mutating the original.
