# Findings

## Current Durable Findings - 2026-07-13

### Mechanic Lab Boundaries

- The active product is a mechanic design and experience lab. After linked-passenger activation, the registry contains 17 definitions: 5 playable (`base`, `question-passenger`, `garage`, `star-passenger`, `linked-passengers`) and 12 planned.
- Each `src/mechanics/*/index.js` owns its mechanic identity, metadata, and status; `src/mechanics/index.js` is the assembled module source of truth. `src/mechanic-registry.js` derives the frozen metadata collection and provides lookup, fallback, and search.
- `src/mechanic-library.js` owns list/detail DOM and responsive drawer behavior. It consumes registry data and must not implement gameplay rules.
- `src/mechanic-lab.js` owns URL selection helpers and safe storage removal. `src/main.js` assembles the current base runtime and freezes input for planned mechanisms.
- New mechanism behavior should live behind an isolated module boundary and reuse base runtime contracts. Do not grow a large mechanism switch inside `src/main.js`.
- A mechanism stays `planned` until its real play loop, focused tests, and browser QA are complete.
- The lab is no longer a continuation path for playable-ad production. New mechanics do not require production minification/bundling, final-single-page dependency collection, Vite/Three.js delivery verification, or advertising-package checks; Vite remains only a local browser-playtest server.

### Question-Passenger Rules And Architecture

- Question state changes waiting-stage visibility only. Real `colorIndex`, queue order, matching, boarding, vehicle departure, and win/fail rules remain unchanged.
- `chance` mode assigns each new queue group independently and defaults to 0.3; reset rerolls question positions. `authored` mode reads only `level.mechanics['question-passenger'].authoredMasks` and does not call random. The merged level18 data currently omits that mask, so authored question assignment has no active marks until the level data is reconciled.
- Authored summaries and assignments ignore mask rows/items beyond the actual `passengerQueues`; missing entries remain non-question groups.
- Mode/chance controls are page-session state only: switching away and back retains them, while refresh restores chance/30%. They are not stored or added to the URL.
- Active `setMechanicOptions` rebuilds the runtime and resets exactly once. Scene reveal de-duplication uses passenger ID plus `revealVersion`; `resetVersion` clears transient state when passenger IDs are reused.
- Hidden waiting groups use a neutral-gray material and four question badges. Belt groups always show real color and receive one non-blocking reveal. The reduced-motion branch keeps color/brightness/fade while removing scale/pop/expanding-flash transforms.
- Browser QA exercised a live forced reduced-motion branch because the in-app browser lacked native media-feature emulation; this is not evidence of native OS preference emulation.

### Linked-Passengers Released Rules And Architecture

- `linked-passengers` is playable after focused automated, desktop, mobile, capacity-pressure, and reduced-motion browser gates passed.
- A chain contains 2–N consecutive same-color passenger rows, capped by the level's largest vehicle capacity. It is atomic at the visible-queue boundary, belt entry, and boarding.
- Chance mode defaults to 30% with a configurable maximum length; authored mode uses per-queue integer arrays whose nonzero start value is the chain length. Settings are page-session only.
- Chains occupy N consecutive belt slots, allow ring wrap, and board when the head crosses the exit only if one matching arrived vehicle has N remaining seats.
- The selected visual is a segmented top connector with a chain-length badge; successful boarding uses one non-blocking synchronized fan-in event, with a no-translation reduced-motion branch.
- Composite runtimes must forward generic batch hooks and retain scalar fallback; the game model must not branch on the `linked-passengers` ID.
- Authored-chain summaries derive from authored level data and remain independent of the active chance value.
- Scene transient connector/boarding state is cleared by `resetVersion` because passenger IDs can be reused after reset.
- The linked and shared-architecture gate passes 34/34. Full `pnpm test` runs 155 tests with 148 passing; the remaining 7 are the user-approved B baseline from question/garage/registry integration, and none is a linked regression. Production build and advertising packaging are not part of this mechanic-lab gate.

### Runtime Asset Naming

- Dependency caches, accidental system files, and transient logs are not project sources and are ignored.
- Runtime assets remain under `public/assets/runtime/`; Unity provenance assets remain under `public/assets/unity/`.
- Runtime asset paths must use neutral names. Advertising platform names are not runtime ownership boundaries.
- `src/level-data.js` is the primary asset URL inventory; `src/scene-view.js` directly owns the runtime guide-hand URL.
- Existing FBXLoader material warnings remain. Four Unity texture references currently resolve to the HTML fallback rather than image bytes: `Idle_girl01_pink.png`, `img_v3_0212c_69706fc5-c18e-4959-86cf-3f9625ee0fdg.png`, `Idle_boy02_blue.png`, and `Car_P2.png`; do not invent replacements without source assets.

### Persistent Editor And Authored Defaults

- The scene editor is a permanent lab tool and defaults to collapsed; it is no longer stripped from a production-oriented runtime path.
- `src/main.js` clones `SCENE_TUNING` before any saved override is merged. Reset therefore returns to authored source values instead of values already mutated during the session.
- `src/scene-tuning.js` is the authored runtime truth; `artifacts/scene-tuning.json` is its exact export counterpart.

### Safe Storage

- Scene tuning uses `bus-loop-scene-tuning-v3`; legacy `v2` data is migrated without replacing the current `vehicleArea` object wholesale.
- Storage reads, JSON parsing, writes, and removal are exception-safe. Failure should warn and leave the lab usable.
- Tuning writes are debounced and flushed on unload; explicit save can flush immediately.
- Mechanic selection is represented by `?mechanic=` rather than sharing the tuning storage key. Unknown IDs resolve to `base`.

### Active Level Layout

- The base mechanism now targets imported level18 `GameSceneDualQueue2` data rather than the earlier level12-style or original six-vehicle prototype.
- The merged level18 data has two fixed queues with 115 and 191 groups, a largest vehicle capacity of 10 groups, authored garage containers, and authored `vehicleDepthes` blocker data.
- The duplicate `})` introduced at the `LEVEL18_VEHICLE_DEPTHES` merge boundary was removed; `src/level-data.js` now passes syntax checking and imports level18 with queues 115/191 and 47 vehicles.
- The post-fix `test/game-model.test.js` run executes 40 tests: 38 pass and 2 pre-existing garage-merge baseline assertions fail. They expect scalar runtime ID `question-passenger` instead of `question-passenger+garage`, and the removed level12 authored question mask instead of the current level18 zero-mask state.
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
