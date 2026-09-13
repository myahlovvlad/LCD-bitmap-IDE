# Green Baseline Restoration Plan

**Goal:** Restore a fully green unit-test baseline after introducing the versioned DisplayProfile model and complete Settings localization.

## Task 1: Localize Settings completely

- Add RU/EN/ZH labels for every DisplayProfile control, action, notification, and evidence result.
- Replace raw user-facing strings in `SettingsWorkspace.tsx` with localized labels.
- Run the GUI localization coverage test.

## Task 2: Align the resize contract with DisplayProfile

- Keep the application limit of 16…4096 pixels used by the new generic display profile.
- Update the obsolete legacy assertion to check canonical DisplayProfile fields and resized screens.
- Run the project mutation test.

## Task 3: Restore SpectroDesigner v4 compatibility

- Add a strict Zod schema for the canonical DisplayProfile.
- Accept either the legacy display config or canonical DisplayProfile in v4 project payloads.
- Run schema and project-interoperability tests.

## Task 4: Reject unsupported display packing at the trust boundary

- Make `validateDisplayProfile` report unsupported enum values before semantic compatibility checks.
- Preserve existing diagnostics for dimensions, fingerprints, and packing/format combinations.
- Run DisplayProfile and Screen Interchange security tests.

## Task 5: Verify the baseline

- Run the four formerly failing tests together.
- Run the complete Vitest suite, type checks, and diff hygiene checks.
