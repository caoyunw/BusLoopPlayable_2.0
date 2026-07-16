# BusLoop Mechanic Lab Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mechanic-lab branch the clean, reproducible project baseline, remove repository pollution, eliminate all seven inherited test failures, and update the active documentation before continuing mechanic development.

**Architecture:** Keep the current mechanic-lab runtime and approved browser appearance unchanged. Treat `src/scene-tuning.js` as the authored runtime source of truth and `artifacts/scene-tuning.json` as its exact export counterpart. Repair stale tests so they validate current runtime semantics instead of outdated tuning values or invalid file-format assumptions.

**Tech Stack:** Git worktrees, Vite 7, native ES modules, Three.js 0.180, Node.js test runner, Playwright/Edge browser QA.

## Global Constraints

- Work only on `codex/mechanic-lab-stabilization`, based on `origin/feature/mechanic-lab` at `5ed6a77`.
- Do not restore AppLovin, MRAID, CTA, store links, install gates, or `/assets/applovin/` paths.
- Preserve the current approved desktop and mobile appearance; this milestone is stabilization, not a visual redesign.
- Preserve all curated runtime assets, Unity source assets, reference screenshots, historical documentation, and `artifacts/scene-tuning.json`.
- Remove only dependency caches, accidental system files, transient logs, and stale document facts identified by this plan.
- `src/scene-tuning.js` is the authored runtime truth; `artifacts/scene-tuning.json` must deep-equal it after stripping the ES-module wrapper.
- The baseline must end with 83/83 tests passing, including the new tuning-parity regression test, and `npm run build` exiting 0. The existing Vite chunk-size warning is non-blocking.
- The registry truth is 17 definitions total: `base` and `star-passenger` are `playable`; 15 other definitions are `planned`.
- Use repository-relative links in durable documents; do not add local absolute paths.

---

### Task 1: Remove Repository Pollution

**Files:**
- Modify: `.gitignore`
- Delete: `.pnpm-store/`
- Delete: `%SystemDrive%/`
- Delete: `.codex-vite.err.log`
- Delete: `.codex-vite.log`
- Delete: `preview.stderr.log`
- Delete: `preview.stdout.log`
- Delete: `vite-effects-4176.err.log`
- Delete: `vite-effects-4176.out.log`
- Delete: `vite-shadow-4190.err.log`
- Delete: `vite-shadow-4190.out.log`
- Delete: `artifacts/preview-direct.err.log`
- Delete: `artifacts/preview-direct.out.log`
- Delete: `artifacts/preview-font.err.log`
- Delete: `artifacts/preview-font.out.log`

**Interfaces:**
- Consumes: the current tracked repository tree.
- Produces: a dependency-cache-free tree that still installs from `pnpm-lock.yaml` and retains all curated project assets.

- [ ] **Step 1: Add a failing tracked-junk audit**

Run:

```powershell
$tracked = git ls-files
$tracked | Select-String '^(\.pnpm-store/|%SystemDrive%/)|(^|/)(?:preview|vite-|\.codex-vite).*\.log$'
```

Expected: output includes `.pnpm-store/`, `%SystemDrive%/`, and transient log files.

- [ ] **Step 2: Extend `.gitignore` with exact repository hygiene rules**

Append these lines:

```gitignore
.pnpm-store/
%SystemDrive%/
*.log
artifacts/preview-*.log
```

Keep the existing `node_modules/`, `dist/`, `.superpowers/`, and `.worktrees/` rules.

- [ ] **Step 3: Remove only the tracked pollution paths**

Run from the worktree root:

```powershell
git rm -r -- .pnpm-store '%SystemDrive%'
git rm -- .codex-vite.err.log .codex-vite.log preview.stderr.log preview.stdout.log vite-effects-4176.err.log vite-effects-4176.out.log vite-shadow-4190.err.log vite-shadow-4190.out.log artifacts/preview-direct.err.log artifacts/preview-direct.out.log artifacts/preview-font.err.log artifacts/preview-font.out.log
```

Do not remove `artifacts/scene-tuning.json`, the three reference PNGs, `public/assets/`, or `tools/unity-vat-export/`.

- [ ] **Step 4: Verify the tracked-junk audit is clean**

Run:

```powershell
$matches = git ls-files | Select-String '^(\.pnpm-store/|%SystemDrive%/)|(^|/)(?:preview|vite-|\.codex-vite).*\.log$'
if ($matches) { $matches; exit 1 }
```

Expected: exit 0 with no output.

- [ ] **Step 5: Verify installation, focused tests, and build**

Run:

```powershell
pnpm install --frozen-lockfile
node --test test/mechanic-registry.test.js test/mechanic-architecture.test.js test/star-passenger-mechanic.test.js test/scene-layout.test.js test/vehicle-effects.test.js
pnpm run build
```

Expected: dependency installation succeeds, all 51 focused tests pass, and the Vite build exits 0 with only the existing chunk-size warning.

- [ ] **Step 6: Commit repository hygiene**

```powershell
git add .gitignore
git commit -m "chore: remove repository-local caches and logs"
```

### Task 2: Restore Scene-Tuning And Asset Contracts

**Files:**
- Modify: `test/game-model.test.js`
- Modify: `src/scene-tuning.js`
- Modify: `artifacts/scene-tuning.json`

**Interfaces:**
- Consumes: `SCENE_TUNING`, the optimized JPEG background, and the exported tuning artifact.
- Produces: one exact authored tuning contract and format-correct image dimension validation.

- [ ] **Step 1: Add failing tuning-parity and JPEG-format tests**

Near the test helpers, parse the exported tuning and add this JPEG reader:

```js
const EXPORTED_SCENE_TUNING = JSON.parse(
  readFileSync(join('artifacts', 'scene-tuning.json'), 'utf8')
);

function readJpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, 'expected JPEG start marker');
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (startOfFrameMarkers.has(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3)
      };
    }
    offset += segmentLength;
  }
  throw new Error('JPEG start-of-frame marker was not found.');
}

test('authored and exported scene tuning stay identical', () => {
  assert.deepEqual(EXPORTED_SCENE_TUNING, SCENE_TUNING);
});
```

Replace the fixed-offset reads with:

```js
const { width: sourceWidth, height: sourceHeight } = readJpegDimensions(background);
```

Run:

```powershell
node --test --test-name-pattern "authored and exported|Unity visual assets|editor sizing" test/game-model.test.js
```

Expected: FAIL because the exported tuning lacks `vehicleShadows.depthBySeats` and `vehicleShadows.scaleBySeats`, and the visual assertions still contain pre-tuning values.

- [ ] **Step 2: Remove inactive realtime-shadow configuration from both tuning files**

Delete these keys from `src/scene-tuning.js` and `artifacts/scene-tuning.json`:

```js
lighting.directional.shadowType
lighting.directional.shadowStrength
lighting.realtimeShadows
```

The runtime uses authored fake shadows; no source or editor code reads these keys.

- [ ] **Step 3: Make the exported tuning exactly match the authored source**

Add the missing `vehicleShadows` entries to `artifacts/scene-tuning.json`:

```json
"depthBySeats": {
  "4": 1.05,
  "6": 1.23,
  "10": 2.05
},
"scaleBySeats": {
  "4": { "x": 1, "z": 1 },
  "6": { "x": 1, "z": 1 },
  "10": { "x": 0.8, "z": 0.8 }
}
```

Preserve all other values and JSON formatting.

- [ ] **Step 4: Update visual assertions to the approved authored values**

Use these exact expectations in `test/game-model.test.js`:

```js
assert.equal(SCENE_TUNING.camera.elevationDegrees, 61);
assert.equal(SCENE_TUNING.lighting.directional.intensity, 1.9);
assert.deepEqual(SCENE_TUNING.lighting.directional.position, { x: -3.75, y: 11.7, z: -16.4 });
assert.deepEqual(SCENE_TUNING.lighting.directional.eulerDegrees, { x: 101.5, y: -9.5, z: -99 });
assert.equal(SCENE_TUNING.vehicleArea.positionUnitScale, 0.75);
assert.equal(SCENE_TUNING.parkingSpots.startX, -2.3);
assert.equal(SCENE_TUNING.parkingSpots.scaleX, 0.7);
assert.equal(SCENE_TUNING.parkingSpots.scaleZ, 0.65);
assert.equal(SCENE_TUNING.seatCountBoard.z, 1.37);
assert.equal(SCENE_TUNING.seatCountBoard.width, 0.52);
assert.equal(SCENE_TUNING.seatCountBoard.depth, 0.59);
assert.equal(SCENE_TUNING.seatCountBoard.textScale, 1.47);
assert.equal(SCENE_TUNING.vehicleArrow.offsetY, 0.04);
assert.equal(SCENE_TUNING.vehicleArrow.outlineColor, 0x373a45);
assert.equal(SCENE_TUNING.vehicleArrow.outlineScale, 1.05);
assert.deepEqual(SCENE_TUNING.vehicleShadows.scaleBySeats[10], { x: 0.8, z: 0.8 });
assert.equal(SCENE_TUNING.passengers.modelScale, 1.12);
assert.equal(SCENE_TUNING.passengers.groupSpacing, 0.19);
assert.equal(SCENE_TUNING.passengerMaterial.baseColorStrength, 1.1);
assert.equal(SCENE_TUNING.passengerMaterial.emissionStrength, 0.6);
assert.equal(SCENE_TUNING.passengerMaterial.brightness, 0.99);
assert.equal(SCENE_TUNING.passengerMaterial.roughness, 0.83);
assert.equal(SCENE_TUNING.passengerMaterial.solidColors[0], 0x0088f0);
assert.deepEqual(
  SCENE_TUNING.passengerMaterial.colors[0],
  { emissionColor: 0x36a6ff, baseColor: 0xdbedff }
);
assert.deepEqual(SCENE_TUNING.vehicleBoardingPulse, { scale: 1.09, speed: 11 });
assert.equal(SCENE_TUNING.vehicleGuideHand.size, 2.52);
assert.equal(SCENE_TUNING.vehicleGuideHand.speed, 0.63);
assert.equal(SCENE_TUNING.vehicleGuideHand.nearScale, 0.84);
```

Keep unchanged expectations that still match the source, including background dimensions, preview/crop, fake-shadow orientation, guide-hand identity, and the absence of realtime-shadow editor controls.

- [ ] **Step 5: Run the focused visual contract tests**

```powershell
node --test --test-name-pattern "authored and exported|Unity visual assets|editor sizing" test/game-model.test.js
```

Expected: all three matching tests pass.

- [ ] **Step 6: Commit the tuning contract repair**

```powershell
git add test/game-model.test.js src/scene-tuning.js artifacts/scene-tuning.json
git commit -m "test: align visual contracts with authored tuning"
```

### Task 3: Repair Blocker And Vehicle-Path Semantics Tests

**Files:**
- Modify: `test/game-model.test.js`

**Interfaces:**
- Consumes: `BusLoopGame`, `SCENE_TUNING.vehiclePath`, `getCollisionDistance`, and runtime vehicle state.
- Produces: tests that exercise current blocker, collision, path-tuning, and initial-movable behavior without querying invalid intermediate state.

- [ ] **Step 1: Add `getCollisionDistance` to the vehicle-motion imports**

```js
import {
  buildOutStationPoints,
  buildRoundedPath,
  buildToStationPoints,
  chooseHitClip,
  evaluatePath,
  evaluateUnityCurve,
  getCollisionDistance,
  sampleHitClip,
  UNITY_VEHICLE_MOTION
} from '../src/vehicle-motion.js';
```

- [ ] **Step 2: Make the dispatch test query a parked vehicle**

Replace the dispatch test body with:

```js
const game = new BusLoopGame();
assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), [1, 3]);
assert.deepEqual(game.clickVehicle(LEVEL12_DISPATCH_ID), { ok: true, spotIndex: 0 });
assert.equal(game.snapshot().spots[0].vehicleId, LEVEL12_DISPATCH_ID);
assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), [3]);
```

This avoids first putting vehicle 2 into `colliding`, a state for which `getBlockers()` intentionally returns an empty list.

- [ ] **Step 3: Derive the collision target from the active geometry**

Before clicking the blocked vehicle, compute:

```js
const attackerBeforeClick = game.getVehicle(LEVEL12_BLOCKED_ID);
const collisionSize = {
  width: game.level.vehicleSize.width / game.level.mapScale,
  length: game.level.vehicleSize.length / game.level.mapScale
};
const expectedTarget = game.getBlockers(LEVEL12_BLOCKED_ID)
  .map((id) => game.getVehicle(id))
  .sort((a, b) => (
    getCollisionDistance(attackerBeforeClick, a, collisionSize)
    - getCollisionDistance(attackerBeforeClick, b, collisionSize)
  ))[0];
```

After clicking, assert:

```js
assert.equal(attacker.collision.targetId, expectedTarget.id);
const expectedClip = chooseHitClip(attacker.collision.hitDirection);
advance(game, forwardDuration + .01, .005);
assert.ok(game.getVehicle(expectedTarget.id).hit);
assert.equal(chooseHitClip(game.getVehicle(expectedTarget.id).hit), expectedClip);
```

- [ ] **Step 4: Make station-path tests honor editor tuning**

Replace the hard-coded Unity boundary assertion with:

```js
assert.ok(rawPoints.some((point) => (
  Math.abs(point.z - SCENE_TUNING.vehiclePath.parkingBounds.maxZ) < 1e-6
)));
```

Replace the exact equality between tuned and Unity defaults with:

```js
assert.deepEqual(
  SCENE_TUNING.vehiclePath.parkingBounds,
  EXPORTED_SCENE_TUNING.vehiclePath.parkingBounds
);
```

Keep the existing mutation check proving that a changed `maxZ` and turn radius produce changed points and path geometry.

- [ ] **Step 5: Read runtime vehicle state in the initial-movable assertion**

Replace the final filter with:

```js
LEVEL_1.vehicles
  .filter((vehicle) => {
    const runtimeVehicle = game.getVehicle(vehicle.id);
    return runtimeVehicle.state === 'parked' && game.getBlockers(vehicle.id).length === 0;
  })
  .map((vehicle) => vehicle.id)
```

The expected remaining IDs stay `[3, 6, 33, 35, 38]`.

- [ ] **Step 6: Run game-model and full test suites**

```powershell
node --test test/game-model.test.js
pnpm test
```

Expected: `test/game-model.test.js` passes all 32 tests and the full suite passes 83/83, including the new tuning-parity test.

- [ ] **Step 7: Commit semantic test repairs**

```powershell
git add test/game-model.test.js
git commit -m "test: repair blocker and path expectations"
```

### Task 4: Update The Active Project Facts

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`
- Modify: `docs/project/code-navigation.md`
- Modify: `docs/project/playable-project-progress.md`
- Modify: `docs/mechanic-lab-handoff.md`

**Interfaces:**
- Consumes: the clean repository and verified 83/83 baseline from Tasks 1–3.
- Produces: one portable handoff that identifies star-passenger feedback as the next implementation task.

- [ ] **Step 1: Replace stale mechanism counts and test baselines**

Use these exact facts everywhere current status is described:

```text
17 mechanism definitions total
2 playable: base, star-passenger
15 planned
83/83 tests passing
npm run build passing with the existing non-blocking chunk-size warning
```

Remove the seven-item historical-debt section from `task_plan.md`; preserve it only in historical/archive documents if already present there.

- [ ] **Step 2: Set the next active goal to star-passenger feedback**

In `task_plan.md`, make the active phase point to:

```text
Complete the approved star-passenger feedback plan before starting another mechanic:
1. 3/2/1 remaining-pass badge.
2. One -1 presentation per exit crossing.
3. Cyclic 0/20 charge and one-second completion celebration.
4. Desktop, mobile, and reduced-motion browser QA.
```

Reference `docs/superpowers/plans/2026-07-10-star-passenger-feedback.md` as the execution plan.

- [ ] **Step 3: Replace local absolute links in the handoff**

Change the handoff path convention to: “All paths are repository-relative unless marked as a URL.” Use relative links such as:

```markdown
[仓库根目录](..)
[README](../README.md)
[机制协作规范](mechanic-collaboration.md)
[代码导航](project/code-navigation.md)
[星星乘客目录](../src/mechanics/star-passenger)
[星星乘客测试](../test/star-passenger-mechanic.test.js)
```

Remove stale statements naming `C:\Users\1`, `D:\claudework`, branch `feature/mechanic-lab`, HEAD `e2cebf0`, or claiming that the handoff and star plan are uncommitted.

- [ ] **Step 4: Record repository hygiene and tuning decisions**

Add concise durable findings:

```text
- Dependency caches, accidental system files, and transient logs are not project sources and are ignored.
- src/scene-tuning.js is the authored runtime truth; artifacts/scene-tuning.json is its exact export counterpart.
- Runtime assets remain under public/assets/runtime; Unity provenance assets remain under public/assets/unity.
```

- [ ] **Step 5: Verify documents, tests, build, and clean formatting**

```powershell
rg -n "67/74|75/82|seven existing|seven recorded|sixteen.*planned|C:/Users/1|D:/claudework|当前未提交文件" AGENTS.md CLAUDE.md README.md task_plan.md progress.md findings.md docs/project docs/mechanic-lab-handoff.md
git diff --check
pnpm test
pnpm run build
```

Expected: the phrase scan has no current-status or absolute-path matches, `git diff --check` exits 0, 83/83 tests pass, and the build exits 0 with only the existing chunk-size warning.

- [ ] **Step 6: Commit the stabilized project facts**

```powershell
git add AGENTS.md CLAUDE.md README.md task_plan.md progress.md findings.md docs/project/code-navigation.md docs/project/playable-project-progress.md docs/mechanic-lab-handoff.md docs/superpowers/plans/2026-07-12-mechanic-lab-stabilization.md
git commit -m "docs: establish the mechanic lab baseline"
```

---

## Completion Criteria

- The branch contains no tracked `.pnpm-store`, `%SystemDrive%`, or transient log files.
- A fresh `pnpm install --frozen-lockfile` succeeds without repository-local cache files.
- `src/scene-tuning.js` and `artifacts/scene-tuning.json` are semantically identical.
- The optimized JPEG dimensions are read from JPEG markers rather than PNG offsets.
- Blocker tests query valid parked state and compute collision targets from active geometry.
- Path tests honor `SCENE_TUNING.vehiclePath` rather than hard-coded pre-tuning bounds.
- All 83 tests pass and the Vite build succeeds.
- Active documents report 17 total definitions, 2 playable, 15 planned, and no historical test debt.
- Durable documents contain no machine-specific absolute paths.
- The next active implementation plan is `2026-07-10-star-passenger-feedback.md`.
