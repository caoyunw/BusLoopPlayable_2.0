# Task Plan

## Current Goal

Implement `linked-passengers` as the next mechanic from the approved design and committed TDD execution plan. Keep its registry entry `planned` until focused tests, the full suite, build, desktop/mobile browser QA, and reduced-motion QA pass.

## Completed Gates

- Registry baseline: 17 definitions, 3 playable (`base`, `star-passenger`, `question-passenger`), 14 planned.
- Focused question-passenger suite: 36/36 passed; focused question/registry gate: 69/69 passed; full `pnpm test`: 142/142 passed.
- `pnpm run build` passed with only the existing non-blocking chunk-size warning.
- Browser QA passed at desktop 1280x720 and mobile 390x844 with real controls and no horizontal overflow.
- A live forced reduced-motion branch passed without transform motion; native in-app browser media emulation was unavailable and is not claimed.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture fallback gaps remain documented in `findings.md`.

## Next Steps

1. Execute `docs/superpowers/plans/2026-07-13-linked-passengers.md` task by task with TDD.
2. Run the full automated/build gate, then desktop 1280x720, mobile 390x844, and live reduced-motion browser QA.
3. Mark the mechanic playable and update durable project status only after every gate passes.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
