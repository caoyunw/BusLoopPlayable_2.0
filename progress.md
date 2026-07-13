# Progress

## Handoff - 2026-07-13

<<<<<<< Updated upstream
`question-passenger` is complete and activated in the cohesive `feat: complete question passenger mechanic` commit. The lab now contains 17 definitions: 3 playable (`base`, `star-passenger`, `question-passenger`) and 14 planned.
=======
The BusLoop mechanic lab now has a clean verified baseline from 2026-07-12 plus garage, level18, and valve work from 2026-07-13. The registry contains 17 mechanism definitions: 4 playable (`base`, `garage`, `star-passenger`, `valve`) and 13 planned.
>>>>>>> Stashed changes

## Completed Areas

<<<<<<< Updated upstream
- The isolated question module owns chance/authored assignment, hidden/reveal state, persistence-free detail controls, neutral queue visuals, four-person badges, and one-shot belt feedback.
- Final activation changed the question definition to `playable` and added regressions for playable resolution, 17/3/14 registry totals, active startup, authored 132/438 reconfiguration, exact one-reset behavior, and fixed mask snapshots.
- Durable status, code navigation, gameplay decisions, resource gaps, and next-action documents are synchronized.

## Verification

- Preactivation gate while planned: question 32/32, focused game/registry 11/11, and five syntax checks passed.
- Activation tests were observed RED for planned-status fallback, then GREEN after the status-only production change.
- Post-review focused question/registry gate passed 69/69 and full `pnpm test` passed 142/142; `pnpm run build` and `git diff --check` passed with only the known chunk-size warning.
- Final review added regression coverage for reset rerolls, true-color preservation, boarding/departure, win/fail invariance, and authored-mask overflow; overflow is now ignored by both assignment and summary counts.
- Browser QA passed at 1280x720 and 390x844 with real mode/range/reset/library/editor/drawer controls, no horizontal overflow, readable gray/badged queues, real-color belt passengers, rerolls, authored fixed positions, and more than five one-shot reveals.
- Native reduced-motion emulation was unavailable in the in-app browser. A temporary exact substitution forced the live branch; color/brightness/fade remained clear, transforms stayed fixed, inputs worked, and the source was reverted cleanly.
- Error-level logs and page errors were absent. Existing FBXLoader warnings and four Unity texture HTML-fallback references remain documented rather than treated as network-clean.
=======
- `d341317`: added the mechanic registry and URL selection helpers.
- `0bfea8d`: added the mechanic library shell, desktop grid, and mobile drawer.
- `3d5f30c` / `7d63e83`: hardened library interaction, grouping, focus, cleanup, and tests.
- `864a4d1`: converted the runtime assembly to the mechanic lab.
- `a6227df`: preserved authored scene defaults and made tuning reset/storage safer.
- `8f78492`: removed advertising delivery scripts/artifacts and migrated active web assets to neutral runtime paths.
- `4d364ab`: clarified historical docs, fixed mobile drawer startup, and added a favicon data URL to avoid the default 404.
- `6daf9c1` through `5ce51da`: implemented and stabilized the star-passenger lifetime, `-1` feedback, cyclic charge, and celebration.
- `fe47753`: made star badges and decrement feedback respect reduced-motion preferences and added coverage.
- Panel update: added six more planned mechanisms: train, locked garage, count garage, rotating spots, double gate, and maglev spot.

## Current Runtime State

- `base` is playable against the imported level18 layout: 47 vehicles, two queues of 115 and 191 groups, 42 CSV-authored blocker entries, and initial movable vehicles `30, 31, 32, 56, 58`.
- `garage` is playable for levels that provide garage containers and matching vehicle `containerType/containerId` data. It hides stocked vehicles, releases one at a time without treating ordinary `vehicleDepthes` as garage spawn blockers, uses Unity `BusObject`/`ParkPos` anchors for drive-out positions, decrements the visible count when release starts, hides the garage model when that count reaches `0`, and renders the Unity truck/garage model with the Truck body and metal matcap materials. Garage containers are now also auto-enabled as a level feature in the default `base` runtime.
- `count-garage` is playable as a dispatch-count-gated garage variant: garage id `1` unlocks after 10 successful vehicle dispatches, garage id `2` unlocks after 20, locked labels show remaining unlock count, and unlocked garages release through the existing one-at-a-time garage flow.
- `star-passenger` is playable with the completed 3/2/1 badge, one `-1` per exit crossing, cyclic 0/20 charge, 20/20 celebration, and third-pass reward expiration.
- `valve` is playable with automatic left/right side gating. Initial conveyor fill lets both side queues enter normally; after that, the open side feeds only its current queue-head color run into the conveyor, then switches to the other side. Scene markers show open/closed state at both entry points.
- Thirteen proposed mechanisms remain `planned`; they display complete metadata but do not receive gameplay input.
- Desktop uses a three-column lab layout. Narrow screens use mechanism and editor drawers.
- `?mechanic=<id>` selects a mechanism and safely falls back to `base`.
- The scene editor is always available, defaults to collapsed, and stores local overrides separately from mechanism selection.
- Advertising packaging, CTA/store routing, install gates, and platform-specific runtime assets are no longer active.

## Verification

- `pnpm test`: 88/88 passed.
- `pnpm run build`: passed with the existing non-blocking chunk-size warning.
- Edge browser QA passed on desktop, 390x844 mobile, and reduced-motion settings, including `20/20 -> 0/20 -> 1/20`, pointer interaction, and error checks.
- Repository hygiene excludes dependency caches, accidental system files, and transient logs from project sources.
- 2026-07-13 garage syntax checks, direct `node test/garage-mechanic.test.js` 5/5, direct `node test/game-model.test.js` 32/32, local browser visual check, and in-process runtime smoke passed.
- 2026-07-13 level18 checks passed: `node --check src/level-data.js`, `node --check src/game-model.js`, `node --check src/mechanics/index.js`, `node --check test/game-model.test.js`, direct `node test/game-model.test.js` 32/32, `node test/garage-mechanic.test.js` 5/5, `node test/mechanic-registry.test.js` 23/23, and a default-base level18 smoke confirming garage stock is `in-garage`. Sandboxed `node --test`, `pnpm test`, and `pnpm run build` are still limited by Windows `spawn EPERM`.
- 2026-07-13 garage blocker semantics fix passed direct `node test/garage-mechanic.test.js` 6/6, direct `node test/game-model.test.js` 32/32, elevated `pnpm test` 94/94, and elevated `pnpm run build` with the existing chunk-size warning. The level18 smoke confirms first garage vehicles `38` and `60` auto-release on entry.
- 2026-07-13 garage Unity position parity fix passed direct `node test/garage-mechanic.test.js` 7/7, direct `node test/game-model.test.js` 32/32, elevated `pnpm test` 95/95, and elevated `pnpm run build` with the existing chunk-size warning.
- 2026-07-13 garage empty-hide fix passed direct `node test/garage-mechanic.test.js` 7/7, direct `node test/game-model.test.js` 32/32, elevated `pnpm test` 95/95, and elevated `pnpm run build` with the existing chunk-size warning.
- 2026-07-13 valve checks passed: `node --check` for touched valve/runtime/render/test files, direct `node test/valve-mechanic.test.js` 4/4, direct `node test/mechanic-registry.test.js` 23/23, direct `node test/mechanic-architecture.test.js` 3/3, and direct `node test/game-model.test.js` 32/32.
- 2026-07-13 valve full verification passed: elevated `pnpm test` 99/99, elevated `pnpm run build` with the existing chunk-size warning, and browser QA on desktop plus 390x844 mobile with visible valve markers and no console errors.
- 2026-07-13 valve initial-fill rule update passed focused verification: `node --check src/mechanics/valve/model.js` and direct `node test/valve-mechanic.test.js` 5/5. Full suite and build were intentionally not rerun under the focused-check preference.
- 2026-07-13 order-passenger implementation passed focused verification: `node --check` for touched order/runtime/registry files, direct `node test/order-passenger-mechanic.test.js` 4/4, and direct `node test/mechanic-registry.test.js` 33/33. Browser QA passed on desktop 1280x900 and mobile 390x844 with the order HUD showing red/yellow/brown counts `184/224/176`, nonblank canvas, and no console errors. Full suite and build were intentionally not run under the focused-check preference.
- 2026-07-13 count-garage implementation passed focused verification: `node --check` for touched count-garage/garage/runtime files, direct `node test/count-garage-mechanic.test.js` 1/1, direct `node test/garage-mechanic.test.js` 7/7, and direct `node test/mechanic-registry.test.js` 33/33. Full suite and build were intentionally not run under the focused-check preference.
>>>>>>> Stashed changes

## Current State And Next Action

<<<<<<< Updated upstream
- Chance defaults to 30%; authored mode uses 132/438 fixed marks. Page-session options survive mechanic switching and reset on refresh.
- The next goal requires the user to select one of the 14 planned mechanics. No priority has been assigned.
=======
Continue with the next mechanic priority. The [star-passenger design](docs/superpowers/specs/2026-07-10-star-passenger-feedback-design.md) and [implementation plan](docs/superpowers/plans/2026-07-10-star-passenger-feedback.md) are completed references.

## Garage Research Note - 2026-07-13

Unity garage behavior was extracted from the source prefab and scripts for future implementation. The key rule is hidden vehicle stock with one-at-a-time release when the door/front is clear, immediate counter decrement for the currently exiting vehicle, and final garage hide after the last released vehicle leaves. Detailed notes are in [2026-07-13-garage-unity-extraction.md](docs/superpowers/specs/2026-07-13-garage-unity-extraction.md).

## Browser QA Notes

Star-passenger feedback passed Edge QA on desktop, 390x844 mobile, and reduced-motion settings. The run confirmed readable 3/2/1 and `-1` feedback, the `20/20 -> 0/20 -> 1/20` cycle, pointer interaction during celebration, stable layout, and no console, page, or network errors.

## Historical Note

The older 2026-07-07 and 2026-07-08 playable-ad work remains preserved in project archives and the historical section of `docs/project/playable-project-progress.md`; it is not the current workflow.
>>>>>>> Stashed changes
