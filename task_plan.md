# Task Plan

## Current Goal

Validate the newly implemented `garage` mechanic against the active level18 garage-container configuration, then continue to `question-passenger` while preserving the verified star-passenger baseline.

## Completed Gates

- Registry baseline: 17 definitions, 3 playable (`base`, `star-passenger`, `question-passenger`), 14 planned.
- Focused question-passenger suite: 36/36 passed; focused question/registry gate: 69/69 passed; full `pnpm test`: 142/142 passed.
- `pnpm run build` passed with only the existing non-blocking chunk-size warning.
- Browser QA passed at desktop 1280x720 and mobile 390x844 with real controls and no horizontal overflow.
- A live forced reduced-motion branch passed without transform motion; native in-app browser media emulation was unavailable and is not claimed.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture fallback gaps remain documented in `findings.md`.

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
- Handoff: `progress.md`
