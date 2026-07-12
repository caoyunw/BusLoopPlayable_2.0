# Progress

## Handoff - 2026-07-12

The BusLoop mechanic lab now has a clean, verified baseline. The registry contains 17 mechanism definitions: 2 playable (`base`, `star-passenger`) and 15 planned.

## Main Implementation Commits

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

- `base` is playable against the imported level12-style layout.
- `star-passenger` is playable with the completed 3/2/1 badge, one `-1` per exit crossing, cyclic 0/20 charge, 20/20 celebration, and third-pass reward expiration.
- Fifteen proposed mechanisms remain `planned`; they display complete metadata but do not receive gameplay input.
- Desktop uses a three-column lab layout. Narrow screens use mechanism and editor drawers.
- `?mechanic=<id>` selects a mechanism and safely falls back to `base`.
- The scene editor is always available, defaults to collapsed, and stores local overrides separately from mechanism selection.
- Advertising packaging, CTA/store routing, install gates, and platform-specific runtime assets are no longer active.

## Verification

- `pnpm test`: 88/88 passed.
- `pnpm run build`: passed with the existing non-blocking chunk-size warning.
- Edge browser QA passed on desktop, 390x844 mobile, and reduced-motion settings, including `20/20 -> 0/20 -> 1/20`, pointer interaction, and error checks.
- Repository hygiene excludes dependency caches, accidental system files, and transient logs from project sources.

## Next Work

Plan and implement `question-passenger` next. Define its hidden-color and reveal rules, keep it `planned` until focused tests and desktop/mobile/reduced-motion QA pass, and preserve the 88/88 baseline. The [star-passenger design](docs/superpowers/specs/2026-07-10-star-passenger-feedback-design.md) and [implementation plan](docs/superpowers/plans/2026-07-10-star-passenger-feedback.md) are completed references.

## Browser QA Notes

Star-passenger feedback passed Edge QA on desktop, 390x844 mobile, and reduced-motion settings. The run confirmed readable 3/2/1 and `-1` feedback, the `20/20 -> 0/20 -> 1/20` cycle, pointer interaction during celebration, stable layout, and no console, page, or network errors.

## Historical Note

The older 2026-07-07 and 2026-07-08 playable-ad work remains preserved in project archives and the historical section of `docs/project/playable-project-progress.md`; it is not the current workflow.
