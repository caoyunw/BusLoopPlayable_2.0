# Progress

## Handoff - 2026-07-09

The repository has been converted from an advertising-oriented playable into the BusLoop mechanic lab. The base game remains playable, while ten proposed mechanisms are available as searchable `planned` entries with descriptions and frozen preview states.

## Main Implementation Commits

- `d341317`: added the mechanic registry and URL selection helpers.
- `0bfea8d`: added the mechanic library shell, desktop grid, and mobile drawer.
- `3d5f30c` / `7d63e83`: hardened library interaction, grouping, focus, cleanup, and tests.
- `864a4d1`: converted the runtime assembly to the mechanic lab.
- `a6227df`: preserved authored scene defaults and made tuning reset/storage safer.
- `8f78492`: removed advertising delivery scripts/artifacts and migrated active web assets to neutral runtime paths.

## Current Runtime State

- `base` is playable against the imported level12-style layout.
- Ten proposed mechanisms remain `planned`; they display complete metadata but do not receive gameplay input.
- Desktop uses a three-column lab layout. Narrow screens use mechanism and editor drawers.
- `?mechanic=<id>` selects a mechanism and safely falls back to `base`.
- The scene editor is always available, defaults to collapsed, and stores local overrides separately from mechanism selection.
- Advertising packaging, CTA/store routing, install gates, and platform-specific runtime assets are no longer active.

## Verification

- `node --test test/mechanic-registry.test.js`: 22/22 passed.
- `npm run build`: passed with the existing Vite large-chunk warning.
- `npm test`: 66/73 passed. The seven existing `test/game-model.test.js` failures are listed in `task_plan.md`.
- Active-rule phrase scan and `git diff --check` remain part of the documentation handoff closeout.

## Next Work

Start mechanism implementation with `question-vehicle`, then `garage`, using the registry/lab/library boundaries documented in `docs/project/code-navigation.md`. Keep each preset `planned` until its focused tests and real browser interaction are complete.

## Pending Browser QA

Automated source-contract tests cover the shell and responsive breakpoint, but this handoff does not claim a completed visual browser pass. Still verify desktop and mobile layouts, canvas rendering, drawer overlap/focus, mechanism search and selection, planned overlay/input freeze, editor behavior, and console output.

## Historical Note

The older 2026-07-07 and 2026-07-08 playable-ad work remains preserved in project archives and the historical section of `docs/project/playable-project-progress.md`; it is not the current workflow.
