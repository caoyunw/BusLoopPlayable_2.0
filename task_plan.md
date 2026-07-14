# Task Plan

## Current Goal

`linked-passengers` is complete and playable. The next goal is to select one of the remaining planned mechanics and define its rules and acceptance gate while preserving the verified star-passenger, garage, and valve baselines.

## Completed Gates

- The registry contains 17 definitions: 8 playable and 9 planned.
- Linked passengers support independent chance and authored modes, page-session controls, and atomic queue admission, belt entry/wrap, and boarding.

## Implementation Priority

1. Define rules, player-facing feedback, and acceptance criteria for the selected mechanic.
2. Keep the registry entry `planned` while implementing the mechanic module and add focused model, runtime, registry, and UI tests.
3. Verify desktop, 390x844 mobile, and reduced-motion behavior before marking `playable`.

## Verification Gate

- Focused tests for the selected mechanic pass without adding failures beyond documented baseline exceptions. Full-suite and build runs should only be requested explicitly.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
