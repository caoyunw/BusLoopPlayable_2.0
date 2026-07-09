# Task Plan

## Current Goal

Stabilize the imported level12-style BusLoop playable as the AppLovin baseline before platform packaging.

## Current Phase

Post-import stabilization and visual/playability parity review.

## Next Steps

1. Re-run full `node --test` when the environment allows Node child-process spawning reliably.
2. Investigate existing blocker expectation failures around querying blockers while a vehicle is colliding.
3. Manually compare current level12 gameplay, passenger entry, effects, audio timing, fake shadows, and material colors against Unity reference.
4. Tune visuals/audio/effects only after manual comparison identifies concrete gaps.
5. Resume platform packaging after AppLovin baseline behavior is accepted.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Resource status: `docs/project/playable-resource-status.md`
