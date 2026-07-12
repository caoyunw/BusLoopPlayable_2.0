# Task Plan

## Current Goal

Complete the approved star-passenger feedback plan before starting another mechanic.

## Current Phase

The stabilized foundation is complete:

- Mechanic registry and searchable library are present.
- Desktop three-column and mobile drawer layouts are present.
- The registry contains 17 mechanism definitions: 2 playable (`base`, `star-passenger`) and 15 planned.
- URL selection, planned-mechanic input freeze, persistent scene editor, safe tuning storage, neutral runtime assets, and advertising cleanup are in place.
- Full `pnpm test` passes 83/83.
- `pnpm run build` passes with the existing non-blocking chunk-size warning.

The next phase is the approved star-passenger feedback work, not another mechanic or more shell/platform packaging work.

## Implementation Priority

Execute [`docs/superpowers/plans/2026-07-10-star-passenger-feedback.md`](docs/superpowers/plans/2026-07-10-star-passenger-feedback.md):

1. Add the 3/2/1 remaining-pass badge.
2. Show one `-1` presentation per exit crossing.
3. Add cyclic 0/20 charge and a one-second completion celebration.
4. Complete desktop, mobile, and reduced-motion browser QA.

## Verification Gate

- Focused star-passenger tests pass.
- Full suite passes 83/83.
- `pnpm run build` passes with only the existing non-blocking chunk-size warning.
- Browser QA covers desktop, mobile, and reduced-motion behavior required by the execution plan.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Base gameplay facts: `docs/project/playable-core-rules.md`
- Resource provenance: `docs/project/playable-resource-status.md`
