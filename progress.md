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
- Panel update: added six more planned mechanisms: train, locked garage, count garage, rotating spots, double gate, and maglev spot.

## Current Runtime State

- `base` is playable against the imported level12-style layout.
- `star-passenger` is playable; its approved feedback refinement is the next implementation task.
- Fifteen proposed mechanisms remain `planned`; they display complete metadata but do not receive gameplay input.
- Desktop uses a three-column lab layout. Narrow screens use mechanism and editor drawers.
- `?mechanic=<id>` selects a mechanism and safely falls back to `base`.
- The scene editor is always available, defaults to collapsed, and stores local overrides separately from mechanism selection.
- Advertising packaging, CTA/store routing, install gates, and platform-specific runtime assets are no longer active.

## Verification

- `pnpm test`: 83/83 passed.
- `pnpm run build`: passed with the existing non-blocking chunk-size warning.
- Repository hygiene excludes dependency caches, accidental system files, and transient logs from project sources.

## Next Work

Execute the approved [`docs/superpowers/plans/2026-07-10-star-passenger-feedback.md`](docs/superpowers/plans/2026-07-10-star-passenger-feedback.md) before starting another mechanic. It covers the 3/2/1 badge, one `-1` per exit crossing, cyclic 0/20 charge, a one-second completion celebration, and desktop/mobile/reduced-motion browser QA.

## Browser QA Notes

The star-passenger feedback plan requires fresh desktop, mobile, and reduced-motion browser QA. Do not rely on earlier shell QA for this behavior change.

## Historical Note

The older 2026-07-07 and 2026-07-08 playable-ad work remains preserved in project archives and the historical section of `docs/project/playable-project-progress.md`; it is not the current workflow.
