# Task Plan

## Current Goal

Bring the web vehicle dispatch/collision decision path into method-level parity with Unity while preserving the verified mechanic, garage, station, reset, and collision-feedback baselines.

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

## Active Research - Vehicle Collision Parity (2026-07-14)

- [completed] Trace the web vehicle collision and station-movement decision path from the mapped source and focused tests.
- [completed] Trace Unity `CanMoveToStation` and its direct callers/collaborators using `.cs`-only searches under `D:\UnityProjects\BusLoop`.
- [completed] Compare timing, geometry/data inputs, blocker semantics, state transitions, and edge-case handling; record method-level evidence without changing runtime code.

## Active Implementation - Unity Collision Parity (2026-07-14)

- [completed] Extract the remaining Unity code contracts for per-vehicle size, direct collision edges, container nodes, state/spot ordering, and contact geometry; map them to current web garage and model boundaries.
- [completed] Add an isolated web collision-context module that builds and maintains the Unity-style runtime graph and computes current oriented-edge contact using per-object sizes.
- [completed] Wire Unity-style dispatch gates and spot-before-collision ordering through `BusLoopGame` while retaining immediate state-based node removal when it does not change parity.
- [completed] Replace static depth-chain expectations with focused graph, size, container, target, state, ordering, reset, and existing-mechanic regression tests.
- [in_progress] Run syntax and focused tests, then verify desktop and 390x844 browser interaction/console behavior.
- [in_progress] Update code navigation, durable findings, project progress, and handoff notes.

## Active Conflict Resolution - 2026-07-14

- [completed] Locate unmerged paths and compare the upstream mechanic-destination flow with the stashed Unity collision flow.
- [completed] Preserve station-capacity ordering, collision feedback, and mechanic-owned train/tunnel destinations in one dispatch path.
- [completed] Run syntax checks and the focused collision, train, tunnel, garage, maglev, architecture, and game-model tests; confirm no conflict markers remain.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| PowerShell/`rg` rejected the literal path `test/*mechanic.test.js` | 1 | Use the `test` directory plus `--glob '*.test.js'` instead of a wildcard path. |
| Initial collision-parity test run passed 5/7: the full-station fixture left editor-configured spots free, and garage stock nodes were filtered as nonphysical during leaf traversal | 1 | Fill every runtime spot in the fixture; treat in-garage/leaving-garage positive graph nodes as blocking, matching Unity `IsLeafNode`. |
| Second collision-parity test run passed 6/7: `checkEndState()` replaced the internal `spots-full` event with the existing `lose` event | 2 | Assert the public `spots-full` result and unchanged parked state instead of pinning the later end-state event. |
| Garage door-clear test set a vehicle to `moving-to-spot` without required motion data | 1 | Use stable non-ground state `at-spot` to remove it from the collision graph without invoking an incomplete motion state. |
| `node --test` could not spawn a child process in the Windows sandbox (`EPERM`) | 1 | Use the repository's single-process `node test/file.test.js` form for focused verification. |
| Train isolation tests still disabled only the legacy `vehicleDepthes` table, so the new runtime geometry graph found real level blockers | 1 | Give the focused train fixture explicitly separated vehicle poses; retain collision checks in production and in integration-focused tests. |
