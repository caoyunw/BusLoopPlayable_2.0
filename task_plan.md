# Task Plan

## Current Goal

Complete. `question-passenger` is implemented and activated as the third playable mechanic.

## Completed Gates

- Registry baseline: 17 definitions, 3 playable (`base`, `star-passenger`, `question-passenger`), 14 planned.
- Focused question-passenger suite: 32/32 passed; full `pnpm test`: 138/138 passed.
- `pnpm run build` passed with only the existing non-blocking chunk-size warning.
- Browser QA passed at desktop 1280x720 and mobile 390x844 with real controls and no horizontal overflow.
- A live forced reduced-motion branch passed without transform motion; native in-app browser media emulation was unavailable and is not claimed.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture fallback gaps remain documented in `findings.md`.

## Next Goal

The user must select one of the 14 planned mechanics before the next design/implementation cycle begins. No priority is currently assigned.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
