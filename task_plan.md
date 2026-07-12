# Task Plan

## Current Goal

Plan and implement `question-passenger` as the next mechanic while preserving the verified star-passenger baseline.

## Current Phase

The stabilized foundation is complete:

- Mechanic registry and searchable library are present.
- Desktop three-column and mobile drawer layouts are present.
- The registry contains 17 mechanism definitions: 2 playable (`base`, `star-passenger`) and 15 planned.
- URL selection, planned-mechanic input freeze, persistent scene editor, safe tuning storage, neutral runtime assets, and advertising cleanup are in place.
- Star-passenger feedback is complete and has passed desktop, 390x844 mobile, and reduced-motion browser QA.
- Full `pnpm test` passes 88/88.
- `pnpm run build` passes with the existing non-blocking chunk-size warning.

The next phase is `question-passenger`. The star-passenger design and implementation plans remain completed references.

## Implementation Priority

Advance `question-passenger` through the mechanic workflow:

1. Define the hidden-color and reveal rules, player-facing feedback, and acceptance criteria.
2. Keep the registry entry `planned` while implementing the rule in its own mechanic module.
3. Add focused model, runtime, registry, and UI tests before changing shared hooks.
4. Verify desktop, 390x844 mobile, and reduced-motion behavior before marking the mechanic `playable`.

## Verification Gate

- Focused `question-passenger` tests pass.
- The full suite preserves the 88/88 baseline or increases it with new passing tests.
- `pnpm run build` passes with only the existing non-blocking chunk-size warning.
- Browser QA covers desktop, 390x844 mobile, and reduced-motion behavior for `question-passenger`.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Base gameplay facts: `docs/project/playable-core-rules.md`
- Resource provenance: `docs/project/playable-resource-status.md`
- Completed star-passenger design: `docs/superpowers/specs/2026-07-10-star-passenger-feedback-design.md`
- Completed star-passenger implementation plan: `docs/superpowers/plans/2026-07-10-star-passenger-feedback.md`
