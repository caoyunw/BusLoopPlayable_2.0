# Task Plan

## Current Goal

Design and plan `linked-passengers` as the next mechanic. The design is approved; the written spec is awaiting final user review before implementation planning.

## Completed Gates

- Registry baseline: 17 definitions, 3 playable (`base`, `star-passenger`, `question-passenger`), 14 planned.
- Focused question-passenger suite: 36/36 passed; focused question/registry gate: 69/69 passed; full `pnpm test`: 142/142 passed.
- `pnpm run build` passed with only the existing non-blocking chunk-size warning.
- Browser QA passed at desktop 1280x720 and mobile 390x844 with real controls and no horizontal overflow.
- A live forced reduced-motion branch passed without transform motion; native in-app browser media emulation was unavailable and is not claimed.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture fallback gaps remain documented in `findings.md`.

## Next Steps

1. User reviews `docs/superpowers/specs/2026-07-13-linked-passengers-design.md`.
2. Write and commit the detailed implementation plan.
3. Execute with TDD while the registry entry remains `planned`.

## Context Pointers

- Current status: `docs/project/playable-project-progress.md`
- Code map: `docs/project/code-navigation.md`
- Durable findings: `findings.md`
- Handoff: `progress.md`
