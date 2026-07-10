# Findings

## Current Durable Findings - 2026-07-09

### Mechanic Lab Boundaries

- The active product is a mechanic design and experience lab. `base` is playable; sixteen additional definitions are discoverable but remain `planned`.
- `src/mechanic-registry.js` is the source of truth for mechanism identity, metadata, state, lookup, fallback, and search.
- `src/mechanic-library.js` owns list/detail DOM and responsive drawer behavior. It consumes registry data and must not implement gameplay rules.
- `src/mechanic-lab.js` owns URL selection helpers and safe storage removal. `src/main.js` assembles the current base runtime and freezes input for planned mechanisms.
- New mechanism behavior should live behind an isolated module boundary and reuse base runtime contracts. Do not grow a large mechanism switch inside `src/main.js`.
- A mechanism stays `planned` until its real play loop, focused tests, and browser QA are complete.

### Runtime Asset Naming

- Web-optimized assets used by the lab live under `public/assets/runtime/` and are referenced as `/assets/runtime/...`.
- Unity models, source textures, effects, fonts, and audio remain under `public/assets/unity/`.
- Runtime asset paths must use neutral names. Advertising platform names are not runtime ownership boundaries.
- `src/level-data.js` is the primary asset URL inventory; `src/scene-view.js` directly owns the runtime guide-hand URL.

### Persistent Editor And Authored Defaults

- The scene editor is a permanent lab tool and defaults to collapsed; it is no longer stripped from a production-oriented runtime path.
- `src/main.js` clones `SCENE_TUNING` before any saved override is merged. Reset therefore returns to authored source values instead of values already mutated during the session.
- Exported `artifacts/scene-tuning.json` is a handoff for `npm run apply:tuning`; browser storage alone is not an authored source change.

### Safe Storage

- Scene tuning uses `bus-loop-scene-tuning-v3`; legacy `v2` data is migrated without replacing the current `vehicleArea` object wholesale.
- Storage reads, JSON parsing, writes, and removal are exception-safe. Failure should warn and leave the lab usable.
- Tuning writes are debounced and flushed on unload; explicit save can flush immediately.
- Mechanic selection is represented by `?mechanic=` rather than sharing the tuning storage key. Unknown IDs resolve to `base`.

### Active Level Layout

- The base mechanism targets imported level12-style `GameSceneDualQueue2` data rather than the original six-vehicle prototype.
- Active data has 94 visible vehicles, two fixed queues with 219 groups each, and authored `vehicleDepthes` blocker data for 90 vehicles.
- Vehicle seat totals match fixed passenger queue totals by color. Initial movable vehicles are `1, 4, 34, 51`.

### Conveyor And Passenger Entry

- Unity conveyor progress is based on actual spline path length: initial fill uses passenger speed and normal belt motion uses conveyor speed, both divided by spline length.
- Queue supply waits until the head is ready. During initial fill, empty belt slots clamp just before the entry until a passenger can enter.
- The web runtime reuses the full queue-entry visual path for initial-fill and later refill groups.

### Materials, Effects, Audio, And Shadows

- Vehicle prefabs use full Unity color atlases; authored model UVs remain active for windows, lights, and body regions.
- Passenger prefabs are color-specific materials/textures rather than simple runtime swatches. Current tuning also supports solid-color adjustment while retaining VAT animation data.
- Core audio is wired for collision, passenger boarding, and full-vehicle departure.
- Collision, smoke trail, ribbon, and boarding effects retain Unity-authored source relationships.
- Authored fake shadows are the active solution; the heavier real-time Three.js shadow-map experiment was removed.

### Camera And Motion

- Current authored camera behavior keeps configured visible height across viewport aspects; wider screens reveal more horizontal content.
- Phone preview framing is an editor tool and must not be confused with the actual responsive stage dimensions during browser QA.
- Vehicle arrows move with the vehicle hit root. Collision and station paths remain owned by `src/vehicle-motion.js` and tuning.

## Historical Advertising Packaging - Removed

- The advertising package, platform-specific runtime assets, CTA/store flow, install gate, MRAID startup path, package scripts, static package checker, and generated package artifacts were removed in commit `8f78492`.
- Earlier inline-HTML replacement, store-routing, and package-cache findings apply only to archived advertising-delivery history. They are not requirements for the mechanic lab.
- Historical platform and delivery documents remain available for provenance under `docs/platforms/`, `docs/playable/`, and `docs/project/archive/`.

## Archive

Full detailed 2026-07-07 findings were archived to:

- `docs/project/archive/findings.full-2026-07-08.md`
