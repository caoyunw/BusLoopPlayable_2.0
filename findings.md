# Findings

## Current Durable Findings - 2026-07-13

### Mechanic Lab Boundaries

- The active product is a mechanic design and experience lab. After recent merges the registry contains 17 definitions: 8 playable (`base`, `question-passenger`, `garage`, `star-passenger`, `linked-passengers`, `valve`, `order-passenger`, `count-garage`) and 9 planned.
- Each `src/mechanics/*/index.js` owns its mechanic identity, metadata, and status; `src/mechanics/index.js` is the assembled module source of truth. `src/mechanic-registry.js` derives the frozen metadata collection and provides lookup, fallback, and search.
=======
- The active product is a mechanic design and experience lab. The registry contains 17 definitions: 4 playable (`base`, `garage`, `star-passenger`, `valve`) and 13 planned.
- `src/mechanic-registry.js` is the source of truth for mechanism identity, metadata, state, lookup, fallback, and search.
>>>>>>> Stashed changes
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

- The base mechanism now targets imported level18 `GameSceneDualQueue2` data rather than earlier prototypes. Active data includes 47 vehicles, two fixed queues (115 and 191 groups), CSV-sourced `vehicleDepthes` blocker relationships, and two garage containers with stocked vehicles. A duplicate `})` introduced during the merge was removed and `src/level-data.js` now passes syntax checks.

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

### Unity Garage Mechanic Extraction

- Unity garage behavior is owned by `VehicleContainerGarage`, `StateOutGarage`, and `GarageContainerCollideInfo`; the prefab provides `InitPos`, `BusObject`, `uiPos`, `ParkPos`, an animator, and a feedback player.
- Garage stock is built from level vehicles with `containerType == Garage` and matching `containerId`; vehicles are stored hidden and released one at a time when the door/front is clear.
- The displayed garage count subtracts the currently driving-out vehicle immediately, before the out animation completes.
- Unity models garage blocking through five graph nodes: head, tail, door, out path, and body. A web first pass can approximate this through the existing blocker model, but the durable rule is that the garage door and out path must block/release sequentially.
- Full extraction notes are recorded in `docs/superpowers/specs/2026-07-13-garage-unity-extraction.md`.

### Web Garage Implementation

- `garage` is now playable in the web mechanic lab. The first pass stores matching garage vehicles as hidden `in-garage` vehicles, releases them through `leaving-garage`, and returns them to normal `parked` state after the out duration.
- Garage containers are also treated as an automatic level feature. Any level with `type: 2` garage containers enables the garage runtime alongside the selected playable mechanic, so the default `base` view still hides stocked garage vehicles and renders garage snapshots.
- Garage release does not reuse the ordinary vehicle `vehicleDepthes` graph. That graph controls whether a visible vehicle can be clicked to leave the field; it must not stop the first hidden garage vehicle from spawning. On level18, the first stocked vehicles `38` and `60` enter `leaving-garage` on the first gameplay update. A full five-node garage collision graph remains a possible fidelity upgrade.
- Garage drive-out uses Unity prefab anchors rather than hidden-stock layout coordinates: `BusObject` local `{ x: 0, z: -0.1748478 }` is the out animation start and `ParkPos` local `{ x: 0, z: 0.70000005 }` is the parking point after release. For level18 this parks vehicle `38` at `(-0.7070351, 0.33480565)` and vehicle `60` at approximately `(-0.03203511, 0.60617142)`. Released garage vehicles use dynamic collision blockers from their new position instead of stale authored `vehicleDepthes`.
- Garage model visibility follows the displayed inside-stock count. When the last stocked vehicle begins `leaving-garage`, the counter reaches `0` and the garage snapshot is marked hidden, while the exiting vehicle continues its own drive-out animation.
- The scene renders garage snapshots with the Unity `Truck_01.fbx` model. The web renderer preserves source material slot names, uses `Truck_Main_DarkBlue.png` for the body and `Truck_Metal_Matcap.png` through `MeshMatcapMaterial` for metal parts, and applies garage model axis correction before sizing. The simple geometry remains only as a no-asset fallback.
- Garage container coordinates are still parsed from authored `containers[].position.x/z`, while container rotation is converted from the Unity quaternion to yaw. Rendering maps those through `vehicleArea` transforms; model pitch/roll correction is a local asset-orientation fix and should not be baked back into level data.
- Garage audio events are named `garage_out` and `garage_clear`; they are silent unless future audio config provides matching clips.

### Web Count Garage Implementation

- `count-garage` is playable in the web mechanic lab. It reuses the garage hidden-stock/release runtime with per-garage unlock thresholds.
- Successful `clickVehicle` dispatches increment the count-garage unlock counter. Garage id `1` unlocks after 10 successful vehicle dispatches; garage id `2` unlocks after 20.
- Locked count garages keep their stocked vehicles hidden as `in-garage` and block release. Their garage label uses a dark lock-shaped badge and displays remaining unlock count; once unlocked, the label returns to the ordinary yellow stock-count badge and release follows the existing one-at-a-time garage rules.
- The count-garage runtime declares that it handles garage containers, so selecting `count-garage` does not also stack the default auto-enabled `garage` feature runtime.

### Web Valve Implementation

- `valve` is playable in the web mechanic lab. It adds a model-level `canPassengerEnterBelt` gate so mechanic modules can decide whether an empty conveyor slot may receive a passenger from a side entry.
- Valve state is side-based, not player-toggle based. During initial conveyor fill, both side queues can enter normally and switching has not started. After initial fill completes, the valve starts on entry `0` when that side still has supply, locks to that side's current queue-head color, and switches to the next side after that visible same-color run has entered the belt.
- Closed side entries do not clamp initial conveyor fill because closed-side gating only applies after the initial-fill phase.
- The scene renders lightweight valve markers at `LEVEL_1.entryPercents`, using open/closed door rotation and the current/head color as the marker color. No new art asset is required for this first playable pass.
- Browser QA on 2026-07-13 confirmed the selected valve card, nonblank canvas, visible left/right entrance markers, collapsed mobile drawers at 390x844, and no console errors.

### Web Order Passenger Implementation

- `order-passenger` is playable in the web mechanic lab. It replaces the level-completion goal with a mechanic-owned order goal: finish all red, yellow, and brown passenger groups.
- The order target counts are derived from the active level queues and displayed as passenger counts by multiplying group counts by `level.groupSize` (4 in level18). Current level18 order totals are red `184`, yellow `224`, and brown `176`.
- The base model exposes a mechanic runtime `hasWon(game)` hook. `order-passenger` uses it to end the level as soon as all three order targets reach zero, even if unrelated vehicles/passengers remain.
- The order HUD lives in `src/mechanics/order-passenger/view.js` and renders a top stage panel with color passenger icons plus remaining passenger counts. It only appears while the selected mechanic is `order-passenger`.
- Browser QA on 2026-07-13 confirmed the selected order-passenger card, top order HUD, level18 counts `184/224/176`, nonblank canvas, collapsed mobile drawers at 390x844, and no console errors.

## Historical Advertising Packaging - Removed

- The advertising package, platform-specific runtime assets, CTA/store flow, install gate, MRAID startup path, package scripts, static package checker, and generated package artifacts were removed in commit `8f78492`.
- Earlier inline-HTML replacement, store-routing, and package-cache findings apply only to archived advertising-delivery history. They are not requirements for the mechanic lab.
- Historical platform and delivery documents remain available for provenance under `docs/platforms/`, `docs/playable/`, and `docs/project/archive/`.

## Archive

Full detailed 2026-07-07 findings were archived to:

- `docs/project/archive/findings.full-2026-07-08.md`
