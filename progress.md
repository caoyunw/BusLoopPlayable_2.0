# Progress

## Handoff - 2026-07-13

`linked-passengers` is complete and playable. The lab now contains 18 definitions: 11 playable (`base`, `garage`, `star-passenger`, `question-passenger`, `linked-passengers`, `valve`, `order-passenger`, `count-garage`, `upgrade-spot`, `double-gate`, `maglev-spot`) and 7 planned.

## Completed Areas

- The isolated linked module owns chance/authored chain planning, page-session controls, runtime batch policy, and level18 authored starts.
- The question module owns chance/authored assignment, hidden/reveal state, persistence-free detail controls, neutral queue visuals, and one-shot belt feedback.

## Verification

- Focused checks: linked-passenger focused tests passed; question-passenger, garage, valve, order-passenger, and count-garage passed their focused gates. Full `pnpm test` and `pnpm run build` are only executed when explicitly requested; focused verification is the default.

## Completed Areas

- Completed areas include question-passenger activation, linked-passenger activation, and focused garage/valve/count-garage implementations. Desktop and mobile QA were exercised for these mechanics; no error-level logs were observed in focused browser runs.

## Current State And Next Action

- Chance defaults to 30%; authored mode uses fixed marks where configured. The next goal is to select one of the remaining planned mechanics and advance it through the mechanic workflow.

## Capacity Mechanics Update - 2026-07-14

- `upgrade-spot` is playable as a first-spot capacity upgrade: vehicles assigned to spot `0` use double effective passenger-group capacity, while original vehicle model sizing remains unchanged.
- `double-gate` is playable as a first-spot boarding-cost rule: vehicle capacity stays unchanged, but each boarded group consumes two capacity groups, so a 10-seat vehicle can board 5 groups there.
- The scene now distinguishes the two mechanisms: upgrade spot shows a cyan ring, upward marker, and `UP`; double gate shows orange/red gate posts, doors, and `x2`.
- Focused verification passed: syntax checks for touched runtime/view files, `node test/capacity-mechanics.test.js` 4/4, `node test/mechanic-registry.test.js` 33/33, and elevated narrow `node --test` seat-count-board contract 1/1.
- Browser QA passed on desktop and 390x844 mobile for both mechanisms with selected playable cards, nonblank canvas, visible first-spot markers, collapsed mobile drawer, hidden planned overlay, and no page error logs.

## Maglev Spot Update - 2026-07-14

- `maglev-spot` is playable as a map-space raised/lowered vehicle mechanic.
- Vehicles `28`, `35`, `33`, `50`, `39`, `58`, `41`, and `52` are on maglev spots. Vehicles `31` and `48` are ordinary vehicles.
- Every successful dispatch toggles the maglev spots between lowered and raised. Raised maglev vehicles do not block ground vehicles and cannot be dispatched.
- The scene renders compact square maglev spot markers. A marker hides as soon as its vehicle starts moving to a parking spot.
- Focused verification passed: `node --check src/scene-view.js`, `node --check test/maglev-spot-mechanic.test.js`, and `node test/maglev-spot-mechanic.test.js` 4/4.

## Garage Research Note - 2026-07-13

- Chance defaults to 30%; authored mode uses the configured authored marks. Continue with the next mechanic priority; star-passenger design and implementation plans remain completed references. Garage research notes and browser QA notes are recorded in the docs where relevant.
