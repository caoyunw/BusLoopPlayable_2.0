# Progress

## Handoff - 2026-07-13

`linked-passengers` is complete and playable. The lab now contains 17 definitions: 5 playable (`base`, `garage`, `star-passenger`, `question-passenger`, `linked-passengers`) and 12 planned.

## Completed Areas

- The isolated linked module owns chance/authored chain planning, page-session controls, runtime batch policy, and level18 authored starts (12 chains/66 rows).
- Generic batch hooks keep chains atomic across visible-queue admission, belt entry/ring wrap, and vehicle boarding, including composite-runtime forwarding and scalar fallback.
- Scene feedback provides segmented connectors, head `xN`, and one aggregate 250 ms boarding event with reduced-motion-safe behavior.

## Verification

- Linked plus shared-architecture tests pass 34/34. Full `pnpm test` runs 155 tests: 148 pass and 7 retain the user-approved question/garage/registry baseline failures; no linked test fails.
- Production build and advertising packaging were intentionally skipped because they are outside the mechanic-lab gate.
- Desktop 1280x720 and mobile 390x844 QA passed with session settings, zero mobile horizontal overflow, authored/chance modes, readable connectors and `x10`, and no error-level logs.
- Capacity-pressure play confirmed a 10-row chain stays whole with only 4 seats remaining, then boards and departs whole with a 40-seat vehicle. No orphan connector remained.
- A temporary exact source override exercised the reduced-motion branch and was restored cleanly; feedback stayed in place and triggered one pulse/smoke/audio event. Existing FBXLoader warnings remain non-blocking.

## Current State And Next Action

- Linked chance defaults to 30% with maximum length 10; authored mode reports 12 chains covering 66 rows. Options survive mechanic switching and reset on refresh.
- The next goal requires the user to select one of the 12 planned mechanics. No priority has been assigned.
