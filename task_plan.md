# Task Plan

## Current Goal

Validate the newly implemented `garage` mechanic against the active level18 garage-container configuration, then continue to `question-passenger` while preserving the verified star-passenger baseline.

## Current Phase

The stabilized foundation is complete:

- Mechanic registry and searchable library are present.
- Desktop three-column and mobile drawer layouts are present.
- The registry contains 17 mechanism definitions: 3 playable (`base`, `garage`, `star-passenger`) and 14 planned.
- URL selection, planned-mechanic input freeze, persistent scene editor, safe tuning storage, neutral runtime assets, and advertising cleanup are in place.
- Star-passenger feedback is complete and has passed desktop, 390x844 mobile, and reduced-motion browser QA.
- Garage hidden stock, one-at-a-time release, counter timing, Unity model rendering path, and runtime smoke are implemented.
- The active level has been replaced with level18 data: 47 vehicles, two fixed queues of 115 and 191 groups, 42 blocker entries from the supplied CSV, and two garage containers with 16 stocked garage vehicles.
- The 2026-07-12 full `pnpm test` and `pnpm run build` baseline passed. Current sandboxed `pnpm test` and `pnpm run build` are blocked by Windows `spawn EPERM`.

The next immediate phase is garage QA on level18. After that, continue to `question-passenger`. The star-passenger design and implementation plans remain completed references.

## Implementation Priority

Advance `question-passenger` through the mechanic workflow:

1. Define the hidden-color and reveal rules, player-facing feedback, and acceptance criteria.
2. Keep the registry entry `planned` while implementing the rule in its own mechanic module.
3. Add focused model, runtime, registry, and UI tests before changing shared hooks.
4. Verify desktop, 390x844 mobile, and reduced-motion behavior before marking the mechanic `playable`.

## Verification Gate

- Focused `question-passenger` tests pass.
- The full suite preserves the 88/88 baseline or increases it with new passing tests.
- `pnpm run build` passes outside the current sandbox limitation; current sandboxed runs hit Windows `spawn EPERM`.
- Browser QA covers desktop, 390x844 mobile, and reduced-motion behavior for `question-passenger`.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Base gameplay facts: `docs/project/playable-core-rules.md`
- Resource provenance: `docs/project/playable-resource-status.md`
- Completed star-passenger design: `docs/superpowers/specs/2026-07-10-star-passenger-feedback-design.md`
- Completed star-passenger implementation plan: `docs/superpowers/plans/2026-07-10-star-passenger-feedback.md`
