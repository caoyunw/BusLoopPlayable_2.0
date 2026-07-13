# Task Plan

## Current Goal

Continue with the next mechanic priority while preserving the verified star-passenger, garage, and valve baselines.

## Completed Gates

- Registry baseline: 17 definitions, 3 playable (`base`, `star-passenger`, `question-passenger`), 14 planned.
- Focused question-passenger suite: 36/36 passed; focused question/registry gate: 69/69 passed; full `pnpm test`: 142/142 passed.
- `pnpm run build` passed with only the existing non-blocking chunk-size warning.
- Browser QA passed at desktop 1280x720 and mobile 390x844 with real controls and no horizontal overflow.
- A live forced reduced-motion branch passed without transform motion; native in-app browser media emulation was unavailable and is not claimed.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture fallback gaps remain documented in `findings.md`.

- Mechanic registry and searchable library are present.
- Desktop three-column and mobile drawer layouts are present.
- The registry contains 17 mechanism definitions: 4 playable (`base`, `garage`, `star-passenger`, `valve`) and 13 planned.
- URL selection, planned-mechanic input freeze, persistent scene editor, safe tuning storage, neutral runtime assets, and advertising cleanup are in place.
- Star-passenger feedback is complete and has passed desktop, 390x844 mobile, and reduced-motion browser QA.
- Garage hidden stock, one-at-a-time release, counter timing, Unity model rendering path, and runtime smoke are implemented.
- Valve side gating is implemented and browser-verified: initial conveyor fill lets both side queues enter normally; after that, the open side feeds only its current queue-head color run into the conveyor, then automatically switches to the other side.
- Order-passenger is implemented and browser-verified: the level goal is red/yellow/brown order completion, the top HUD shows remaining passenger counts using group count x 4, and level18 currently shows `184/224/176`.
- Count-garage is implemented with dispatch-count unlocks: garage id `1` unlocks after 10 successful vehicle dispatches and garage id `2` unlocks after 20, then both reuse the existing garage one-at-a-time release flow.
- The active level has been replaced with level18 data: 47 vehicles, two fixed queues of 115 and 191 groups, 42 blocker entries from the supplied CSV, and two garage containers with 16 stocked garage vehicles.
- The 2026-07-12 full `pnpm test` and `pnpm run build` baseline passed. Current sandboxed `pnpm test` and `pnpm run build` are blocked by Windows `spawn EPERM`.

The next immediate phase is to choose and advance the next mechanic priority. The star-passenger design and implementation plans remain completed references.

## Implementation Priority

Advance the next selected mechanic through the mechanic workflow:

1. Define the rule and player-facing feedback.
2. Keep the registry entry `planned` until gameplay, focused tests, and browser QA are complete.
3. Add focused model, runtime, registry, and UI/render tests before changing shared hooks.
4. Verify desktop, 390x844 mobile, reset, mechanic switching, planned-mechanic recovery, and console errors before marking it `playable`.

## Verification Gate

- Focused tests for the next selected mechanic pass.
- Use narrow focused tests by default. Full `pnpm test` and `pnpm run build` should only run when explicitly requested.
- Browser QA covers desktop and 390x844 mobile behavior for the next selected mechanic.
- 2026-07-13 order-passenger focused gate passed: `node --check` for touched order/runtime/registry files, direct `node test/order-passenger-mechanic.test.js` 4/4, direct `node test/mechanic-registry.test.js` 33/33, and desktop/mobile browser QA with no console errors.
- 2026-07-13 count-garage focused gate passed: `node --check` for touched count-garage/garage/runtime files, direct `node test/count-garage-mechanic.test.js` 1/1, direct `node test/garage-mechanic.test.js` 7/7, and direct `node test/mechanic-registry.test.js` 33/33.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
