# Code Navigation

Use this file before code changes. Pick the closest change area, then read only the listed files and paired tests. Broaden with targeted search only when the map is insufficient.

## Change Target Map

| Change area | Start here | Also check |
| --- | --- | --- |
| Mechanic identity, metadata, status, lookup, filtering | `src/mechanic-registry.js` | `test/mechanic-registry.test.js`, `src/mechanic-library.js` |
| `?mechanic=` parsing/sync and safe storage removal | `src/mechanic-lab.js` | `test/mechanic-registry.test.js`, `src/main.js` |
| Mechanic search, grouping, detail, selection, mobile drawer | `src/mechanic-library.js` | `test/mechanic-registry.test.js`, `src/styles.css`, `index.html` |
| Lab bootstrap, base runtime assembly, mechanic pause/select, tuning storage, QA API | `src/main.js` | `src/mechanic-lab.js`, `src/mechanic-registry.js`, `index.html`, `test/game-model.test.js` |
| Core gameplay rules, blockers, spots, queues, boarding, win/fail | `src/game-model.js` | `src/level-data.js`, `src/vehicle-motion.js`, `test/game-model.test.js` |
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
  - `npm run dev`: Vite development server on localhost.
  - `npm run build`: production Vite build.
  - `npm run preview`: preview the production build.
  - `npm test`: run all Node tests.
  - `npm run apply:tuning`: apply exported editor tuning to authored source.
- `scripts/apply-scene-tuning.mjs`: merges `artifacts/scene-tuning.json` or `--input` into `src/scene-tuning.js`.
- `scripts/extract-unity-vat.mjs`: reads Unity VAT texture data and writes runtime texture bytes.
- `tools/unity-vat-export/`: Unity helper project used to export VAT-compatible assets.

### Mechanic Lab

- `src/mechanic-registry.js`: immutable registry for `base` plus ten planned mechanisms. Owns IDs, names, categories, status, summary/effect/experience/difficulty, exact lookup, fallback to `base`, and text filtering.
- `src/mechanic-lab.js`: pure lab helpers. Owns query parsing, same-origin query replacement/sync, unknown-ID fallback through the registry, and exception-safe storage removal.
- `src/mechanic-library.js`: mechanism browser UI. Owns search, unique primary-category grouping, status labels, detail rendering with `textContent`, active state, mobile collapse/focus behavior, viewport synchronization, and listener cleanup.
- `src/main.js`: browser entry and current base runtime adapter. Wires the registry/library to `BusLoopGame`, `SceneView`, audio, and editor; freezes input for planned mechanisms; owns loading/end states, URL selection, tuning migration/save/reset, animation loop, and `window.__busLoop`.

### Base Runtime

- `src/game-model.js`: pure gameplay state machine for vehicle clicks, blockers, station reservation, route progress, queues/conveyor, boarding, departure, win/fail, snapshots, and subscriptions.
- `src/level-data.js`: authored level/color/gameplay constants and all runtime asset URLs.
- `src/scene-view.js`: Three.js scene construction, loading, camera/background fit, paths, models, passengers, effects, picking, resize, and rendering.
- `src/audio-controller.js`: WebAudio unlock/preload/playback and game-event audio de-duplication.
- `src/scene-tuning.js`: mutable editor-facing tuning object and authored source values.
- `src/scene-editor.js`: generated tuning controls, nested path get/set, collapse behavior, and reset-to-authored-defaults hook.
- `src/scene-layout.js`: pure camera/layout and curve transform helpers.
- `src/vehicle-motion.js`: Unity-style path, AnimationCurve, station, collision, and hit motion math.
- `src/vehicle-effects.js`: ribbon, smoke, collision, boarding, and per-frame particle runtime.
- `src/styles.css`: three-column desktop grid, full-stage canvas, mechanism states/overlay, mobile library drawer, scene editor drawer, loading/end panels, and phone preview framing.

### Runtime Assets

- `public/assets/runtime/`: neutral, web-optimized assets used directly by the lab, including compressed background, loop art, guide hand, color textures, and selected effects. Runtime URLs use `/assets/runtime/...`; do not reintroduce platform names.
- `public/assets/unity/`: original or directly exported Unity models, textures, effects, fonts, and audio used for fidelity and tooling.
- `src/level-data.js` is the main URL inventory; `src/scene-view.js` also directly references the runtime guide-hand asset.
- `artifacts/scene-tuning.json` is an editor tuning handoff, not an automatically loaded runtime asset.

### Tests

- `test/mechanic-registry.test.js`: lab shell, CSS breakpoint contracts, library rendering/interactions/cleanup, registry completeness/freezing/filtering, URL helpers, and safe storage removal.
- `test/game-model.test.js`: base gameplay plus source/runtime contracts, tuning/storage wiring, assets, VAT, paths, blockers, queues, boarding, collision, and win/fail behavior.
- `test/scene-layout.test.js`: camera/layout helper math and curve transforms.
- `test/vehicle-effects.test.js`: ribbon, smoke, hit effects, particle motion, and editor-driven effect tuning.

## Known Test Baseline

As of 2026-07-09, the lab-focused test file passes 22/22. The full suite passes 66/73; seven existing `test/game-model.test.js` failures are tracked in `task_plan.md`. Do not treat those failures as new without comparing names and assertions.

## Historical Material

`docs/platforms/`, `docs/playable/`, and archived project logs describe the repository's former advertising-delivery phase. They are useful for provenance only and are not active code navigation or implementation instructions.

## Maintenance Rule

Update this file when code files are added, removed, renamed, or when a file's main responsibility moves. Do not update it for small internal refactors that preserve ownership boundaries.
