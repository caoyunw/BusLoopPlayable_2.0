# Question Passenger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable `question-passenger` mechanic with independent probability and authored-mask modes, in-lab controls, readable hidden passengers, one-shot reveal feedback, and complete automated/browser verification.

**Architecture:** Keep assignment and reveal state in an isolated mechanic runtime. Extend the base game only with generic queue-position and runtime-reconfiguration contracts, extend the mechanic library with a generic detail-view lifecycle, and let SceneView consume snapshot metadata without owning mechanic rules. The level owns fixed authored masks; page-session options own the active mode and chance.

**Tech Stack:** JavaScript ES modules, Node test runner, Three.js, DOM/CSS, Vite, pnpm, system Edge browser QA.

---

## Working Constraints

- Work in `C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab`.
- Read `AGENTS.md`, `docs/project/playable-project-progress.md`, `docs/project/code-navigation.md`, and `docs/superpowers/specs/2026-07-13-question-passenger-design.md` before implementation.
- Keep `question-passenger` marked `planned` through Tasks 1–8.
- Use TDD for each behavior: add a failing focused test, verify the expected failure, add the smallest implementation, rerun the focused test, then commit.
- Do not add external art. Build neutral materials, badges, and reveal flash from Three.js materials and canvas textures.
- Do not persist mechanic settings in `localStorage` or URL state.
- Preserve the current star-passenger behavior and the existing 88-test baseline.

## File Map

**Create:**

- `src/mechanics/question-passenger/model.js`: mode normalization, chance/authored assignment, snapshot cloning, belt reveal lifecycle.
- `src/mechanics/question-passenger/view.js`: detail-panel controls and commit lifecycle.
- `src/mechanics/question-passenger/styles.css`: question-passenger detail controls.
- `test/question-passenger-mechanic.test.js`: focused model, level data, UI, main wiring, and visual contracts.

**Modify:**

- `src/mechanics/question-passenger/index.js`: export runtime and detail-view factories; change status only in Task 9.
- `src/mechanics/index.js`: pass `level` to runtime factories and expose a generic detail-view factory.
- `src/game-model.js`: pass queue coordinates to mechanic hooks and reconfigure active mechanic options.
- `src/level-data.js`: add two fixed boolean authored masks.
- `src/mechanic-library.js`: own generic detail-extension mounting and cleanup.
- `src/main.js`: keep page-session mechanic options and wire detail commits to game reset/reinitialization.
- `src/scene-view.js`: render neutral passengers, per-person question badges, and one-shot reveal feedback.
- `test/game-model.test.js`: generic queue-coordinate and runtime-option regression coverage.
- `test/mechanic-registry.test.js`: detail-extension lifecycle and final registry-count/status coverage.
- `docs/project/code-navigation.md`: add question-passenger ownership and test navigation.
- `docs/project/playable-project-progress.md`, `findings.md`, `task_plan.md`, `progress.md`: record the completed mechanic and exact verification evidence.

---

### Task 1: Question-Passenger Assignment Model

**Files:**

- Create: `src/mechanics/question-passenger/model.js`
- Modify: `src/mechanics/question-passenger/index.js`
- Create: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Write failing assignment/configuration tests**

Create the test file with Node test imports and these cases:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createQuestionPassengerRuntime } from '../src/mechanics/question-passenger/model.js';

const makeLevel = (authoredMasks = [[true, false], [false, true]]) => ({
  mechanics: {
    'question-passenger': { authoredMasks }
  }
});

test('question passenger defaults to chance mode at 30 percent', () => {
  const values = [0.2999, 0.3];
  const runtime = createQuestionPassengerRuntime({
    random: () => values.shift(),
    level: makeLevel()
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'chance',
      chance: 0.3,
      authoredMarked: 2,
      authoredTotal: 4
    }
  });
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
});

test('authored mode reads strict booleans and never calls random', () => {
  let randomCalls = 0;
  const runtime = createQuestionPassengerRuntime({
    random: () => { randomCalls += 1; return 0; },
    level: makeLevel([[true, 1, false], [false, true]]),
    options: { mode: 'authored', chance: 0.9 }
  });

  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 9 }).questionPassenger.hidden, false);
  assert.equal(randomCalls, 0);
});

test('question passenger normalizes invalid mode and chance', () => {
  const invalid = createQuestionPassengerRuntime({
    random: () => 0.2,
    level: makeLevel(),
    options: { mode: 'invalid', chance: Number.NaN }
  });
  const low = createQuestionPassengerRuntime({ random: () => 0, options: { chance: -2 } });
  const high = createQuestionPassengerRuntime({ random: () => 0.999, options: { chance: 4 } });

  assert.equal(invalid.createState().questionPassenger.mode, 'chance');
  assert.equal(invalid.createState().questionPassenger.chance, 0.3);
  assert.equal(low.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, false);
  assert.equal(high.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
});
```

- [ ] **Step 2: Run the new test and confirm the expected failure**

Run:

```powershell
node --test test/question-passenger-mechanic.test.js
```

Expected: FAIL because `src/mechanics/question-passenger/model.js` does not exist.

- [ ] **Step 3: Implement the minimal assignment runtime**

Create `model.js` with these exact contracts:

```js
const DEFAULT_CHANCE = 0.3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeMode(value) {
  return value === 'authored' ? 'authored' : 'chance';
}

function normalizeChance(value) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 1) : DEFAULT_CHANCE;
}

function getAuthoredMasks(level) {
  const masks = level?.mechanics?.['question-passenger']?.authoredMasks;
  return Array.isArray(masks) ? masks : [];
}

function getAuthoredStats(masks) {
  let authoredMarked = 0;
  let authoredTotal = 0;
  for (const row of masks) {
    if (!Array.isArray(row)) continue;
    authoredTotal += row.length;
    authoredMarked += row.filter((value) => value === true).length;
  }
  return { authoredMarked, authoredTotal };
}

export function createQuestionPassengerRuntime({ random = Math.random, level, options = {} } = {}) {
  const mode = normalizeMode(options.mode);
  const chance = normalizeChance(options.chance);
  const authoredMasks = getAuthoredMasks(level);
  const authoredStats = getAuthoredStats(authoredMasks);

  function isHidden(queueIndex, sourceIndex) {
    if (mode === 'authored') return authoredMasks?.[queueIndex]?.[sourceIndex] === true;
    return random() < chance;
  }

  return {
    id: 'question-passenger',
    createState() {
      return {
        questionPassenger: {
          mode,
          chance,
          ...authoredStats
        }
      };
    },
    createQueueItemData({ queueIndex, sourceIndex }) {
      const hidden = isHidden(queueIndex, sourceIndex);
      return {
        questionPassenger: {
          hidden,
          wasHidden: hidden,
          revealVersion: 0
        }
      };
    },
    createSlotData() {
      return { questionPassenger: null };
    }
  };
}
```

Update `question-passenger/index.js`:

```js
import { createQuestionPassengerRuntime } from './model.js';

export const createRuntime = createQuestionPassengerRuntime;
```

Keep `status: 'planned'` and export/default-export the existing definition plus `createRuntime`.

- [ ] **Step 4: Run focused tests and syntax checks**

Run:

```powershell
node --check src/mechanics/question-passenger/model.js
node --check src/mechanics/question-passenger/index.js
node --test test/question-passenger-mechanic.test.js
```

Expected: all three new tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/mechanics/question-passenger/model.js src/mechanics/question-passenger/index.js test/question-passenger-mechanic.test.js
git commit -m "feat: model question passenger assignment"
```

---

### Task 2: Reveal Lifecycle And Snapshot Isolation

**Files:**

- Modify: `src/mechanics/question-passenger/model.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add failing reveal and clone tests**

Append tests that assert queue-to-slot transfer, one version increment, cleanup, and clone isolation:

```js
test('question passenger reveals once when entering the belt', () => {
  const runtime = createQuestionPassengerRuntime({ random: () => 0 });
  const passenger = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const slot = runtime.createSlotData();

  runtime.onPassengerEnteredBelt({ slot, passenger });
  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });

  runtime.onPassengerEnteredBelt({ slot, passenger: { questionPassenger: null } });
  assert.equal(slot.questionPassenger, null);
});

test('question passenger snapshots do not expose mutable runtime objects', () => {
  const runtime = createQuestionPassengerRuntime({ random: () => 0 });
  const item = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const itemSnapshot = runtime.cloneQueueItemSnapshot(item);
  const game = { mechanicState: runtime.createState() };
  const decorated = runtime.decorateSnapshot(game);

  itemSnapshot.questionPassenger.hidden = false;
  decorated.questionPassenger.mode = 'authored';
  assert.equal(item.questionPassenger.hidden, true);
  assert.equal(game.mechanicState.questionPassenger.mode, 'chance');
});

test('question passenger clears slot state after boarding', () => {
  const runtime = createQuestionPassengerRuntime({ random: () => 0 });
  const slot = { questionPassenger: { hidden: false, wasHidden: true, revealVersion: 1 } };
  runtime.clearSlotData({ slot });
  assert.equal(slot.questionPassenger, null);
});
```

- [ ] **Step 2: Run the focused test and confirm missing-method failures**

```powershell
node --test --test-name-pattern "reveals once|snapshots|clears slot" test/question-passenger-mechanic.test.js
```

Expected: FAIL because lifecycle and clone methods are not implemented.

- [ ] **Step 3: Add the lifecycle methods**

Add these methods to the returned runtime object:

```js
cloneQueueItemSnapshot(item) {
  return {
    questionPassenger: item.questionPassenger ? { ...item.questionPassenger } : null
  };
},
cloneSlotSnapshot(slot) {
  return {
    questionPassenger: slot.questionPassenger ? { ...slot.questionPassenger } : null
  };
},
decorateSnapshot(game) {
  return {
    questionPassenger: { ...game.mechanicState.questionPassenger }
  };
},
onPassengerEnteredBelt({ slot, passenger }) {
  const state = passenger.questionPassenger;
  if (!state) {
    slot.questionPassenger = null;
    return;
  }
  slot.questionPassenger = {
    ...state,
    hidden: false,
    revealVersion: state.wasHidden ? state.revealVersion + 1 : state.revealVersion
  };
},
clearSlotData({ slot }) {
  slot.questionPassenger = null;
}
```

- [ ] **Step 4: Run the complete mechanic-model test**

```powershell
node --test test/question-passenger-mechanic.test.js
```

Expected: all assignment and lifecycle tests PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/mechanics/question-passenger/model.js test/question-passenger-mechanic.test.js
git commit -m "feat: reveal question passengers on belt entry"
```

---

### Task 3: Generic Queue Coordinates And Runtime Reconfiguration

**Files:**

- Modify: `src/game-model.js`
- Modify: `test/game-model.test.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add failing generic queue-coordinate tests**

In `test/game-model.test.js`, construct a normal `BusLoopGame`, replace its runtime with a recording runtime, then reset:

```js
test('mechanic queue hooks receive absolute queue coordinates for initial and refill items', () => {
  const game = new BusLoopGame();
  const seen = [];
  game.mechanicRuntime = {
    createState: () => ({}),
    createQueueItemData: ({ queueIndex, sourceIndex }) => {
      seen.push([queueIndex, sourceIndex]);
      return { sourceIndex };
    },
    createSlotData: () => ({}),
    cloneQueueItemSnapshot: () => ({}),
    cloneSlotSnapshot: () => ({}),
    decorateSnapshot: () => ({})
  };

  game.reset();
  assert.deepEqual(seen.slice(0, 3), [[0, 0], [0, 1], [0, 2]]);
  assert.deepEqual(seen.slice(24, 27), [[1, 0], [1, 1], [1, 2]]);
  game.queues[0][0].distanceFromHead = 0;
  game.dequeuePassenger(0, true);
  assert.equal(game.queues[0].at(-1).sourceIndex, 24);
});
```

Use the existing level fixture helper name if it differs; do not create a duplicate helper.

- [ ] **Step 2: Run the test and confirm coordinates are currently undefined**

```powershell
node --test --test-name-pattern "absolute queue coordinates" test/game-model.test.js
```

Expected: FAIL because `createMechanicQueueItemData()` receives no queue or source index.

- [ ] **Step 3: Pass absolute coordinates through both creation paths**

Change initial creation to:

```js
createQueueItems(colors, queueIndex, startIndex = 0) {
  const availableLength = this.queueAvailableLengths?.[queueIndex]
    ?? Math.max(0, (this.level.queueCapacity - 1) * (this.queueSpacing ?? 0.4));
  return colors.map((colorIndex, index) => ({
    id: this.nextPassengerId++,
    colorIndex,
    createdAt: this.time,
    distanceFromHead: Math.min(index * (this.queueSpacing ?? 0.4), availableLength),
    ...this.createMechanicQueueItemData({ queueIndex, sourceIndex: startIndex + index })
  }));
}

createMechanicQueueItemData(context = {}) {
  return this.mechanicRuntime.createQueueItemData?.({ game: this, ...context }) ?? {};
}
```

In `dequeuePassenger`, compute the next absolute index before shifting the raw source color:

```js
const authoredQueue = (this.level.passengerQueues ?? [this.level.passengerSequence])[queueIndex] ?? [];
const sourceIndex = Math.max(0, authoredQueue.length - source.length);
const colorIndex = source.shift();
queue.push({
  id: this.nextPassengerId++,
  colorIndex,
  createdAt: this.time,
  distanceFromHead: clampNumber(
    spawnDistance,
    0,
    this.queueAvailableLengths[queueIndex] ?? spawnDistance
  ),
  ...this.createMechanicQueueItemData({ queueIndex, sourceIndex })
});
```

- [ ] **Step 4: Pass level data into mechanic factories**

Change `configureMechanic` to call:

```js
this.mechanicRuntime = createMechanicRuntime(this.mechanicId, {
  random: this.random,
  level: this.level,
  options: this.mechanicOptions[this.mechanicId] ?? {}
});
```

- [ ] **Step 5: Add and test generic active-option reconfiguration**

Add this method after `setMechanic`:

```js
setMechanicOptions(id, options = {}) {
  this.mechanicOptions[id] = {
    ...(this.mechanicOptions[id] ?? {}),
    ...options
  };
  if (this.mechanicId !== id) return false;
  this.configureMechanic(id);
  this.reset();
  return true;
}
```

Add a test using playable `star-passenger` to prove the method is generic: update `progressTarget`, assert it returns `true`, and assert the reset snapshot uses the new target. Also assert updating an inactive ID returns `false` while retaining the option for later selection.

- [ ] **Step 6: Run focused regressions**

```powershell
node --check src/game-model.js
node --test --test-name-pattern "absolute queue coordinates|active mechanic options|question passenger" test/game-model.test.js test/question-passenger-mechanic.test.js
```

Expected: targeted tests PASS and question runtime receives the level authored masks.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- src/game-model.js test/game-model.test.js test/question-passenger-mechanic.test.js
git commit -m "feat: extend mechanic queue runtime context"
```

---

### Task 4: Fixed Level12 Authored Masks

**Files:**

- Modify: `src/level-data.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add a failing level-data contract test**

```js
import { LEVEL_1 } from '../src/level-data.js';

test('level12 provides two complete fixed question passenger masks', () => {
  const masks = LEVEL_1.mechanics['question-passenger'].authoredMasks;
  assert.equal(masks.length, 2);
  masks.forEach((mask, queueIndex) => {
    assert.equal(mask.length, LEVEL_1.passengerQueues[queueIndex].length);
    assert.equal(mask.every((value) => typeof value === 'boolean'), true);
  });
  assert.equal(masks.flat().filter(Boolean).length, 132);
});
```

- [ ] **Step 2: Run the test and confirm the level field is absent**

```powershell
node --test --test-name-pattern "complete fixed question passenger masks" test/question-passenger-mechanic.test.js
```

Expected: FAIL while reading `LEVEL_1.mechanics`.

- [ ] **Step 3: Add deterministic boolean arrays to level data**

After `LEVEL12_PASSENGER_QUEUES`, create two frozen boolean arrays. The two residue sets produce 66 marked items per 219-item queue, 132/438 overall:

```js
const QUESTION_PASSENGER_AUTHORED_MASKS = Object.freeze([
  Object.freeze(LEVEL12_PASSENGER_QUEUES[0].map((_, index) => [0, 3, 7].includes(index % 10))),
  Object.freeze(LEVEL12_PASSENGER_QUEUES[1].map((_, index) => [1, 5, 8].includes(index % 10)))
]);
```

Add this frozen level-owned configuration inside `LEVEL_1`:

```js
mechanics: Object.freeze({
  'question-passenger': Object.freeze({
    authoredMasks: QUESTION_PASSENGER_AUTHORED_MASKS
  })
}),
```

- [ ] **Step 4: Verify fixed masks and authored runtime behavior**

```powershell
node --check src/level-data.js
node --test --test-name-pattern "fixed question passenger masks|authored mode" test/question-passenger-mechanic.test.js
```

Expected: both tests PASS; authored mode reports 132 marked of 438 total and uses no random calls.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- src/level-data.js test/question-passenger-mechanic.test.js
git commit -m "feat: author fixed question passenger masks"
```

---

### Task 5: Generic Detail Extension And Mechanic Controls

**Files:**

- Create: `src/mechanics/question-passenger/view.js`
- Create: `src/mechanics/question-passenger/styles.css`
- Modify: `src/mechanics/question-passenger/index.js`
- Modify: `src/mechanics/index.js`
- Modify: `src/mechanic-library.js`
- Modify: `test/mechanic-registry.test.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Write failing detail-extension lifecycle tests**

Extend the existing mechanic-library DOM fixture and assert:

```js
test('mechanic detail extension mounts, replaces, and destroys cleanly', () => {
  const fixture = createLibraryFixture();
  const destroyed = [];
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const library = createMechanicLibrary(fixture.root, {
    mechanics,
    activeId: 'alpha',
    renderDetailExtension: ({ mechanic, document }) => {
      const element = document.createElement('div');
      element.dataset.extensionId = mechanic.id;
      return { element, destroy: () => destroyed.push(mechanic.id) };
    }
  });

  assert.equal(fixture.detail.querySelector('[data-extension-id="alpha"]') !== null, true);
  library.setActive('beta');
  assert.deepEqual(destroyed, ['alpha']);
  library.destroy();
  assert.deepEqual(destroyed, ['alpha', 'beta']);
  fixture.restore();
});
```

- [ ] **Step 2: Run and confirm the extension is not mounted**

```powershell
node --test --test-name-pattern "detail extension mounts" test/mechanic-registry.test.js
```

Expected: FAIL because `renderDetailExtension` is ignored.

- [ ] **Step 3: Implement the generic detail-extension lifecycle**

Add `renderDetailExtension = () => null` to the library options. Track the active extension cleanup:

```js
let destroyDetailExtension = () => {};

function clearDetailExtension() {
  destroyDetailExtension();
  destroyDetailExtension = () => {};
}
```

At the start of `renderDetail()`, call `clearDetailExtension()`. After the standard category block is appended, mount the returned extension:

```js
const extension = renderDetailExtension({ mechanic, document });
if (extension?.element) {
  detail.append(extension.element);
  destroyDetailExtension = typeof extension.destroy === 'function'
    ? extension.destroy
    : () => {};
}
```

Call `clearDetailExtension()` inside `destroy()` before removing library listeners.

- [ ] **Step 4: Write failing question settings tests**

In `test/mechanic-registry.test.js`, extend `FakeElement.matches()` so the existing fixture supports the data selectors used by the settings view:

```js
const dataSelector = selector.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
if (dataSelector) {
  const key = dataSelector[1].replace(/-([a-z])/g, (_, character) => character.toUpperCase());
  if (!Object.hasOwn(this.dataset, key)) return false;
  return dataSelector[2] === undefined || this.dataset[key] === dataSelector[2];
}
```

Then test the exported builder with the fixture document in the same file:

```js
import { createQuestionPassengerDetailView } from '../src/mechanics/question-passenger/view.js';

test('question passenger controls commit mode and chance once per change', () => {
  const fixture = createLibraryFixture();
  const commits = [];
  const extension = createQuestionPassengerDetailView({
    document: fixture.document,
    options: { mode: 'chance', chance: 0.3 },
    state: { questionPassenger: { authoredMarked: 132, authoredTotal: 438 } },
    onCommit: (options) => commits.push(options)
  });
  fixture.detail.append(extension.element);

  const mode = fixture.detail.querySelector('[data-question-mode]');
  const chance = fixture.detail.querySelector('[data-question-chance]');
  const output = fixture.detail.querySelector('[data-question-chance-output]');
  mode.value = 'authored';
  mode.dispatchEvent({ type: 'change', bubbles: false });
  assert.deepEqual(commits.at(-1), { mode: 'authored', chance: 0.3 });

  mode.value = 'chance';
  mode.dispatchEvent({ type: 'change', bubbles: false });
  chance.value = '45';
  chance.dispatchEvent({ type: 'input', bubbles: false });
  assert.equal(output.textContent, '45%');
  assert.equal(commits.length, 2);
  chance.dispatchEvent({ type: 'change', bubbles: false });
  assert.deepEqual(commits.at(-1), { mode: 'chance', chance: 0.45 });

  extension.destroy();
  fixture.restore();
});
```

- [ ] **Step 5: Implement the accessible controls**

Create `view.js` with `import './styles.css'` and a builder returning `{ element, destroy }`. Use:

```js
export function createQuestionPassengerDetailView({
  document,
  options = {},
  state = {},
  onCommit = () => {}
} = {}) {
  const current = {
    mode: options.mode === 'authored' ? 'authored' : 'chance',
    chance: Number.isFinite(Number(options.chance))
      ? Math.max(0, Math.min(1, Number(options.chance)))
      : 0.3
  };
  const root = document.createElement('section');
  root.className = 'question-passenger-settings';
  root.dataset.questionPassengerSettings = '';

  const heading = document.createElement('h3');
  heading.textContent = '机制设置';
  const modeLabel = document.createElement('label');
  modeLabel.textContent = '生成方式';
  const mode = document.createElement('select');
  mode.dataset.questionMode = '';
  const chanceOption = document.createElement('option');
  chanceOption.value = 'chance';
  chanceOption.textContent = '概率随机';
  const authoredOption = document.createElement('option');
  authoredOption.value = 'authored';
  authoredOption.textContent = '关卡标记';
  mode.append(chanceOption, authoredOption);
  mode.value = current.mode;
  modeLabel.append(mode);

  const chanceRow = document.createElement('label');
  chanceRow.className = 'question-passenger-chance';
  chanceRow.textContent = '问号概率';
  const chance = document.createElement('input');
  chance.type = 'range';
  chance.min = '0';
  chance.max = '100';
  chance.step = '1';
  chance.value = String(Math.round(current.chance * 100));
  chance.dataset.questionChance = '';
  const output = document.createElement('output');
  output.dataset.questionChanceOutput = '';
  output.textContent = `${chance.value}%`;
  chanceRow.append(chance, output);

  const authored = document.createElement('p');
  authored.className = 'question-passenger-authored-summary';
  authored.textContent = `固定标记：${state.questionPassenger?.authoredMarked ?? 0}/${state.questionPassenger?.authoredTotal ?? 0} 组`;

  function syncMode() {
    const authoredMode = current.mode === 'authored';
    chanceRow.hidden = authoredMode;
    authored.hidden = !authoredMode;
  }
  function handleModeChange() {
    current.mode = mode.value === 'authored' ? 'authored' : 'chance';
    syncMode();
    onCommit({ ...current });
  }
  function handleChanceInput() {
    output.textContent = `${chance.value}%`;
  }
  function handleChanceChange() {
    current.chance = Number(chance.value) / 100;
    onCommit({ ...current });
  }

  mode.addEventListener('change', handleModeChange);
  chance.addEventListener('input', handleChanceInput);
  chance.addEventListener('change', handleChanceChange);
  root.append(heading, modeLabel, chanceRow, authored);
  syncMode();

  return {
    element: root,
    destroy() {
      mode.removeEventListener('change', handleModeChange);
      chance.removeEventListener('input', handleChanceInput);
      chance.removeEventListener('change', handleChanceChange);
    }
  };
}
```

Style a bordered compact block, full-width select/range, tabular output, visible focus rings, and no overflow at the existing 860px mobile breakpoint.

- [ ] **Step 6: Expose the detail factory generically**

Export `createDetailView = createQuestionPassengerDetailView` from the question module. In `src/mechanics/index.js`, add:

```js
export function createMechanicDetailView(id, context = {}) {
  return getMechanicModuleById(id)?.createDetailView?.(context) ?? null;
}
```

- [ ] **Step 7: Run focused UI tests**

```powershell
node --check src/mechanic-library.js
node --check src/mechanics/question-passenger/view.js
node --test --test-name-pattern "detail extension|question passenger controls" test/mechanic-registry.test.js test/question-passenger-mechanic.test.js
```

Expected: extension cleanup and control commit tests PASS.

- [ ] **Step 8: Commit Task 5**

```powershell
git add -- src/mechanic-library.js src/mechanics/index.js src/mechanics/question-passenger/index.js src/mechanics/question-passenger/view.js src/mechanics/question-passenger/styles.css test/mechanic-registry.test.js test/question-passenger-mechanic.test.js
git commit -m "feat: add question passenger lab controls"
```

---

### Task 6: Neutral Queue Appearance And Question Badges

**Files:**

- Modify: `src/scene-view.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add failing scene contracts**

Read `src/scene-view.js` as text and assert that the scene includes a neutral material helper, four question badges per group, a hidden-state appearance cache, and queue snapshot wiring:

```js
test('scene renders hidden question groups with neutral material and four badges', () => {
  const source = readFileSync(join('src', 'scene-view.js'), 'utf8');
  assert.match(source, /applyQuestionPassengerMaterial/);
  assert.match(source, /questionBadges/);
  assert.match(source, /Array\.from\(\{ length: 4 \}/);
  assert.match(source, /questionPassenger\?\.hidden/);
  assert.match(source, /questionPassengerHidden/);
});
```

- [ ] **Step 2: Run and confirm the visual helpers are absent**

```powershell
node --test --test-name-pattern "neutral material and four badges" test/question-passenger-mechanic.test.js
```

Expected: FAIL on the first missing scene contract.

- [ ] **Step 3: Add a neutral material helper that preserves reveal restoration**

Add:

```js
function applyQuestionPassengerMaterial(material) {
  setPassengerMaterialMaps(material, null, null);
  material.color.setHex(0x9da8b8);
  material.emissive.setHex(0x303946);
  material.emissiveIntensity = 0.18;
  material.roughness = 0.72;
  material.metalness = 0;
  material.userData.passengerColorIndex = null;
}
```

Replace the color-only cache with an appearance cache:

```js
setPassengerAppearance(view, colorIndex, hidden = false) {
  if (
    view.userData.colorIndex === colorIndex
    && view.userData.questionPassengerHidden === hidden
  ) return;
  view.userData.colorIndex = colorIndex;
  view.userData.questionPassengerHidden = hidden;

  for (const slot of view.userData.personSlots) {
    const material = slot.userData.vatMaterial ?? slot.userData.fallback?.material;
    if (!material) continue;
    if (hidden) {
      applyQuestionPassengerMaterial(material);
    } else if (slot.userData.vatMaterial) {
      const map = this.passengerColorTextures[colorIndex] ?? this.passengerColorTextures[0];
      applyPassengerMaterial(material, colorIndex, map);
    } else {
      material.color.setHex(COLORS[colorIndex].hex);
    }
  }
  for (const badge of view.userData.questionBadges ?? []) {
    badge.visible = hidden;
    badge.material.opacity = 1;
  }
}
```

All existing callers of `setPassengerColor` must move to `setPassengerAppearance`.

At the end of `updatePassengerMaterialTuning`, clear `view.userData.questionPassengerHidden` for all passenger roots. This forces the next scene update to reapply the neutral material to hidden queue groups after editor-driven material changes.

- [ ] **Step 4: Create four high-contrast canvas badges per passenger group**

Build one canvas texture per group and four sprites sharing that texture. Draw a white circular badge with dark outline and `?`, set `depthTest: false`, `depthWrite: false`, `toneMapped: false`, and a render order above passengers. Store sprites in `group.userData.questionBadges` using:

```js
const questionBadges = Array.from({ length: 4 }, (_, index) => {
  const sprite = new THREE.Sprite(material.clone());
  sprite.position.set((index - 1.5) * spacing, 0.5, 0.03);
  sprite.scale.set(0.18, 0.18, 1);
  sprite.visible = false;
  sprite.renderOrder = 86;
  group.add(sprite);
  return sprite;
});
group.userData.questionBadges = questionBadges;
```

When passenger spacing is tuned, update badge X positions together with `personSlots`.

- [ ] **Step 5: Wire queue and belt appearance separately**

For conveyor slots, always render the real color and let Task 7 own the reveal overlay:

```js
this.setPassengerAppearance(view, slot.colorIndex, false);
```

For waiting queue items, use snapshot metadata:

```js
this.setPassengerAppearance(view, colorIndex, Boolean(item.questionPassenger?.hidden));
```

When a view becomes invisible, hide its question badges and clear its cached hidden state so a reused view cannot leak the previous appearance.

- [ ] **Step 6: Run focused scene contracts and existing syntax checks**

```powershell
node --check src/scene-view.js
node --test --test-name-pattern "neutral material and four badges|star passenger" test/question-passenger-mechanic.test.js test/star-passenger-mechanic.test.js
```

Expected: question appearance contract PASS; star badge contracts remain PASS.

- [ ] **Step 7: Commit Task 6**

```powershell
git add -- src/scene-view.js test/question-passenger-mechanic.test.js
git commit -m "feat: render hidden question passenger groups"
```

---

### Task 7: One-Shot Reveal Feedback And Reduced Motion

**Files:**

- Modify: `src/scene-view.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add failing reveal-feedback contracts**

```js
test('scene reveal feedback deduplicates by passenger and respects reduced motion', () => {
  const source = readFileSync(join('src', 'scene-view.js'), 'utf8');
  assert.match(source, /QUESTION_PASSENGER_REVEAL_DURATION\s*=\s*0\.25/);
  assert.match(source, /questionPassengerRevealVersion/);
  assert.match(source, /questionPassengerRevealStartedAt/);
  assert.match(source, /reducedMotionQuery\?\.matches/);
  assert.match(source, /questionRevealFlash/);
});
```

- [ ] **Step 2: Run and confirm reveal state is absent**

```powershell
node --test --test-name-pattern "reveal feedback deduplicates" test/question-passenger-mechanic.test.js
```

Expected: FAIL on the missing duration or reveal state.

- [ ] **Step 3: Add a reusable flash sprite to each group**

Create a radial white canvas texture, mount a hidden sprite behind the question badges, and store it as `group.userData.questionRevealFlash`. The sprite must use `pointer-events`-independent Three.js rendering, `depthTest: false`, and no external asset.

- [ ] **Step 4: Implement one-shot reveal state**

Add:

```js
const QUESTION_PASSENGER_REVEAL_DURATION = 0.25;
```

Implement:

```js
updateQuestionPassengerReveal(view, state, time, passengerId) {
  const version = state?.revealVersion ?? 0;
  const changedPassenger = view.userData.questionPassengerId !== passengerId;
  const changedVersion = version > (view.userData.questionPassengerRevealVersion ?? 0);
  if (changedPassenger) {
    view.userData.questionPassengerId = passengerId;
    view.userData.questionPassengerRevealVersion = 0;
    view.userData.questionPassengerRevealStartedAt = -Infinity;
  }
  if (state?.wasHidden && (changedPassenger || changedVersion) && version > 0) {
    view.userData.questionPassengerRevealVersion = version;
    view.userData.questionPassengerRevealStartedAt = time;
  }

  const elapsed = time - (view.userData.questionPassengerRevealStartedAt ?? -Infinity);
  const progress = elapsed >= 0 && elapsed < QUESTION_PASSENGER_REVEAL_DURATION
    ? elapsed / QUESTION_PASSENGER_REVEAL_DURATION
    : 1;
  const active = progress < 1;
  const reduceMotion = Boolean(this.reducedMotionQuery?.matches);
  const pulse = active && !reduceMotion ? 1 + Math.sin(progress * Math.PI) * 0.08 : 1;
  view.scale.setScalar(SCENE_TUNING.passengers.modelScale * pulse);

  const flash = view.userData.questionRevealFlash;
  if (flash) {
    flash.visible = active;
    flash.scale.setScalar(reduceMotion ? 0.42 : 0.32 + progress * 0.22);
    flash.material.opacity = active ? 1 - progress : 0;
  }
  for (const badge of view.userData.questionBadges ?? []) {
    badge.visible = active;
    badge.material.opacity = active ? 1 - progress : 1;
  }
}
```

Call it for visible belt slots after applying the real color. Queue views do not call it. Empty belt slots call a reset helper that clears IDs, versions, flash visibility, badge opacity, and base scale.

- [ ] **Step 5: Verify normal and reduced-motion source contracts**

```powershell
node --check src/scene-view.js
node --test --test-name-pattern "reveal feedback|neutral material" test/question-passenger-mechanic.test.js
```

Expected: reveal contracts PASS and no syntax errors.

- [ ] **Step 6: Commit Task 7**

```powershell
git add -- src/scene-view.js test/question-passenger-mechanic.test.js
git commit -m "feat: animate question passenger reveals"
```

---

### Task 8: Page-Session Wiring And Reset Semantics

**Files:**

- Modify: `src/main.js`
- Modify: `test/question-passenger-mechanic.test.js`

- [ ] **Step 1: Add failing source-level integration contracts**

```js
test('main wires question passenger session options through generic detail views', () => {
  const main = readFileSync(join('src', 'main.js'), 'utf8');
  const mechanics = readFileSync(join('src', 'mechanics', 'index.js'), 'utf8');
  assert.match(main, /mechanicSessionOptions/);
  assert.match(main, /renderDetailExtension/);
  assert.match(main, /setMechanicOptions/);
  assert.match(main, /createMechanicDetailView/);
  assert.match(mechanics, /export function createMechanicDetailView/);
});
```

- [ ] **Step 2: Run and confirm main is not wired**

```powershell
node --test --test-name-pattern "session options through generic detail views" test/question-passenger-mechanic.test.js
```

Expected: FAIL on the first missing integration symbol.

- [ ] **Step 3: Add page-session defaults and pass them to the game**

Inside `startRuntime()` before game construction:

```js
const mechanicSessionOptions = {
  'question-passenger': { mode: 'chance', chance: 0.3 }
};
const game = new BusLoopGame(LEVEL_1, {
  mechanicId: initialMechanicId,
  mechanics: mechanicSessionOptions
});
```

Do not store this object outside `startRuntime()` and do not read/write browser storage.

- [ ] **Step 4: Implement the generic detail renderer and commit callback**

Import `createMechanicDetailView`. Add:

```js
function applyMechanicOptions(id, options) {
  mechanicSessionOptions[id] = {
    ...(mechanicSessionOptions[id] ?? {}),
    ...options
  };
  resetMechanicUi();
  if (game.setMechanicOptions(id, mechanicSessionOptions[id])) {
    game.initializeQueues(
      view.getQueueCapacities(),
      view.getQueueSpacing(),
      view.getQueueLengths(),
      view.getConveyorPathLength()
    );
  }
  syncHud(game.snapshot());
}

function renderDetailExtension({ mechanic, document }) {
  return createMechanicDetailView(mechanic.id, {
    document,
    options: mechanicSessionOptions[mechanic.id],
    state: game.snapshot(),
    onCommit: (options) => applyMechanicOptions(mechanic.id, options)
  });
}
```

Pass `renderDetailExtension` to `createMechanicLibrary`. Because the options object lives for the page session, switching away and back preserves the selected mode/chance; a page refresh recreates defaults.

- [ ] **Step 5: Run integration syntax and focused tests**

```powershell
node --check src/main.js
node --test --test-name-pattern "session options|detail extension|question passenger controls" test/question-passenger-mechanic.test.js test/mechanic-registry.test.js
```

Expected: all non-skipped integration contracts PASS.

- [ ] **Step 6: Commit Task 8**

```powershell
git add -- src/main.js test/question-passenger-mechanic.test.js
git commit -m "feat: wire question passenger session settings"
```

---

### Task 9: Activation, Full Verification, Browser QA, And Handoff

**Files:**

- Modify: `src/mechanics/question-passenger/index.js`
- Modify: `test/question-passenger-mechanic.test.js`
- Modify: `test/game-model.test.js`
- Modify: `test/mechanic-registry.test.js`
- Modify: `docs/project/code-navigation.md`
- Modify: `docs/project/playable-project-progress.md`
- Modify: `findings.md`
- Modify: `task_plan.md`
- Modify: `progress.md`

- [ ] **Step 1: Confirm implementation is usable before activation**

Run all focused tests while the registry entry is still `planned`:

```powershell
node --test test/question-passenger-mechanic.test.js
node --test --test-name-pattern "question passenger|mechanic queue hooks|detail extension" test/game-model.test.js test/mechanic-registry.test.js
node --check src/mechanics/question-passenger/model.js
node --check src/mechanics/question-passenger/view.js
node --check src/scene-view.js
node --check src/main.js
```

Expected: every non-skipped focused test PASS and all syntax checks exit 0.

- [ ] **Step 2: Activate the mechanic locally and add the active-runtime regression**

Change only:

```js
status: 'playable',
```

Update registry expectations from 2 playable/15 planned to 3 playable/14 planned, and assert `resolvePlayableMechanicId('question-passenger')` resolves to itself.

Add the now-runnable game-model regression:

```js
test('active question passenger options reconfigure and reset the runtime', () => {
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: 'question-passenger',
    random: () => 0.99,
    mechanics: {
      'question-passenger': { mode: 'chance', chance: 0.3 }
    }
  });
  game.update(0.5);

  assert.equal(game.setMechanicOptions('question-passenger', { mode: 'authored' }), true);
  const state = game.snapshot();
  assert.equal(state.time, 0);
  assert.equal(state.questionPassenger.mode, 'authored');
  assert.equal(state.questionPassenger.authoredMarked, 132);
  assert.equal(state.questionPassenger.authoredTotal, 438);
});
```

- [ ] **Step 3: Run focused tests, the full suite, and production build**

```powershell
node --test test/question-passenger-mechanic.test.js
pnpm test
pnpm run build
```

Expected: focused and full suites PASS; build exits 0 with only the already-known Vite chunk-size warning.

- [ ] **Step 4: Run actual Edge browser QA**

Read `docs/project/platform-manual-validation-checklist.md` and `docs/playable/browser-automation.md`. Start the Vite development server, then verify `?mechanic=question-passenger` in system Edge at desktop and 390×844 mobile dimensions.

For each viewport:

1. Confirm the mechanism is interactive and the planned overlay is absent.
2. Confirm default controls show “概率随机” and 30%.
3. Confirm only some waiting groups are neutral gray with four readable question badges.
4. Confirm belt passengers always show real colors.
5. Watch at least five hidden groups enter the belt; each must reveal once with short flash/pop and no input blocking.
6. Reset twice; chance-mode question positions must change while real queue colors remain fixed.
7. Switch to authored mode; confirm the detail summary reports 132/438 and repeated resets preserve the same positions.
8. Set probability to 0%, then 100%; confirm the next reset produces none, then all waiting groups as question groups.
9. Switch to another mechanic and back; the page-session setting must remain. Refresh; it must return to chance/30%.
10. Confirm mobile drawer controls fit without horizontal overflow.

Repeat the reveal check with `prefers-reduced-motion: reduce`: real color and brightness change remain, but no scale/pop motion occurs.

Record console, page, and network errors. Expected: none.

- [ ] **Step 5: Fix any QA defect before documenting completion**

If any automated or browser gate fails, keep the status change uncommitted, add a focused failing test for the defect, fix it, rerun the narrow check, then repeat Steps 3 and 4. Do not update completion docs until every gate passes.

- [ ] **Step 6: Update navigation and durable project docs**

Update `docs/project/code-navigation.md` with rows for:

- question-passenger assignment/reveal rules → `model.js` + focused test;
- question-passenger settings → `view.js`/`styles.css` + focused test;
- question-passenger scene appearance → `scene-view.js` + focused test;
- generic mechanic detail extension → `mechanic-library.js` + registry test.

Correct the registry responsibility text so definitions are owned by `src/mechanics/*/index.js` and aggregated by `src/mechanics/index.js`; `src/mechanic-registry.js` owns frozen lookup/filter APIs.

Update the remaining project docs with concise durable facts:

- 17 definitions: 3 playable and 14 planned.
- Both question-passenger modes and the 30% default.
- Fixed authored mask count 132/438.
- Neutral gray + badge appearance, one-shot reveal, and reduced-motion behavior.
- Copy the exact passing test count and build result from Step 3.
- Record desktop, 390×844, reduced-motion, console, page, and network QA results.
- Mark question-passenger complete and set the next task to selecting the next planned mechanic; do not invent a next mechanic priority.

- [ ] **Step 7: Re-run doc-sensitive checks and inspect the final diff**

```powershell
node --test test/question-passenger-mechanic.test.js test/mechanic-registry.test.js
git diff --check
git status --short
```

Expected: tests PASS, `git diff --check` prints nothing, and status lists only the intended mechanic, test, and documentation files.

- [ ] **Step 8: Commit the verified playable mechanic and handoff docs**

```powershell
git add -- src/mechanics/question-passenger/index.js test/question-passenger-mechanic.test.js test/game-model.test.js test/mechanic-registry.test.js docs/project/code-navigation.md docs/project/playable-project-progress.md findings.md task_plan.md progress.md
git commit -m "docs: complete question passenger mechanic"
```

If browser-QA fixes changed source files after Task 8, include those exact source files in the final commit as well.

- [ ] **Step 9: Final verification after commit**

```powershell
git status --short --branch
git log -10 --oneline
```

Expected: clean working tree, branch ahead only by the intentional plan/implementation commits, and the recent log shows the focused TDD commits followed by the verified completion commit.

---

## Plan Self-Review Checklist

- Every approved design requirement maps to a task: two independent modes, 30% default, reset reroll, full boolean masks, detail controls, session-only settings, neutral appearance, per-person badges, immediate reveal, reduced motion, tests, build, browser QA, activation, and docs.
- Runtime property names are consistent throughout: `questionPassenger`, `hidden`, `wasHidden`, `revealVersion`, `authoredMasks`, `authoredMarked`, `authoredTotal`, `mode`, and `chance`.
- The base game receives only generic extensions; probability and mask decisions remain in the mechanic model.
- `question-passenger` remains `planned` until implementation and focused checks are usable; final activation is isolated in Task 9 and committed only after full/browser gates pass.
- No new external assets, storage keys, URL parameters, mechanism stacking, or unrelated refactors are included.
