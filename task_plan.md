# Task Plan

## Current Goal

Use the completed BusLoop mechanic-lab shell to implement and validate mechanisms one at a time without regressing the playable base rules.

## Current Phase

The foundation is complete:

- Mechanic registry and searchable library are present.
- Desktop three-column and mobile drawer layouts are present.
- `base` is playable; ten mechanism presets are registered as `planned`.
- URL selection, planned-mechanic input freeze, persistent scene editor, safe tuning storage, neutral runtime assets, and advertising cleanup are in place.

The next phase is mechanism implementation, not more shell or platform packaging work.

## Implementation Priority

1. `question-vehicle` (问号车): define reveal timing and visual state, then implement a focused playable scenario.
2. `garage` (车库): define queued vehicle ownership, spawn timing, and exit blocking.
3. `question-passenger` (问号乘客): define hidden/revealed queue information and conveyor reveal behavior.
4. `elevator-bay` (升降舱): define bay occupancy, door state, and batch release.
5. Implement the remaining six presets after the first four establish reusable mechanism module contracts.

For each mechanism: confirm rules, keep it `planned`, implement in an isolated module, add tests, perform desktop/mobile browser QA, then change it to `playable`.

## Existing Test Debt

Full baseline on 2026-07-09 is 66/73 passing. These seven failures already existed before the documentation handoff:

1. `Unity visual assets and tunable camera configuration are complete`
2. `editor sizing, source background ratio, and passenger shadow anchor stay wired`
3. `dispatch reserves the first spot and unlocks cars behind it`
4. `blocked click uses Unity collision advance, contact hit, and return phases`
5. `station approach follows the Unity parking-area rectangle before entering the spot`
6. `vehicle path preview and shape controls are wired to scene tuning`
7. `level12 initial movable cars reserve the first parking spots`

Do not hide these failures or report the full suite as green. Compare names and assertions when evaluating whether a future mechanism change adds a regression.

## Verification Gate

- Focused mechanism tests pass.
- Full suite introduces no failures beyond the recorded seven.
- `npm run build` passes.
- Browser QA covers desktop three-column layout, mobile drawers, nonblank canvas, selection/URL state, planned overlay/input freeze, editor controls, and console errors.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Base gameplay facts: `docs/project/playable-core-rules.md`
- Resource provenance: `docs/project/playable-resource-status.md`
