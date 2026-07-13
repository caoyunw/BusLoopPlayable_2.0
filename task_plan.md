# Task Plan

## Current Goal

`linked-passengers` is complete and playable. The next goal is to select one of the remaining 12 planned mechanics and define its rules and acceptance gate.

## Completed Gates

- The registry contains 17 definitions: 5 playable (`base`, `garage`, `star-passenger`, `question-passenger`, `linked-passengers`) and 12 planned.
- Linked passengers support independent chance and authored modes, page-session controls, and atomic queue admission, belt entry/wrap, and boarding.
- Level18 authored data defines 12 chains covering 66 rows; chance defaults to 30% and maximum length 10.
- Linked and shared-architecture tests pass 34/34. Full `pnpm test` executes 155 tests: 148 pass and the 7 user-approved question/garage/registry baseline failures remain; there are no linked regressions.
- Desktop 1280x720, mobile 390x844, capacity-pressure gameplay, session settings, visual connector/`xN`, aggregate boarding, and forced live reduced-motion QA passed with no error-level logs.
- Production build and advertising packaging are not mechanic-lab completion gates and were intentionally not run.

## Implementation Priority

After the user selects a remaining mechanic:

1. Define its rules, player-facing feedback, and acceptance criteria.
2. Keep the registry entry `planned` while implementing the rule in its own mechanic module.
3. Add focused model, runtime, registry, and UI tests before changing shared hooks.
4. Verify desktop, 390x844 mobile, and reduced-motion behavior before marking it `playable`.

## Verification Gate

- Focused tests for the selected mechanic pass without adding failures beyond the documented 7-test baseline.
- Browser QA covers desktop, 390x844 mobile, real gameplay behavior, and reduced motion.
- Do not add production build or advertising-package checks unless the project scope changes explicitly.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
