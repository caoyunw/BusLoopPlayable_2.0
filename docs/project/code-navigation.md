# Code Navigation

Use this file before code changes. Pick the closest change area, then read only the listed files and paired tests. Broaden with targeted search only when the map is insufficient.

## Change Target Map

| Change area | Start here | Also check |
| --- | --- | --- |
| Mechanic identity, metadata, status, module lookup, and playable runtime resolution | `src/mechanics/index.js` | `src/mechanics/*/index.js`, `src/mechanic-registry.js`, `test/mechanic-registry.test.js` |
| Frozen mechanic collection, metadata lookup, fallback, and text filtering | `src/mechanic-registry.js` | `src/mechanics/index.js`, `test/mechanic-registry.test.js`, `src/mechanic-library.js` |
| `?mechanic=` parsing/sync and safe storage removal | `src/mechanic-lab.js` | `test/mechanic-registry.test.js`, `src/main.js` |
| Mechanic search, grouping, generic detail extensions, selection, mobile drawer | `src/mechanic-library.js` | `src/mechanics/index.js`, `test/mechanic-registry.test.js`, `src/styles.css`, `index.html` |
| Star-passenger lifetime, cyclic charge, and boarding/expiration rules | `src/mechanics/star-passenger/model.js` | `src/mechanics/star-passenger/index.js`, `test/star-passenger-mechanic.test.js` |
| Question-passenger assignment modes, chance normalization, authored masks, and state metadata | `src/mechanics/question-passenger/model.js` | `src/mechanics/question-passenger/index.js`, `test/question-passenger-mechanic.test.js` |
| Question-passenger detail mode/chance controls and authored summary | `src/mechanics/question-passenger/view.js` | `src/mechanics/question-passenger/styles.css`, `src/mechanics/question-passenger/index.js`, `src/mechanic-library.js`, `src/main.js`, `test/mechanic-registry.test.js`, `test/game-model.test.js` |
| Question-passenger neutral queue appearance, per-person question badges, and one-shot reduced-motion-safe belt reveal feedback | `src/scene-view.js` | `test/question-passenger-mechanic.test.js`, `test/star-passenger-mechanic.test.js` |
| Star-passenger HUD, celebration, and reduced-motion feedback | `src/mechanics/star-passenger/view.js` | `src/mechanics/star-passenger/styles.css`, `src/scene-view.js`, `test/star-passenger-mechanic.test.js` |
| Lab bootstrap, base runtime assembly, mechanic pause/select, page-session mechanic options, generic detail wiring, tuning storage, QA API | `src/main.js` | `src/mechanics/index.js`, `src/mechanic-library.js`, `src/mechanic-lab.js`, `src/mechanic-registry.js`, `index.html`, `test/game-model.test.js` |
| Core gameplay rules, reset-generation snapshots, blockers, spots, queues, boarding, win/fail | `src/game-model.js` | `src/level-data.js`, `src/vehicle-motion.js`, `test/game-model.test.js` |
| Level constants, fixed passenger sequence, vehicles, spots, runtime asset URLs | `src/level-data.js` | `src/game-model.js`, `src/scene-view.js`, `test/game-model.test.js` |
| Three.js rendering, picking, assets, vehicles, passengers, shadows | `src/scene-view.js` | `src/scene-tuning.js`, `src/scene-layout.js`, `test/game-model.test.js` |
| Runtime audio events and WebAudio playback | `src/audio-controller.js` | `src/main.js`, `src/level-data.js`, `test/game-model.test.js` |
| Scene/editor authored tuning values | `src/scene-tuning.js` | `src/scene-editor.js`, `src/scene-view.js`, `scripts/apply-scene-tuning.mjs`, `test/game-model.test.js` |
| Editor controls, reset-to-authored-defaults, grouping | `src/scene-editor.js` | `src/scene-tuning.js`, `src/main.js`, `src/styles.css`, `test/game-model.test.js` |
| Responsive layout math, camera fit, curve transforms | `src/scene-layout.js` | `test/scene-layout.test.js` |
| Vehicle routes, station approach/departure, collision/hit clips | `src/vehicle-motion.js` | `src/game-model.js`, `test/game-model.test.js` |
| Vehicle ribbons/smoke, boarding smoke, particle motion | `src/vehicle-effects.js` | `test/vehicle-effects.test.js`, `src/scene-tuning.js`, `src/scene-view.js` |
| Lab DOM shell, mounts, loading/overlay/end states | `index.html` | `src/main.js`, `src/mechanic-library.js`, `src/styles.css`, `test/mechanic-registry.test.js` |
| Desktop three-column layout, mobile drawers, editor and overlays | `src/styles.css` | `index.html`, `src/mechanic-library.js`, `src/scene-editor.js`, `test/mechanic-registry.test.js` |
| npm metadata, scripts, dependencies | `package.json` | `pnpm-lock.yaml` only when dependency metadata changes |
| Apply exported scene tuning | `scripts/apply-scene-tuning.mjs` | `artifacts/scene-tuning.json`, `src/scene-tuning.js` |
| Unity VAT extraction utility | `scripts/extract-unity-vat.mjs` | `tools/unity-vat-export/Packages/manifest.json` |

## File Responsibilities

### Root And Config

- `index.html`: semantic lab shell. Owns `#mechanic-library`, `#stage`, `#game-canvas`, loading state, planned-mechanic overlay, end panel, and `#scene-editor` mount.
- `package.json`: package identity and the active commands:
  - `pnpm run dev`: Vite development server on localhost.
  - `pnpm run build`: production Vite build.
  - `pnpm run preview`: preview the production build.
  - `pnpm test`: run all Node tests.
  - `pnpm run apply:tuning`: apply exported editor tuning to authored source.
- `scripts/apply-scene-tuning.mjs`: merges `artifacts/scene-tuning.json` or `--input` into `src/scene-tuning.js`.
- `scripts/extract-unity-vat.mjs`: reads Unity VAT texture data and writes runtime texture bytes.
- `tools/unity-vat-export/`: Unity helper project used to export VAT-compatible assets.

### Mechanic Lab

- `src/mechanics/*/index.js`: owns each mechanic's identity, metadata, status, and exported runtime/detail hooks.
- `src/mechanic-registry.js`: derives an immutable metadata collection from `src/mechanics/index.js` and owns exact lookup, fallback to `base`, and text filtering; it does not own mechanic definitions.
- `src/mechanic-lab.js`: pure lab helpers. Owns query parsing, same-origin query replacement/sync, unknown-ID fallback through the registry, and exception-safe storage removal.
- `src/mechanic-library.js`: mechanism browser UI. Owns search, unique primary-category grouping, status labels, detail rendering with `textContent`, generic detail-extension mounting/cleanup, host-first selection with an idempotent active-state fallback, mobile collapse/focus behavior, viewport synchronization, and listener cleanup.
- `src/mechanics/index.js`: assembles and freezes the 17-module catalog (3 playable and 14 planned), then owns exact module lookup, playable-runtime resolution, and optional generic detail-view factory delegation.
- `src/main.js`: browser entry and current base runtime adapter. Wires the registry/library to `BusLoopGame`, `SceneView`, audio, and editor; owns page-local mechanic option defaults, generic detail-view commits from the current runtime snapshot, active-mechanic reset/queue reinitialization, and inactive-option HUD synchronization; freezes input for planned mechanisms; owns loading/end states, URL selection, tuning migration/save/reset, animation loop, and `window.__busLoop`.
- `src/mechanics/star-passenger/`: completed star-passenger mechanic. `model.js` owns lifetime and charge state; `view.js` and `styles.css` own HUD, celebration, and reduced-motion feedback.
- `src/mechanics/question-passenger/`: playable question-passenger module. `index.js` owns its definition/status and runtime/detail exports; `model.js` owns chance/authored assignment normalization and state metadata; `view.js` and `styles.css` own persistence-free detail mode/chance controls, normalized commit payloads, and authored-count summary.

### Base Runtime

- `src/game-model.js`: pure gameplay state machine for vehicle clicks, reset-generation snapshots, blockers, station reservation, route progress, queues/conveyor, boarding, departure, win/fail, and subscriptions.
- `src/level-data.js`: authored level/color/gameplay constants and all runtime asset URLs.
- `src/scene-view.js`: Three.js scene construction, loading, camera/background fit, paths, models, passenger materials/question badges, one-shot belt reveal feedback, effects, picking, resize, and rendering.
- `src/audio-controller.js`: WebAudio unlock/preload/playback and game-event audio de-duplication.
- `src/scene-tuning.js`: mutable editor-facing tuning object and authored source values.
- `src/scene-editor.js`: generated tuning controls, nested path get/set, collapse behavior, and reset-to-authored-defaults hook.
- `src/scene-layout.js`: pure camera/layout and curve transform helpers.
- `src/vehicle-motion.js`: Unity-style path, AnimationCurve, station, collision, and hit motion math.
- `src/vehicle-effects.js`: ribbon, smoke, collision, boarding, and per-frame particle runtime.
- `src/styles.css`: imports mechanic-owned detail styles and owns the three-column desktop grid, full-stage canvas, mechanism states/overlay, mobile library drawer, scene editor drawer, loading/end panels, and phone preview framing.

### Runtime Assets

- `public/assets/runtime/`: neutral, web-optimized assets used directly by the lab, including compressed background, loop art, guide hand, color textures, and selected effects. Runtime URLs use `/assets/runtime/...`; do not reintroduce platform names.
- `public/assets/unity/`: original or directly exported Unity models, textures, effects, fonts, and audio used for fidelity and tooling.
- `src/level-data.js` is the main URL inventory; `src/scene-view.js` also directly references the runtime guide-hand asset.
- `artifacts/scene-tuning.json` is an editor tuning handoff, not an automatically loaded runtime asset.

### Tests

- `test/mechanic-registry.test.js`: lab shell, CSS breakpoint contracts, library rendering/interactions, host-first selection/fallback ordering, detail-extension state and cleanup, mechanic detail-view factory and question settings controls, playable-resolution/status totals, registry completeness/freezing/filtering, URL helpers, and safe storage removal.
- `test/question-passenger-mechanic.test.js`: question-passenger assignment/state plus hidden material transitions, badge/cache reuse, one-shot reveal timing and reduced-motion behavior, tuning, and scene-wiring contracts.
- `test/star-passenger-mechanic.test.js`: star-passenger registry status, reward lifetime, cyclic charge, boarding/expiration behavior, UI wiring, and reduced-motion contracts.
- `test/game-model.test.js`: base gameplay plus reset-version behavior, active question-passenger startup/reconfiguration, source/runtime contracts, page-session mechanic detail/apply wiring, tuning/storage wiring, assets, VAT, paths, blockers, queues, boarding, collision, and win/fail behavior.
- `test/scene-layout.test.js`: camera/layout helper math and curve transforms.
- `test/vehicle-effects.test.js`: ribbon, smoke, hit effects, particle motion, and editor-driven effect tuning.

## Known Test Baseline

As of 2026-07-13, the full suite passes 138/138. `pnpm run build` passes with the existing non-blocking chunk-size warning. Question-passenger has passed desktop 1280x720 and mobile 390x844 browser QA; its live forced reduced-motion branch also passed, while native reduced-motion emulation was unavailable in the in-app browser. The next mechanic requires user selection from the 14 planned definitions.

## Historical Material

`docs/platforms/`, `docs/playable/`, `docs/project/playable-multi-platform-execution-plan.md`, and archived project logs describe the repository's former advertising-delivery phase. They are useful for provenance only and are not active code navigation or implementation instructions.

## Maintenance Rule

Update this file when code files are added, removed, renamed, or when a file's main responsibility moves. Do not update it for small internal refactors that preserve ownership boundaries.
