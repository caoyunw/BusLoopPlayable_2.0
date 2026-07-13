# Progress

## Handoff - 2026-07-13

`question-passenger` is complete and activated in the cohesive `feat: complete question passenger mechanic` commit. The lab now contains 17 definitions: 3 playable (`base`, `star-passenger`, `question-passenger`) and 14 planned.

## Completed Areas

- The isolated question module owns chance/authored assignment, hidden/reveal state, persistence-free detail controls, neutral queue visuals, four-person badges, and one-shot belt feedback.
- Final activation changed the question definition to `playable` and added regressions for playable resolution, 17/3/14 registry totals, active startup, authored 132/438 reconfiguration, exact one-reset behavior, and fixed mask snapshots.
- Durable status, code navigation, gameplay decisions, resource gaps, and next-action documents are synchronized.

## Verification

- Preactivation gate while planned: question 32/32, focused game/registry 11/11, and five syntax checks passed.
- Activation tests were observed RED for planned-status fallback, then GREEN after the status-only production change.
- Final focused question/registry gate, full `pnpm test` 138/138, `pnpm run build`, and `git diff --check` passed; build emitted only the known chunk-size warning.
- Browser QA passed at 1280x720 and 390x844 with real mode/range/reset/library/editor/drawer controls, no horizontal overflow, readable gray/badged queues, real-color belt passengers, rerolls, authored fixed positions, and more than five one-shot reveals.
- Native reduced-motion emulation was unavailable in the in-app browser. A temporary exact substitution forced the live branch; color/brightness/fade remained clear, transforms stayed fixed, inputs worked, and the source was reverted cleanly.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture HTML-fallback references remain documented rather than treated as network-clean.

## Current State And Next Action

- Chance defaults to 30%; authored mode uses 132/438 fixed marks. Page-session options survive mechanic switching and reset on refresh.
- The next goal requires the user to select one of the 14 planned mechanics. No priority has been assigned.
