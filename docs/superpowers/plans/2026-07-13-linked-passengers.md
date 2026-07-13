# Linked Passengers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the independently selectable `linked-passengers` mechanic with chance and authored assignment modes, atomic queue admission, atomic conveyor entry, capacity-aware atomic boarding, approved connector/boarding visuals, page-session settings, and complete automated/browser verification.

**Architecture:** `src/mechanics/linked-passengers/model.js` owns chain planning, authored validation, chain metadata, and mechanic batch hooks. `src/game-model.js` remains mechanic-agnostic by consuming four optional batch contracts—queue admission size, belt-entry batch, boarding batch, and aggregate boarding metadata—with scalar behavior as the default. `src/scene-view.js` renders connector segments and aggregate boarding feedback from snapshot/event metadata, while the mechanic detail view owns settings controls.

**Tech Stack:** JavaScript ES modules, Node built-in test runner, Three.js, DOM test doubles already used in the repository, Vite, in-app browser QA.

---

## File Structure And Responsibility Map

| File | Responsibility after this plan |
| --- | --- |
| `src/mechanics/linked-passengers/index.js` | Definition, planned/playable release gate, runtime/detail exports. |
| `src/mechanics/linked-passengers/model.js` | Chance/authored chain plans, validation, summaries, queue/slot metadata, batch hook implementations. |
| `src/mechanics/linked-passengers/view.js` | Page-session mode, chance, and maximum-length controls plus authored summary. |
| `src/mechanics/linked-passengers/styles.css` | Mechanic detail control layout, focus, and narrow-width behavior. |
| `src/game-model.js` | Generic batch admission, atomic belt allocation, atomic capacity-aware boarding, batch event snapshots. |
| `src/level-data.js` | Frozen Level 12 authored chain-start rows. |
| `src/scene-view.js` | Top connector segments/`×N` badge, aggregate 250 ms fan-in, one smoke/audio/pulse, reduced-motion branch. |
| `src/main.js` | Fresh page-session defaults for `linked-passengers`; existing generic commit/reset flow remains unchanged. |
| `src/styles.css` | Imports the mechanic-owned settings stylesheet. |
| `test/linked-passengers-mechanic.test.js` | Focused model, model/view integration, atomic gameplay, visual-contract, and reduced-motion tests. |
| `test/game-model.test.js` | Generic runtime/session-option and base-regression contracts. |
| `test/mechanic-registry.test.js` | Detail factory, stylesheet import, status/count release gate. |
| `test/mechanic-architecture.test.js` | Module ownership and “no mechanic ID branch in game model” contract. |
| `docs/project/code-navigation.md` | Adds the new source/test ownership routes and updates baseline counts. |
| `docs/project/playable-project-progress.md`, `task_plan.md`, `progress.md` | Durable completion, verification, and next-mechanic handoff only after all gates pass. |

## Fixed Runtime Contracts

All implementation tasks use these exact optional mechanic-runtime hooks:

```js
getQueueAdmissionBatchSize({ game, queueIndex, sourceIndex, sourceColors })
getBeltEntryBatch({ game, queueIndex, queue })
getBoardingBatch({ game, slot, slots })
onPassengerBatchBoarded({ game, slots, vehicle })
```

The generic defaults are respectively `1`, `[queue[0]]`, `[slot]`, and the existing scalar `onPassengerBoarded({ game, slot: slots[0], vehicle })`. No `linked-passengers` string check belongs in `src/game-model.js`.

Each linked row carries this exact snapshot-safe payload:

```js
{
  linkedPassenger: {
    chainId: 'linked-<queueIndex>-<sourceIndex>',
    length: 2,
    memberIndex: 0,
    isHead: true
  }
}
```

Boarding events preserve the scalar compatibility fields and add aggregate fields:

```js
{
  passengerId: 1,
  passengerIds: [1, 2],
  slotIndex: 0,
  slotIndices: [0, 31],
  progress: 0.61,
  progresses: [0.61, 0.57875],
  groupCount: 2,
  linkedPassenger: { chainId: 'linked-0-0', length: 2 }
}
```

## Task 1: Build And Validate Linked Chain Plans

**Files:**
- Create: `src/mechanics/linked-passengers/model.js`
- Modify: `src/mechanics/linked-passengers/index.js:1-12`
- Create: `test/linked-passengers-mechanic.test.js`

- [ ] **Step 1: Write focused failing tests for chance mode, authored mode, and invalid authored candidates**

Add the imports and fixtures below to the new test file:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import linkedPassengerMechanic, {
  createRuntime
} from '../src/mechanics/linked-passengers/index.js';
import { createLinkedPassengerRuntime } from '../src/mechanics/linked-passengers/model.js';

function makeLevel(passengerQueues, authoredStarts = []) {
  return {
    passengerQueues,
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0 },
      { id: 2, seats: 10, colorIndex: 0 }
    ],
    mechanics: {
      'linked-passengers': { authoredStarts }
    }
  };
}

test('chance mode creates multiple non-overlapping same-color chains with uniform bounded lengths', () => {
  const values = [0, 0.999, 0, 0];
  const runtime = createLinkedPassengerRuntime({
    level: makeLevel([[0, 0, 0, 0, 0, 1, 1, 1]]),
    options: { mode: 'chance', chance: 1, maxLength: 4 },
    random: () => values.shift() ?? 1
  });

  assert.deepEqual(runtime.createState().linkedPassenger, {
    mode: 'chance',
    chance: 1,
    maxLength: 4,
    maxVehicleSeats: 10,
    chainCount: 2,
    linkedGroupCount: 6,
    invalidAuthoredCount: 0
  });
  assert.deepEqual(
    [0, 1, 2, 3].map((sourceIndex) => (
      runtime.createQueueItemData({ queueIndex: 0, sourceIndex }).linkedPassenger.memberIndex
    )),
    [0, 1, 2, 3]
  );
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 4 }).linkedPassenger, null);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 5 }).linkedPassenger.length, 2);
});

test('authored mode accepts valid earlier chains and continues scanning after invalid starts', () => {
  const warnings = [];
  const runtime = createLinkedPassengerRuntime({
    level: makeLevel(
      [[0, 0, 0, 1, 1, 1, 1, 2, 2]],
      [[2, 3, 0, 5, 0, 0, 0, 2, 0, 9]]
    ),
    options: { mode: 'authored' },
    random() {
      throw new Error('authored mode must not call random');
    },
    warn: (message) => warnings.push(message)
  });

  const state = runtime.createState().linkedPassenger;
  assert.equal(state.chainCount, 2);
  assert.equal(state.linkedGroupCount, 4);
  assert.equal(state.invalidAuthoredCount, 3);
  assert.equal(warnings.length, 1);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).linkedPassenger.length, 2);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).linkedPassenger.memberIndex, 1);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 3 }).linkedPassenger, null);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 7 }).linkedPassenger.length, 2);
  runtime.createState();
  assert.equal(warnings.length, 1);
});

test('linked runtime normalizes options and clones queue and slot metadata', () => {
  const runtime = createRuntime({
    level: makeLevel([[0, 0, 0]]),
    options: { mode: 'wrong', chance: 4, maxLength: 99 },
    random: () => 1
  });
  const state = runtime.createState().linkedPassenger;
  assert.equal(runtime.id, 'linked-passengers');
  assert.equal(state.mode, 'chance');
  assert.equal(state.chance, 1);
  assert.equal(state.maxLength, 10);
  assert.deepEqual(runtime.createSlotData(), { linkedPassenger: null });
  const item = { linkedPassenger: { chainId: 'linked-0-0', length: 2, memberIndex: 0, isHead: true } };
  assert.notEqual(runtime.cloneQueueItemSnapshot(item).linkedPassenger, item.linkedPassenger);
  assert.equal(linkedPassengerMechanic.definition.status, 'planned');
});

test('chance plans reroll on createState while authored plans remain deterministic', () => {
  const values = [0, 0, 1];
  const runtime = createLinkedPassengerRuntime({
    level: makeLevel([[0, 0]]),
    options: { mode: 'chance', chance: 0.5, maxLength: 2 },
    random: () => values.shift()
  });
  assert.equal(runtime.createState().linkedPassenger.chainCount, 1);
  assert.equal(runtime.createState().linkedPassenger.chainCount, 0);
});

test('authored mode safely ignores missing and non-array start rows', () => {
  const warnings = [];
  const runtime = createLinkedPassengerRuntime({
    level: {
      ...makeLevel([[0, 0], [1, 1]]),
      mechanics: { 'linked-passengers': { authoredStarts: ['bad', null] } }
    },
    options: { mode: 'authored' },
    warn: (message) => warnings.push(message)
  });
  assert.deepEqual(runtime.createState().linkedPassenger, {
    mode: 'authored',
    chance: 0.3,
    maxLength: 10,
    maxVehicleSeats: 10,
    chainCount: 0,
    linkedGroupCount: 0,
    invalidAuthoredCount: 0
  });
  assert.equal(warnings.length, 0);
});
```

- [ ] **Step 2: Run the new test and confirm the missing-module failure**

Run:

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: failure because `src/mechanics/linked-passengers/model.js` does not exist and `createRuntime` is not exported.

- [ ] **Step 3: Implement deterministic chance/authored planners and snapshot metadata**

Create `src/mechanics/linked-passengers/model.js` with these concrete rules:

```js
const DEFAULT_CHANCE = 0.3;
const MIN_CHAIN_LENGTH = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeChance(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : DEFAULT_CHANCE;
}

function getMaxVehicleSeats(level) {
  return Math.max(
    MIN_CHAIN_LENGTH,
    ...((level?.vehicles ?? []).map((vehicle) => Number(vehicle.seats) || 0))
  );
}

function normalizeMaxLength(value, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return maximum;
  return clamp(Math.trunc(numeric), MIN_CHAIN_LENGTH, maximum);
}

function makeMetadata(queueIndex, sourceIndex, length, memberIndex) {
  return Object.freeze({
    chainId: `linked-${queueIndex}-${sourceIndex}`,
    length,
    memberIndex,
    isHead: memberIndex === 0
  });
}

function claimChain(row, queueIndex, sourceIndex, length) {
  for (let memberIndex = 0; memberIndex < length; memberIndex += 1) {
    row[sourceIndex + memberIndex] = makeMetadata(
      queueIndex,
      sourceIndex,
      length,
      memberIndex
    );
  }
}

function getSameColorRunLength(queue, sourceIndex) {
  const colorIndex = queue[sourceIndex];
  let length = 0;
  while (sourceIndex + length < queue.length && queue[sourceIndex + length] === colorIndex) {
    length += 1;
  }
  return length;
}

function buildChancePlan(queues, chance, maxLength, random) {
  return queues.map((queue, queueIndex) => {
    const row = Array(queue.length).fill(null);
    let sourceIndex = 0;
    while (sourceIndex < queue.length) {
      const allowed = Math.min(maxLength, getSameColorRunLength(queue, sourceIndex));
      if (allowed >= MIN_CHAIN_LENGTH && random() < chance) {
        const length = MIN_CHAIN_LENGTH + Math.floor(random() * (allowed - 1));
        claimChain(row, queueIndex, sourceIndex, length);
        sourceIndex += length;
      } else {
        sourceIndex += 1;
      }
    }
    return row;
  });
}

function buildAuthoredPlan(queues, authoredStarts, maxVehicleSeats) {
  let invalidAuthoredCount = 0;
  const plan = queues.map((queue, queueIndex) => {
    const row = Array(queue.length).fill(null);
    const authoredRow = Array.isArray(authoredStarts?.[queueIndex])
      ? authoredStarts[queueIndex]
      : [];
    for (let sourceIndex = 0; sourceIndex < authoredRow.length; sourceIndex += 1) {
      const value = authoredRow[sourceIndex];
      if (value === 0 || value == null) continue;
      const validLength = Number.isFinite(value)
        && Number.isInteger(value)
        && value >= MIN_CHAIN_LENGTH
        && value <= maxVehicleSeats;
      const inBounds = validLength && sourceIndex + value <= queue.length;
      const sameColor = inBounds
        && queue.slice(sourceIndex, sourceIndex + value).every((color) => color === queue[sourceIndex]);
      const unclaimed = sameColor
        && row.slice(sourceIndex, sourceIndex + value).every((metadata) => metadata === null);
      if (!unclaimed) {
        invalidAuthoredCount += 1;
        continue;
      }
      claimChain(row, queueIndex, sourceIndex, value);
    }
    return row;
  });
  return { plan, invalidAuthoredCount };
}

function summarizePlan(plan) {
  let chainCount = 0;
  let linkedGroupCount = 0;
  for (const row of plan) {
    for (const metadata of row) {
      if (!metadata) continue;
      linkedGroupCount += 1;
      if (metadata.isHead) chainCount += 1;
    }
  }
  return { chainCount, linkedGroupCount };
}

function cloneLinkedPassenger(value) {
  return value ? { ...value } : null;
}

export function createLinkedPassengerRuntime({
  random = Math.random,
  level = {},
  options = {},
  warn = (...args) => console.warn(...args)
} = {}) {
  const queues = Array.isArray(level.passengerQueues) ? level.passengerQueues : [];
  const mode = options.mode === 'authored' ? 'authored' : 'chance';
  const chance = normalizeChance(options.chance);
  const maxVehicleSeats = getMaxVehicleSeats(level);
  const maxLength = normalizeMaxLength(options.maxLength, maxVehicleSeats);
  const authoredStarts = level?.mechanics?.['linked-passengers']?.authoredStarts;
  let activePlan = queues.map((queue) => Array(queue.length).fill(null));
  let warned = false;

  const metadataAt = (queueIndex, sourceIndex) => (
    activePlan[queueIndex]?.[sourceIndex] ?? null
  );

  return {
    id: 'linked-passengers',
    createState() {
      const built = mode === 'authored'
        ? buildAuthoredPlan(queues, authoredStarts, maxVehicleSeats)
        : {
            plan: buildChancePlan(queues, chance, maxLength, random),
            invalidAuthoredCount: 0
          };
      activePlan = built.plan;
      if (built.invalidAuthoredCount > 0 && !warned) {
        warned = true;
        warn(`linked-passengers ignored ${built.invalidAuthoredCount} invalid authored chain starts`);
      }
      return {
        linkedPassenger: {
          mode,
          chance,
          maxLength,
          maxVehicleSeats,
          ...summarizePlan(activePlan),
          invalidAuthoredCount: built.invalidAuthoredCount
        }
      };
    },
    createQueueItemData({ queueIndex, sourceIndex }) {
      return { linkedPassenger: cloneLinkedPassenger(metadataAt(queueIndex, sourceIndex)) };
    },
    createSlotData: () => ({ linkedPassenger: null }),
    cloneQueueItemSnapshot: (item) => ({
      linkedPassenger: cloneLinkedPassenger(item?.linkedPassenger)
    }),
    cloneSlotSnapshot: (slot) => ({
      linkedPassenger: cloneLinkedPassenger(slot?.linkedPassenger)
    }),
    decorateSnapshot: (game) => ({
      linkedPassenger: { ...game.mechanicState.linkedPassenger }
    }),
    getQueueAdmissionBatchSize({ queueIndex, sourceIndex }) {
      const metadata = metadataAt(queueIndex, sourceIndex);
      return metadata?.isHead ? metadata.length : 1;
    },
    getBeltEntryBatch({ queue }) {
      const head = queue[0];
      if (!head) return [];
      const metadata = head.linkedPassenger;
      if (!metadata) return [head];
      if (!metadata.isHead) return [];
      const batch = queue.slice(0, metadata.length);
      const valid = batch.length === metadata.length && batch.every((item, memberIndex) => (
        item.linkedPassenger?.chainId === metadata.chainId
        && item.linkedPassenger.memberIndex === memberIndex
      ));
      return valid ? batch : [];
    },
    getBoardingBatch({ slot, slots }) {
      const metadata = slot.linkedPassenger;
      if (!metadata) return [slot];
      if (!metadata.isHead) return [];
      const batch = slots
        .filter((candidate) => candidate.linkedPassenger?.chainId === metadata.chainId)
        .sort((left, right) => (
          left.linkedPassenger.memberIndex - right.linkedPassenger.memberIndex
        ));
      const valid = batch.length === metadata.length && batch.every((candidate, memberIndex) => (
        candidate.linkedPassenger.memberIndex === memberIndex
      ));
      return valid ? batch : [];
    },
    onPassengerEnteredBelt({ slot, passenger }) {
      slot.linkedPassenger = cloneLinkedPassenger(passenger.linkedPassenger);
    },
    onPassengerBatchBoarded({ slots }) {
      const metadata = slots[0]?.linkedPassenger;
      return metadata ? {
        linkedPassenger: { chainId: metadata.chainId, length: metadata.length }
      } : {};
    },
    clearSlotData({ slot }) {
      slot.linkedPassenger = null;
    }
  };
}
```

Modify `src/mechanics/linked-passengers/index.js` without changing `status: 'planned'` yet:

```js
import { createLinkedPassengerRuntime } from './model.js';

// Keep the existing definition object unchanged here.

export const createRuntime = createLinkedPassengerRuntime;
export default { definition, createRuntime };
```

- [ ] **Step 4: Run the focused test and confirm all Task 1 assertions pass**

Run:

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: 5 passing tests, 0 failures.

- [ ] **Step 5: Commit the planner slice**

```powershell
git add src/mechanics/linked-passengers/index.js src/mechanics/linked-passengers/model.js test/linked-passengers-mechanic.test.js
git commit -m "feat: plan linked passenger chains"
```

## Task 2: Add The Balanced Level 12 Authored Demonstration

**Files:**
- Modify: `src/level-data.js:66-106,310-317`
- Modify: `test/linked-passengers-mechanic.test.js`

- [ ] **Step 1: Add a failing Level 12 authored-data test**

Append:

```js
import { LEVEL_1 } from '../src/level-data.js';

test('level12 authored starts contain balanced 2 3 4 6 8 and 10 row chains on both queues', () => {
  const rows = LEVEL_1.mechanics['linked-passengers'].authoredStarts;
  assert.deepEqual(rows.map((row) => row.filter((value) => value > 0)), [
    [2, 6, 10, 8, 4, 3],
    [2, 4, 8, 10, 6, 3]
  ]);
  assert.deepEqual(rows.map((row) => row.reduce((sum, value) => sum + value, 0)), [33, 33]);
  assert.equal(rows.every((row, index) => row.length === LEVEL_1.passengerQueues[index].length), true);
  assert.equal(Object.isFrozen(rows), true);
  assert.equal(rows.every(Object.isFrozen), true);

  const runtime = createLinkedPassengerRuntime({
    level: LEVEL_1,
    options: { mode: 'authored' },
    random() {
      throw new Error('authored mode must not call random');
    }
  });
  assert.equal(runtime.createState().linkedPassenger.chainCount, 12);
  assert.equal(runtime.createState().linkedPassenger.linkedGroupCount, 66);
  assert.equal(runtime.createState().linkedPassenger.invalidAuthoredCount, 0);
});
```

- [ ] **Step 2: Run the focused test and observe the missing config failure**

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: the new test fails because `LEVEL_1.mechanics['linked-passengers']` is undefined.

- [ ] **Step 3: Add frozen authored starts at the verified source indices**

Insert after `LEVEL12_QUESTION_PASSENGER_MASKS`:

```js
function makeLinkedPassengerStarts(queue, entries) {
  const starts = Array(queue.length).fill(0);
  for (const [sourceIndex, length] of entries) starts[sourceIndex] = length;
  return Object.freeze(starts);
}

const LEVEL12_LINKED_PASSENGER_STARTS = Object.freeze([
  makeLinkedPassengerStarts(LEVEL12_PASSENGER_QUEUES[0], [
    [0, 2], [44, 6], [82, 10], [122, 8], [150, 4], [212, 3]
  ]),
  makeLinkedPassengerStarts(LEVEL12_PASSENGER_QUEUES[1], [
    [0, 2], [19, 4], [57, 8], [93, 10], [133, 6], [183, 3]
  ])
]);
```

Extend `LEVEL_1.mechanics`:

```js
mechanics: Object.freeze({
  'question-passenger': Object.freeze({
    authoredMasks: LEVEL12_QUESTION_PASSENGER_MASKS
  }),
  'linked-passengers': Object.freeze({
    authoredStarts: LEVEL12_LINKED_PASSENGER_STARTS
  })
}),
```

- [ ] **Step 4: Run the focused test and confirm authored data passes**

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: 6 passing tests, 0 failures.

- [ ] **Step 5: Commit the authored demonstration**

```powershell
git add src/level-data.js test/linked-passengers-mechanic.test.js
git commit -m "feat: author linked passenger demo chains"
```

## Task 3: Make Visible Queues Admit Only Complete Batches

**Files:**
- Modify: `src/game-model.js:132-201,554-617`
- Modify: `test/linked-passengers-mechanic.test.js`
- Modify: `test/game-model.test.js:180-320`

- [ ] **Step 1: Add failing tests for capacity gaps and complete refill batches**

Add a complete small game fixture to `test/linked-passengers-mechanic.test.js`:

```js
import { BusLoopGame } from '../src/game-model.js';

function makeGameLevel({ queue = [0, 0, 0, 1], authoredStarts = [3, 0, 0, 0], seats = 4 } = {}) {
  return {
    id: 99,
    conveyorCapacity: 5,
    queueCapacity: 5,
    queueCount: 1,
    passengerQueues: [queue],
    passengerSequence: queue,
    mechanics: { 'linked-passengers': { authoredStarts: [authoredStarts] } },
    passengerQueue: { spacing: 0.5 },
    passengerEntryMotion: {
      passengerSpeed: 1,
      initialFillCatchUpDuration: 0.2,
      catchUpExtraSpeed: 0,
      snapDistance: 0.02
    },
    conveyorSpeed: 1,
    conveyorPathLength: 1,
    entryPercents: [0.1],
    exitStart: 0.55,
    exitEnd: 0.7,
    spotCount: 1,
    groupSize: 4,
    boardingDepartureDelay: 1,
    longPressMultiplier: 3,
    longPressThreshold: 0.25,
    mapScale: 1,
    vehicleSize: { width: 0.8, length: 1.2 },
    vehicleMotion: { spotYaw: 0, spotApproachOffsetZ: 0.4 },
    vehicles: [{ id: 1, seats, colorIndex: 0, x: 0, z: 0, yaw: 0 }],
    assets: { audio: {} }
  };
}

function makeLinkedGame(level = makeGameLevel()) {
  const game = new BusLoopGame(level);
  game.mechanicId = 'linked-passengers';
  game.mechanicRuntime = createLinkedPassengerRuntime({
    level,
    options: { mode: 'authored' }
  });
  game.reset();
  return game;
}

test('visible queues leave capacity empty rather than split the next linked batch', () => {
  const game = makeLinkedGame();
  game.initializeQueues([2], 0.5, [2], 1);
  const state = game.snapshot();
  assert.equal(state.queues[0].length, 0);
  assert.equal(state.sourceRemaining, 4);

  game.initializeQueues([4], 0.5, [2], 1);
  assert.equal(game.snapshot().queues[0].length, 4);
  assert.deepEqual(game.snapshot().queueItems[0].slice(0, 3).map((item) => (
    item.linkedPassenger.memberIndex
  )), [0, 1, 2]);
});

test('dequeuePassengerBatch removes and refills complete batches while preserving source indices', () => {
  const level = makeGameLevel({
    queue: [0, 0, 0, 1, 1, 2],
    authoredStarts: [3, 0, 0, 2, 0, 0]
  });
  const game = makeLinkedGame(level);
  game.initializeQueues([3], 0.5, [2], 1);
  const batch = game.dequeuePassengerBatch(0, true);
  assert.equal(batch.length, 3);
  assert.deepEqual(batch.map((item) => item.sourceIndex), [0, 1, 2]);
  assert.equal(game.snapshot().queues[0].length, 2);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.sourceIndex), [3, 4]);
  assert.equal(game.snapshot().sourceRemaining, 1);
});
```

In `test/game-model.test.js`, add one source-contract assertion near existing mechanic configuration tests:

```js
test('game model exposes generic passenger batch hooks without linked mechanic branching', () => {
  const source = readFileSync(join('src', 'game-model.js'), 'utf8');
  assert.match(source, /getQueueAdmissionBatchSize/);
  assert.match(source, /getBeltEntryBatch/);
  assert.match(source, /getBoardingBatch/);
  assert.match(source, /onPassengerBatchBoarded/);
  assert.doesNotMatch(source, /linked-passengers/);
});
```

- [ ] **Step 2: Run the two targeted test files and confirm missing batch APIs**

```powershell
node --test test/linked-passengers-mechanic.test.js test/game-model.test.js
```

Expected: failures for partial initial queue admission and missing `dequeuePassengerBatch`.

- [ ] **Step 3: Replace scalar queue setup/refill with a generic full-batch admission loop**

In both `reset()` and `initializeQueues()`, replace direct slicing with:

```js
this.queueCapacities = authoredQueues.map((_, index) => Math.max(0, Math.min(
  this.level.queueCapacity,
  Math.floor(queueCapacities?.[index] ?? this.level.queueCapacity)
)));
this.queues = authoredQueues.map(() => []);
this.sourceQueues = authoredQueues.map((queue) => queue.slice());
this.sourceQueueIndices = authoredQueues.map(() => 0);
for (let queueIndex = 0; queueIndex < authoredQueues.length; queueIndex += 1) {
  this.fillQueueFromSource(queueIndex, { initial: true });
}
```

For `reset()`, define `queueCapacities` locally as:

```js
const queueCapacities = authoredQueues.map(() => this.level.queueCapacity);
```

Add these helpers immediately before the current `dequeuePassenger` method:

```js
getQueueAdmissionBatchSize(queueIndex) {
  const source = this.sourceQueues[queueIndex] ?? [];
  if (source.length === 0) return 0;
  const sourceIndex = this.sourceQueueIndices[queueIndex] ?? 0;
  const requested = this.mechanicRuntime.getQueueAdmissionBatchSize?.({
    game: this,
    queueIndex,
    sourceIndex,
    sourceColors: source
  }) ?? 1;
  return Number.isInteger(requested) && requested >= 1 && requested <= source.length
    ? requested
    : 1;
}

fillQueueFromSource(queueIndex, { initial = false } = {}) {
  const queue = this.queues[queueIndex];
  const source = this.sourceQueues[queueIndex];
  const capacity = this.queueCapacities[queueIndex] ?? this.level.queueCapacity;
  if (!queue || !source) return;

  while (source.length > 0) {
    const batchSize = this.getQueueAdmissionBatchSize(queueIndex);
    if (batchSize < 1 || queue.length + batchSize > capacity) break;
    const sourceIndex = this.sourceQueueIndices[queueIndex];
    const colors = source.splice(0, batchSize);
    const availableLength = this.queueAvailableLengths[queueIndex] ?? 0;
    const lastDistance = queue.at(-1)?.distanceFromHead;
    const startDistance = initial
      ? queue.length * this.queueSpacing
      : (Number.isFinite(lastDistance) ? lastDistance + this.queueSpacing : availableLength);
    queue.push(...this.createQueueItems(
      colors,
      queueIndex,
      sourceIndex,
      startDistance
    ));
    this.sourceQueueIndices[queueIndex] += batchSize;
  }
}

peekPassengerBatch(queueIndex) {
  const queue = this.queues[queueIndex];
  if (!queue?.length) return null;
  if (queue[0].distanceFromHead > PASSENGER_READY_DISTANCE_THRESHOLD) return null;
  const batch = this.mechanicRuntime.getBeltEntryBatch?.({
    game: this,
    queueIndex,
    queue
  }) ?? [queue[0]];
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > queue.length) return null;
  return batch.every((item, index) => item === queue[index]) ? batch : null;
}

dequeuePassengerBatch(queueIndex, includeDetails = false) {
  const batch = this.peekPassengerBatch(queueIndex);
  if (!batch) return null;
  this.queues[queueIndex].splice(0, batch.length);
  this.fillQueueFromSource(queueIndex);
  return includeDetails
    ? batch.map((passenger) => ({
        ...passenger,
        ...this.cloneMechanicQueueItemSnapshot(passenger)
      }))
    : batch;
}
```

Replace `dequeuePassenger` with the compatibility wrapper:

```js
dequeuePassenger(queueIndex, includeDetails = false) {
  const batch = this.dequeuePassengerBatch(queueIndex, includeDetails);
  if (!batch) return null;
  return includeDetails ? batch[0] : batch[0].colorIndex;
}
```

Extend `createQueueItems` to accept an explicit starting distance and store `sourceIndex` as core metadata:

```js
createQueueItems(colors, queueIndex, startIndex = 0, startDistance = 0) {
  const availableLength = this.queueAvailableLengths?.[queueIndex]
    ?? Math.max(0, (this.level.queueCapacity - 1) * (this.queueSpacing ?? 0.4));
  return colors.map((colorIndex, index) => ({
    id: this.nextPassengerId++,
    sourceIndex: startIndex + index,
    colorIndex,
    createdAt: this.time,
    distanceFromHead: clampNumber(
      startDistance + index * (this.queueSpacing ?? 0.4),
      0,
      availableLength
    ),
    ...this.createMechanicQueueItemData({ queueIndex, sourceIndex: startIndex + index })
  }));
}
```

- [ ] **Step 4: Run targeted tests and the base model regression file**

```powershell
node --test test/linked-passengers-mechanic.test.js test/game-model.test.js
```

Expected: all tests in both files pass; base queues still admit/dequeue one row at a time.

- [ ] **Step 5: Commit generic queue batching**

```powershell
git add src/game-model.js test/linked-passengers-mechanic.test.js test/game-model.test.js
git commit -m "feat: admit complete passenger batches"
```

## Task 4: Enter The Conveyor Atomically With Ring Wrap

**Files:**
- Modify: `src/game-model.js:411-477,537-552`
- Modify: `test/linked-passengers-mechanic.test.js`

- [ ] **Step 1: Add failing wrap, no-split, and event tests**

Append:

```js
test('a linked chain enters as one batch with the head at the crossing slot and trailing ring wrap', () => {
  const game = makeLinkedGame();
  game.initializeQueues([3], 0.5, [2], 1);
  const expectedPassengerIds = game.snapshot().queueItems[0].map((item) => item.id);
  const result = game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
  assert.equal(result, true);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].linkedPassenger.memberIndex), [0, 1, 2]);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].passengerId), expectedPassengerIds);
  assert.deepEqual(game.lastEvent.passengerIds, expectedPassengerIds);
  assert.deepEqual(game.lastEvent.slotIndices, [0, 4, 3]);
  assert.equal(game.lastEvent.groupCount, 3);
});

test('a linked chain waits intact when any required trailing slot is occupied', () => {
  const game = makeLinkedGame();
  game.initializeQueues([3], 0.5, [2], 1);
  game.slots[4].colorIndex = 9;
  const before = game.snapshot().queueItems[0].map((item) => item.id);
  assert.equal(game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 }), false);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.id), before);
  assert.equal(game.slots[0].colorIndex, null);
  assert.equal(game.slots[3].colorIndex, null);
});
```

- [ ] **Step 2: Run the focused test and confirm `tryEnterPassengerBatch` is missing**

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: the two new tests fail because `tryEnterPassengerBatch` is undefined.

- [ ] **Step 3: Add generic trailing-slot allocation and batch entry**

Add this method after `getFirstPassedEntry`:

```js
tryEnterPassengerBatch(headSlot, entry) {
  const passengerBatch = this.peekPassengerBatch(entry.index);
  if (!passengerBatch) return false;
  const slotBatch = Array.from({ length: passengerBatch.length }, (_, memberIndex) => (
    this.slots[(headSlot.index - memberIndex + this.slots.length) % this.slots.length]
  ));
  if (slotBatch.some((slot) => slot.colorIndex !== null)) return false;

  const dequeued = this.dequeuePassengerBatch(entry.index, true);
  if (!dequeued || dequeued.length !== slotBatch.length) return false;
  dequeued.forEach((passenger, memberIndex) => {
    const slot = slotBatch[memberIndex];
    slot.colorIndex = passenger.colorIndex;
    slot.passengerId = passenger.id;
    slot.entryIndex = entry.index;
    slot.entryMotion = this.createEntryMotion(entry.index, passenger);
    this.mechanicRuntime.onPassengerEnteredBelt?.({ game: this, slot, passenger });
    if (this.initialFillActive) this.initialFilledSlotIndices.add(slot.index);
  });
  this.lastEvent = {
    type: 'group-entered-belt',
    colorIndex: dequeued[0].colorIndex,
    entryIndex: entry.index,
    passengerId: dequeued[0].id,
    passengerIds: dequeued.map((passenger) => passenger.id),
    slotIndex: slotBatch[0].index,
    slotIndices: slotBatch.map((slot) => slot.index),
    groupCount: dequeued.length
  };
  return true;
}
```

Split conveyor movement from entry processing in `update()`:

```js
for (const slot of this.slots) {
  slot.previousProgress = slot.progress;
  slot.progress = wrap01(slot.progress + progressDelta);
}

for (const slot of this.slots) {
  if (slot.colorIndex !== null) continue;
  const entry = this.getFirstPassedEntry(slot.previousProgress, slot.progress);
  if (!entry) continue;
  const waitingBatch = this.peekPassengerBatch(entry.index);
  if (!waitingBatch) {
    // Preserve the existing initial-fill hold/clamp branch for an empty/not-ready queue.
    continue;
  }
  if (!this.tryEnterPassengerBatch(slot, entry)) {
    if (this.initialFillActive) this.initialFillActive = false;
    continue;
  }
  changed = true;
}
```

Retain the existing initial-fill clamp variables and empty-queue hold behavior. The only semantic change is: insufficient consecutive slots ends the fast initial-fill phase and leaves the chain intact for a later lap.

- [ ] **Step 4: Run focused and base regression tests**

```powershell
node --test test/linked-passengers-mechanic.test.js test/game-model.test.js
```

Expected: atomic wrap/no-split tests pass and all existing initial-fill tests remain green.

- [ ] **Step 5: Commit atomic belt entry**

```powershell
git add src/game-model.js test/linked-passengers-mechanic.test.js
git commit -m "feat: enter linked passengers atomically"
```

## Task 5: Board Complete Chains Only Into Sufficient Capacity

**Files:**
- Modify: `src/game-model.js:479-535,642-680`
- Modify: `test/linked-passengers-mechanic.test.js`

- [ ] **Step 1: Add failing tests for insufficient capacity, aggregate boarding, and deep snapshots**

Append:

```js
function prepareVehicle(game, boardedGroups) {
  const vehicle = game.getVehicle(1);
  Object.assign(vehicle, { state: 'at-spot', spotIndex: 0, boardedGroups });
  game.spots[0].vehicleId = vehicle.id;
  return vehicle;
}

test('linked passengers loop as a whole when the matching vehicle lacks group capacity', () => {
  const game = makeLinkedGame(makeGameLevel({ seats: 4 }));
  game.initializeQueues([3], 0.5, [2], 1);
  game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
  const vehicle = prepareVehicle(game, 2);
  for (const slotIndex of [0, 4, 3]) {
    game.slots[slotIndex].progress = 0.6;
    game.slots[slotIndex].previousProgress = 0.6;
  }
  game.update(0);
  assert.equal(vehicle.boardedGroups, 2);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].colorIndex), [0, 0, 0]);
  assert.equal(game.snapshot().boardingEvents.length, 0);
});

test('linked passengers board atomically and emit one aggregate event', () => {
  const game = makeLinkedGame(makeGameLevel({ seats: 4 }));
  game.initializeQueues([3], 0.5, [2], 1);
  const expectedPassengerIds = game.snapshot().queueItems[0].map((item) => item.id);
  game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
  const vehicle = prepareVehicle(game, 1);
  for (const slotIndex of [0, 4, 3]) {
    game.slots[slotIndex].progress = 0.6;
    game.slots[slotIndex].previousProgress = 0.6;
  }
  game.update(0);
  const event = game.snapshot().boardingEvents.at(-1);
  assert.equal(vehicle.boardedGroups, 4);
  assert.equal(vehicle.state, 'boarding-final');
  assert.equal(event.groupCount, 3);
  assert.deepEqual(event.passengerIds, expectedPassengerIds);
  assert.deepEqual(event.slotIndices, [0, 4, 3]);
  assert.equal(event.linkedPassenger.length, 3);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].colorIndex), [null, null, null]);

  event.passengerIds.push(99);
  assert.deepEqual(game.snapshot().boardingEvents.at(-1).passengerIds, expectedPassengerIds);
});
```

- [ ] **Step 2: Run the focused test and confirm scalar boarding fails these assertions**

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: insufficient-capacity behavior and aggregate event assertions fail.

- [ ] **Step 3: Replace scalar exit boarding with generic batch boarding**

Add these helpers before `findBoardableVehicle`:

```js
getBoardingBatch(slot) {
  const batch = this.mechanicRuntime.getBoardingBatch?.({
    game: this,
    slot,
    slots: this.slots
  }) ?? [slot];
  if (!Array.isArray(batch) || batch.length === 0) return [];
  return batch.every((candidate) => this.slots.includes(candidate)) ? batch : [];
}

tryBoardPassengerBatch(slot) {
  const batch = this.getBoardingBatch(slot);
  if (batch.length === 0) return false;
  const colorIndex = batch[0].colorIndex;
  if (batch.some((candidate) => candidate.colorIndex !== colorIndex)) return false;
  const vehicle = this.findBoardableVehicle(colorIndex, batch.length);
  if (!vehicle) return false;

  const passengerIds = batch.map((candidate) => candidate.passengerId);
  const slotIndices = batch.map((candidate) => candidate.index);
  const progresses = batch.map((candidate) => candidate.progress);
  const mechanicBoardingEvent = this.mechanicRuntime.onPassengerBatchBoarded?.({
    game: this,
    slots: batch,
    vehicle
  }) ?? this.mechanicRuntime.onPassengerBoarded?.({
    game: this,
    slot: batch[0],
    vehicle
  }) ?? {};
  this.boardingEvents.push({
    id: ++this.boardingEventId,
    vehicleId: vehicle.id,
    spotIndex: vehicle.spotIndex,
    colorIndex,
    passengerId: passengerIds[0],
    passengerIds,
    ...mechanicBoardingEvent,
    slotIndex: slotIndices[0],
    slotIndices,
    progress: progresses[0],
    progresses,
    groupCount: batch.length,
    startedAt: this.time
  });
  if (this.boardingEvents.length > 24) this.boardingEvents.shift();

  for (const candidate of batch) {
    candidate.colorIndex = null;
    candidate.passengerId = null;
    candidate.entryIndex = null;
    candidate.entryMotion = null;
    this.mechanicRuntime.clearSlotData?.({ game: this, slot: candidate });
  }
  vehicle.boardedGroups += batch.length;
  this.lastEvent = {
    type: 'group-boarded',
    vehicleId: vehicle.id,
    colorIndex,
    boardedGroups: vehicle.boardedGroups,
    passengerId: passengerIds[0],
    passengerIds,
    groupCount: batch.length,
    ...mechanicBoardingEvent
  };
  if (vehicle.boardedGroups >= vehicle.seats) {
    Object.assign(vehicle, { state: 'boarding-final', motion: 0 });
    this.lastEvent = { type: 'vehicle-boarding-final', vehicleId: vehicle.id };
  }
  return true;
}
```

Replace the scalar exit body with:

```js
for (const slot of this.slots) {
  if (slot.colorIndex === null) continue;
  const crossedExit = this.crossedPoint(slot.previousProgress, slot.progress, this.level.exitStart);
  const inExit = this.inExitRange(slot.progress);
  if (inExit && this.tryBoardPassengerBatch(slot)) {
    changed = true;
    continue;
  }
  if (crossedExit) {
    changed = Boolean(this.mechanicRuntime.onPassengerExitPassed?.({ game: this, slot })) || changed;
  }
}
```

Generalize capacity lookup:

```js
findBoardableVehicle(colorIndex, requiredGroups = 1) {
  for (const spot of this.spots) {
    if (spot.vehicleId === null) continue;
    const vehicle = this.getVehicle(spot.vehicleId);
    const freeGroups = vehicle ? vehicle.seats - vehicle.boardedGroups : 0;
    if (
      vehicle?.state === 'at-spot'
      && vehicle.colorIndex === colorIndex
      && freeGroups >= requiredGroups
    ) return vehicle;
  }
  return null;
}
```

Update `hasBoardablePassenger()` to call `getBoardingBatch(slot)` and require `findBoardableVehicle(colorIndex, batch.length)`. Update `snapshot()` so boarding event arrays and nested linked metadata cannot alias runtime state:

```js
boardingEvents: this.boardingEvents.map((event) => ({
  ...event,
  passengerIds: event.passengerIds ? [...event.passengerIds] : undefined,
  slotIndices: event.slotIndices ? [...event.slotIndices] : undefined,
  progresses: event.progresses ? [...event.progresses] : undefined,
  linkedPassenger: event.linkedPassenger ? { ...event.linkedPassenger } : undefined
})),
```

- [ ] **Step 4: Run focused, star, question, and base model regression tests**

```powershell
node --test test/linked-passengers-mechanic.test.js test/game-model.test.js test/star-passenger-mechanic.test.js test/question-passenger-mechanic.test.js
```

Expected: all selected tests pass; scalar mechanics still create one-row boarding events and retain their existing reward/reveal behavior.

- [ ] **Step 5: Commit atomic boarding**

```powershell
git add src/game-model.js test/linked-passengers-mechanic.test.js
git commit -m "feat: board linked passengers atomically"
```

## Task 6: Add Independent Page-Session Settings

**Files:**
- Create: `src/mechanics/linked-passengers/view.js`
- Create: `src/mechanics/linked-passengers/styles.css`
- Modify: `src/mechanics/linked-passengers/index.js`
- Modify: `src/styles.css:1`
- Modify: `src/main.js:132-138`
- Modify: `test/linked-passengers-mechanic.test.js`
- Modify: `test/mechanic-registry.test.js:350-380,700-790`
- Modify: `test/game-model.test.js:1213-1270`

- [ ] **Step 1: Add failing detail-view and page-session tests**

Follow the existing fake DOM helpers in `test/mechanic-registry.test.js` and add assertions for:

```js
const extension = createMechanicDetailView('linked-passengers', {
  document,
  options: { mode: 'chance', chance: 0.3, maxLength: 10 },
  state: {
    linkedPassenger: {
      maxVehicleSeats: 10,
      chainCount: 12,
      linkedGroupCount: 66,
      invalidAuthoredCount: 0
    }
  },
  onCommit: (options) => commits.push(options)
});
assert.ok(extension.element.matches('[data-linked-passenger-settings]'));
assert.equal(extension.element.querySelector('[data-linked-mode]').value, 'chance');
assert.equal(extension.element.querySelector('[data-linked-chance]').value, '30');
assert.equal(extension.element.querySelector('[data-linked-max-length]').value, '10');
assert.match(extension.element.querySelector('[data-linked-authored-summary]').textContent, /12/);
assert.match(extension.element.querySelector('[data-linked-authored-summary]').textContent, /66/);
```

Dispatch a chance change to 45, a max-length change to 6, then a mode change to `authored`; assert exact commits:

```js
[
  { mode: 'chance', chance: 0.45, maxLength: 10 },
  { mode: 'chance', chance: 0.45, maxLength: 6 },
  { mode: 'authored', chance: 0.45, maxLength: 6 }
]
```

In `test/game-model.test.js`, extend the page-session source test to require:

```js
assert.match(
  mainSource,
  /const mechanicSessionOptions = \{\s*'question-passenger': \{ mode: 'chance', chance: 0\.3 \},\s*'linked-passengers': \{ mode: 'chance', chance: 0\.3, maxLength: 10 \}\s*\}/
);
assert.match(mainSource, /'linked-passengers': \{ mode: 'chance', chance: 0\.3, maxLength: 10 \}/);
assert.doesNotMatch(
  mainSource,
  /(?:localStorage\.(?:getItem|setItem)|safeRemoveStorageItem)\([^)]*linked-passengers/
);
```

Replace the existing one-entry `mechanicSessionOptions` regex with the two-entry regex above, and update the existing occurrence-count assertion to expect one literal occurrence of each mechanic ID in `main.js`.

- [ ] **Step 2: Run the targeted UI tests and confirm missing view/style failures**

```powershell
node --test test/linked-passengers-mechanic.test.js test/mechanic-registry.test.js test/game-model.test.js
```

Expected: failures for missing detail view, missing stylesheet import, and missing session defaults.

- [ ] **Step 3: Implement the mechanic-owned settings view**

Create `view.js` with DOM-only construction so it works in both the browser and the repository fake DOM:

```js
let nextLinkedInputId = 1;

const normalizeMode = (value) => value === 'authored' ? 'authored' : 'chance';
const normalizeChance = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0.3;
};
const normalizeLength = (value, maximum) => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(2, Math.min(maximum, Math.trunc(numeric)))
    : maximum;
};

function appendTextElement(document, parent, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  parent.append(element);
  return element;
}

export function createLinkedPassengerDetailView({
  document,
  options = {},
  state = {},
  onCommit = () => {}
} = {}) {
  const runtimeState = state.linkedPassenger ?? {};
  const maximum = Math.max(2, runtimeState.maxVehicleSeats ?? 10);
  let mode = normalizeMode(options.mode);
  let chance = normalizeChance(options.chance);
  let maxLength = normalizeLength(options.maxLength, maximum);
  let destroyed = false;
  const element = document.createElement('section');
  element.setAttribute('data-linked-passenger-settings', '');
  appendTextElement(document, element, 'h3', '机制设置');

  const modeLabel = document.createElement('label');
  modeLabel.setAttribute('data-linked-field', 'mode');
  appendTextElement(document, modeLabel, 'span', '分配模式');
  const modeSelect = document.createElement('select');
  modeSelect.setAttribute('data-linked-mode', '');
  for (const [value, text] of [['chance', '概率随机'], ['authored', '关卡标记']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    modeSelect.append(option);
  }
  modeLabel.append(modeSelect);
  element.append(modeLabel);

  const chanceRow = document.createElement('div');
  chanceRow.setAttribute('data-linked-chance-row', '');
  const chanceLabel = document.createElement('label');
  chanceLabel.setAttribute('data-linked-field', 'chance');
  appendTextElement(document, chanceLabel, 'span', '生成概率');
  const chanceInput = document.createElement('input');
  const chanceId = `linked-passenger-chance-${nextLinkedInputId}`;
  chanceInput.type = 'range';
  chanceInput.id = chanceId;
  chanceInput.setAttribute('min', '0');
  chanceInput.setAttribute('max', '100');
  chanceInput.setAttribute('step', '1');
  chanceInput.setAttribute('data-linked-chance', '');
  chanceLabel.append(chanceInput);
  const chanceOutput = document.createElement('output');
  chanceOutput.setAttribute('data-linked-chance-output', '');
  chanceOutput.setAttribute('for', chanceId);
  chanceRow.append(chanceLabel, chanceOutput);
  element.append(chanceRow);

  const lengthRow = document.createElement('div');
  lengthRow.setAttribute('data-linked-length-row', '');
  const lengthLabel = document.createElement('label');
  lengthLabel.setAttribute('data-linked-field', 'maxLength');
  appendTextElement(document, lengthLabel, 'span', '最长连体排数');
  const lengthInput = document.createElement('input');
  const lengthId = `linked-passenger-length-${nextLinkedInputId}`;
  nextLinkedInputId += 1;
  lengthInput.type = 'range';
  lengthInput.id = lengthId;
  lengthInput.setAttribute('min', '2');
  lengthInput.setAttribute('max', String(maximum));
  lengthInput.setAttribute('step', '1');
  lengthInput.setAttribute('data-linked-max-length', '');
  lengthLabel.append(lengthInput);
  const lengthOutput = document.createElement('output');
  lengthOutput.setAttribute('data-linked-max-length-output', '');
  lengthOutput.setAttribute('for', lengthId);
  lengthRow.append(lengthLabel, lengthOutput);
  element.append(lengthRow);

  const authoredSummary = appendTextElement(
    document,
    element,
    'p',
    `固定标记：${runtimeState.chainCount ?? 0} 组连体，${runtimeState.linkedGroupCount ?? 0} 排乘客`
  );
  authoredSummary.setAttribute('data-linked-authored-summary', '');

const commit = () => onCommit({ mode, chance, maxLength });
const sync = () => {
  modeSelect.value = mode;
  chanceInput.value = String(Math.round(chance * 100));
  chanceOutput.textContent = `${chanceInput.value}%`;
  lengthInput.value = String(maxLength);
  lengthOutput.textContent = String(maxLength);
  const authored = mode === 'authored';
  chanceRow.hidden = authored;
  lengthRow.hidden = authored;
  authoredSummary.hidden = !authored;
};

  const handleModeChange = () => {
    mode = normalizeMode(modeSelect.value);
    sync();
    commit();
  };
  const handleChanceInput = () => {
    chanceOutput.textContent = `${Math.round(normalizeChance(Number(chanceInput.value) / 100) * 100)}%`;
  };
  const handleChanceChange = () => {
    chance = normalizeChance(Number(chanceInput.value) / 100);
    sync();
    commit();
  };
  const handleLengthInput = () => {
    lengthOutput.textContent = String(normalizeLength(lengthInput.value, maximum));
  };
  const handleLengthChange = () => {
    maxLength = normalizeLength(lengthInput.value, maximum);
    sync();
    commit();
  };

  modeSelect.addEventListener('change', handleModeChange);
  chanceInput.addEventListener('input', handleChanceInput);
  chanceInput.addEventListener('change', handleChanceChange);
  lengthInput.addEventListener('input', handleLengthInput);
  lengthInput.addEventListener('change', handleLengthChange);
  sync();

  return {
    element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      modeSelect.removeEventListener('change', handleModeChange);
      chanceInput.removeEventListener('input', handleChanceInput);
      chanceInput.removeEventListener('change', handleChanceChange);
      lengthInput.removeEventListener('input', handleLengthInput);
      lengthInput.removeEventListener('change', handleLengthChange);
    }
  };
}
```

Create `styles.css` with:

```css
[data-linked-passenger-settings] {
  min-width: 0;
  max-width: 100%;
  margin-top: 12px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid #c5cbc8;
  border-radius: 4px;
  background: #f7f8f6;
}

[data-linked-passenger-settings] h3 {
  margin: 0 0 9px;
  color: #34463f;
  font-size: 11px;
}

[data-linked-field] {
  min-width: 0;
  display: grid;
  gap: 5px;
  color: #596761;
  font-size: 11px;
  font-weight: 700;
}

[data-linked-mode],
[data-linked-chance],
[data-linked-max-length] {
  width: 100%;
  min-width: 0;
}

[data-linked-mode] {
  padding: 6px 7px;
  border: 1px solid #b8bebb;
  border-radius: 4px;
  color: #20302b;
  background: #fff;
}

[data-linked-chance-row],
[data-linked-length-row] {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  align-items: end;
  gap: 8px;
  margin-top: 9px;
}

[data-linked-chance],
[data-linked-max-length] {
  margin: 0;
  accent-color: #397b5d;
}

[data-linked-chance-output],
[data-linked-max-length-output] {
  color: #26342f;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-align: right;
}

[data-linked-authored-summary] {
  margin: 9px 0 0;
  color: #4a5752;
  font-size: 11px;
  line-height: 1.4;
}

[data-linked-passenger-settings] [hidden] { display: none; }

[data-linked-mode]:focus-visible,
[data-linked-chance]:focus-visible,
[data-linked-max-length]:focus-visible {
  outline: 2px solid #36765a;
  outline-offset: 2px;
}

@media (max-width: 860px) {
  [data-linked-passenger-settings] {
    width: 100%;
    padding: 9px;
  }
}
```

Export the detail view in `index.js`:

```js
import { createLinkedPassengerDetailView } from './view.js';
export const createDetailView = createLinkedPassengerDetailView;
export default { definition, createRuntime, createDetailView };
```

Add the stylesheet import directly after the question import:

```css
@import './mechanics/linked-passengers/styles.css';
```

Add the page-session default in `main.js`:

```js
const mechanicSessionOptions = {
  'question-passenger': { mode: 'chance', chance: 0.3 },
  'linked-passengers': { mode: 'chance', chance: 0.3, maxLength: 10 }
};
```

- [ ] **Step 4: Run UI/session tests**

```powershell
node --test test/linked-passengers-mechanic.test.js test/mechanic-registry.test.js test/game-model.test.js
```

Expected: settings render/commit/cleanup tests and page-session-only assertions pass.

- [ ] **Step 5: Commit settings**

```powershell
git add src/mechanics/linked-passengers/index.js src/mechanics/linked-passengers/view.js src/mechanics/linked-passengers/styles.css src/styles.css src/main.js test/linked-passengers-mechanic.test.js test/mechanic-registry.test.js test/game-model.test.js
git commit -m "feat: add linked passenger settings"
```

## Task 7: Render Segmented Top Connectors And Head Badges

**Files:**
- Modify: `src/scene-view.js:700-760,1330-1380,1845-2020,2225-2240`
- Modify: `test/linked-passengers-mechanic.test.js`

- [ ] **Step 1: Add failing scene-source and reduced-motion-safe connector tests**

Add these focused-test imports:

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { SceneView } from '../src/scene-view.js';
```

Append tests that define `const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');` and assert:

```js
assert.match(sceneSource, /linkedPassengerConnectors = new Map/);
assert.match(sceneSource, /makeLinkedPassengerBadgeTexture/);
assert.match(sceneSource, /syncLinkedPassengerConnectors/);
assert.match(sceneSource, /linkedPassenger\?\.chainId/);
assert.match(sceneSource, /reducedMotionQuery\?\.matches/);
```

Use this WebGL-independent helper test:

```js
test('connector segment spans the midpoint and distance between passenger rows', () => {
  const segment = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    quaternion: new THREE.Quaternion()
  };
  const startRoot = { position: new THREE.Vector3(1, 0, 2) };
  const endRoot = { position: new THREE.Vector3(4, 0, 6) };
  const length = SceneView.prototype.positionLinkedConnectorSegment(
    segment,
    startRoot,
    endRoot
  );
  assert.equal(length, 5);
  assert.deepEqual(segment.position.toArray(), [2.5, 0.58, 4]);
  assert.equal(segment.scale.y, 5);
});
```

- [ ] **Step 2: Run the focused test and observe missing connector helpers**

```powershell
node --test test/linked-passengers-mechanic.test.js
```

Expected: connector source/helper assertions fail.

- [ ] **Step 3: Add cached badge textures, connector lifecycle, and per-frame positioning**

At module scope add:

```js
const linkedPassengerBadgeTextures = new Map();
const LINKED_CONNECTOR_Y_OFFSET = 0.58;

function makeLinkedPassengerBadgeTexture(length) {
  if (linkedPassengerBadgeTextures.has(length)) return linkedPassengerBadgeTextures.get(length);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#18352d';
  context.strokeStyle = '#f6d967';
  context.lineWidth = 10;
  context.roundRect(12, 12, 232, 104, 28);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '800 66px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`×${length}`, 128, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  linkedPassengerBadgeTextures.set(length, texture);
  return texture;
}
```

Initialize in the constructor:

```js
this.linkedPassengerConnectors = new Map();
```

Add methods:

```js
positionLinkedConnectorSegment(segment, startRoot, endRoot) {
  const start = startRoot.position.clone();
  const end = endRoot.position.clone();
  start.y += LINKED_CONNECTOR_Y_OFFSET;
  end.y += LINKED_CONNECTOR_Y_OFFSET;
  const direction = end.clone().sub(start);
  const length = direction.length();
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.scale.set(1, Math.max(0.001, length), 1);
  segment.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  return length;
}

makeLinkedPassengerConnector(length) {
  const root = new THREE.Group();
  const segments = Array.from({ length: length - 1 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf6d967,
        emissive: 0x5d4a08,
        emissiveIntensity: 0.35,
        roughness: 0.45
      })
    );
    root.add(mesh);
    return mesh;
  });
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLinkedPassengerBadgeTexture(length),
    transparent: true,
    depthTest: false
  }));
  badge.scale.set(0.52, 0.26, 1);
  root.add(badge);
  this.scene.add(root);
  return { root, segments, badge, length };
}
```

Implement `syncLinkedPassengerConnectors(snapshot, queueSnapshots)` by collecting complete chain members from:

- `queueSnapshots[queueIndex][itemIndex]` paired with `queuePassengerViews[queueIndex][itemIndex]`.
- `snapshot.slots[slot.index]` paired with `passengerViews[slot.index]`.

Group by `linkedPassenger.chainId`, sort by `memberIndex`, require `members.length === linkedPassenger.length`, create/reuse one connector record, position all `N-1` segments, and place the badge above the head root. Remove and dispose connector records whose IDs are no longer complete/visible. Do not connect partial or mixed queue/belt chains.

Call the method once after both belt and queue passenger roots have their final per-frame positions. In `clearBoardingViews()` and a new `clearLinkedPassengerConnectors()` helper, remove roots, dispose every cylinder geometry/material, and dispose each badge sprite material; badge textures remain cached for the page session.

Reduced motion keeps connectors and the badge fully visible but does not add idle pulsing or scale animation.

- [ ] **Step 4: Run focused and existing scene-contract tests**

```powershell
node --test test/linked-passengers-mechanic.test.js test/question-passenger-mechanic.test.js test/star-passenger-mechanic.test.js test/scene-layout.test.js
```

Expected: connector contracts pass without changing question/star visuals.

- [ ] **Step 5: Commit connectors**

```powershell
git add src/scene-view.js test/linked-passengers-mechanic.test.js
git commit -m "feat: render linked passenger connectors"
```

## Task 8: Add One Aggregate 250 ms Boarding Feedback

**Files:**
- Modify: `src/scene-view.js:743-750,1500-1535,2225-2340`
- Modify: `test/linked-passengers-mechanic.test.js`
- Modify: `test/vehicle-effects.test.js`

- [ ] **Step 1: Add failing tests for aggregate effects and reduced motion**

Add source assertions for `spawnLinkedBoardingBatch`, `linkedBoardingBatches`, `groupCount > 1`, and exact duration `0.25`.

Add a direct `updateBoardingViews` test using two completed fake entries with the same linked batch ID. Assert:

- `spawnAboardSmoke` is called once.
- `onPassengerAboard` is called once.
- `triggerVehicleBoardingPulse` is called once.
- both roots are removed/disposed.

Add a reduced-motion test whose query has `matches: true`; assert the linked entry position remains at its start position while material opacity fades, then the same single aggregate completion fires.

- [ ] **Step 2: Run focused visual/effect tests and confirm aggregate behavior is absent**

```powershell
node --test test/linked-passengers-mechanic.test.js test/vehicle-effects.test.js
```

Expected: new aggregate and reduced-motion assertions fail.

- [ ] **Step 3: Create a separate linked batch animation path without changing scalar boarding timing**

Initialize:

```js
this.linkedBoardingBatches = new Map();
```

Branch in `processBoardingEvents`:

```js
if ((event.groupCount ?? 1) > 1 && event.linkedPassenger) {
  this.spawnLinkedBoardingBatch(event);
} else {
  this.spawnBoardingGroup(event);
}
```

Implement `spawnLinkedBoardingBatch(event)` as follows:

- Use `event.progresses[groupIndex]` to locate each row center.
- Create `event.groupCount * LEVEL_1.groupSize` passenger visuals.
- Use no per-person delay and `duration: 0.25` for every entry.
- Store `linkedBatchId: event.id` on each boarding entry.
- Create one temporary segmented connector and one `×N` badge for the batch; flash connector emissive/opacity during the same 250 ms.
- Store `{ remaining, vehicleId, connectorRoot, connectorMaterials, badgeMaterial }` in `linkedBoardingBatches`.

For normal motion, each person lerps from its row/person start to the vehicle target with the existing `ease(progress)`. For reduced motion:

```js
if (this.reducedMotionQuery?.matches && entry.linkedBatchId != null) {
  entry.root.position.copy(entry.start);
  entry.material.transparent = true;
  entry.material.opacity = 1 - progress;
} else {
  entry.root.position.lerpVectors(entry.start, entry.target, ease(progress));
}
```

On completion of a linked entry, decrement the batch record. Only when `remaining === 0` call:

```js
this.triggerVehicleBoardingPulse(batch.vehicleId, time);
this.vehicleEffects?.spawnAboardSmoke(batch.vehicleId);
this.hooks.onPassengerAboard?.(batch.vehicleId);
```

Then remove/dispose the connector and badge and delete the map entry. Preserve the existing per-person completion branch for scalar events so question/star/base behavior does not change in this mechanic task.

Update `clearBoardingViews()` to dispose every linked batch connector/badge and clear `linkedBoardingBatches`.

- [ ] **Step 4: Run focused and complete scene/effect regression tests**

```powershell
node --test test/linked-passengers-mechanic.test.js test/vehicle-effects.test.js test/question-passenger-mechanic.test.js test/star-passenger-mechanic.test.js
```

Expected: one aggregate smoke/audio/pulse for linked batches, no positional fan in reduced motion, and all scalar visual tests pass.

- [ ] **Step 5: Commit boarding feedback**

```powershell
git add src/scene-view.js test/linked-passengers-mechanic.test.js test/vehicle-effects.test.js
git commit -m "feat: animate linked passenger boarding"
```

## Task 9: Release Gate, Full Verification, Browser QA, And Durable Handoff

**Files:**
- Modify: `src/mechanics/linked-passengers/index.js`
- Modify: `test/mechanic-registry.test.js:900-960`
- Modify: `test/mechanic-architecture.test.js`
- Modify: `docs/project/code-navigation.md`
- Modify: `docs/project/playable-project-progress.md`
- Modify: `task_plan.md`
- Modify: `progress.md`

- [ ] **Step 1: Add failing release-status and catalog-count tests**

Update `PLANNED_MECHANIC_IDS` so it also excludes `linked-passengers`, rename the release test to include linked passengers, and require:

```js
assert.equal(getMechanicById('linked-passengers').status, 'playable');
assert.equal(resolvePlayableMechanicId('linked-passengers'), 'linked-passengers');
assert.equal(MECHANICS.filter(({ status }) => status === 'playable').length, 4);
assert.equal(PLANNED_MECHANIC_IDS.length, 13);
```

Extend `test/mechanic-architecture.test.js`:

```js
test('linked passenger owns model and detail files while game model stays generic', () => {
  const modelSource = readFileSync(join('src', 'mechanics', 'linked-passengers', 'model.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'mechanics', 'linked-passengers', 'view.js'), 'utf8');
  const gameSource = readFileSync(join('src', 'game-model.js'), 'utf8');
  assert.match(modelSource, /createLinkedPassengerRuntime/);
  assert.match(viewSource, /createLinkedPassengerDetailView/);
  assert.match(gameSource, /getBeltEntryBatch/);
  assert.match(gameSource, /getBoardingBatch/);
  assert.doesNotMatch(gameSource, /linked-passengers/);
});
```

- [ ] **Step 2: Run release tests and confirm only planned status/count assertions fail**

```powershell
node --test test/mechanic-registry.test.js test/mechanic-architecture.test.js test/linked-passengers-mechanic.test.js
```

Expected: implementation tests pass; status/count assertions fail because the mechanic is still planned.

- [ ] **Step 3: Flip the mechanic to playable and run the complete automated gate immediately**

Change only:

```js
status: 'playable',
```

Run:

```powershell
pnpm test
pnpm run build
```

Expected: every test passes and Vite builds successfully. The existing chunk-size warning is acceptable; no new warnings/errors are acceptable.

If either command fails, change the definition back to `status: 'planned'`, fix the failure with the narrowest relevant test, and repeat this step before browser QA.

- [ ] **Step 4: Start or reuse Vite and perform desktop browser QA at 1280×720**

Before controlling the in-app browser, read and use `browser:control-in-app-browser`.

Start only if no current server responds:

```powershell
pnpm exec vite --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/?mechanic=linked-passengers
```

Verify all of the following:

- The mechanic is playable and the planned overlay is absent.
- Chance mode starts at 30% and maximum length 10.
- Switching to authored and back preserves page-session values; refresh resets to chance/30%/10.
- Waiting chains show segmented top connectors and exactly one `×N` badge at the head.
- A chain enters only when all required consecutive belt slots are free, including a visible ring-wrap case.
- A chain with insufficient vehicle capacity loops intact.
- A capacity-compatible vehicle boards all rows together; one `×N`, one aggregate smoke, one pulse, and one boarding sound occur.
- `window.__busLoop.snapshot()` shows one aggregate event with matching `groupCount`, `passengerIds`, and `slotIndices`.
- No connector remains orphaned after boarding/reset/mechanic switching.
- Console contains no new JavaScript errors. Existing FBX parse warnings and the four known texture HTML fallback messages may remain.

- [ ] **Step 5: Perform mobile QA at 390×844 and live reduced-motion QA**

At 390×844 verify the settings panel fits without horizontal overflow, both queue connectors remain legible, the `×N` badge does not cover the queue head, and all gameplay controls remain usable.

For live reduced motion, override the already-constructed view query using browser evaluation, then reset:

```js
window.__busLoop.view.reducedMotionQuery = { matches: true };
window.__busLoop.reset();
```

Verify linked boarding uses brightness/fade with no fan displacement, while the connector/badge, vehicle feedback, one smoke, and one sound remain visible/audible.

- [ ] **Step 6: Update durable navigation/progress only after all gates pass**

Update `docs/project/code-navigation.md` with:

- A linked-passenger model/settings route and the new focused test.
- Scene connector/aggregate boarding ownership.
- `src/mechanics/linked-passengers/` in file responsibilities.
- 4 playable / 13 planned and the new full-suite count from the actual `pnpm test` output.
- Actual desktop/mobile/reduced-motion browser result and retained known warnings.

Update `docs/project/playable-project-progress.md`, `task_plan.md`, and `progress.md` concisely with outcome, changed areas, exact automated/build results, browser QA, and the next selection step. Update `findings.md` only if implementation discovered a durable correction to the approved design.

- [ ] **Step 7: Re-run documentation, unfinished-marker, and status consistency checks**

```powershell
rg -n "linked-passengers|4 playable|13 planned" docs/project/code-navigation.md docs/project/playable-project-progress.md task_plan.md progress.md src/mechanics/linked-passengers/index.js
node --input-type=module -e "import('./src/mechanics/index.js').then(({MECHANIC_DEFINITIONS})=>{const playable=MECHANIC_DEFINITIONS.filter(m=>m.status==='playable').length;const planned=MECHANIC_DEFINITIONS.filter(m=>m.status==='planned').length;console.log(playable,planned);if(playable!==4||planned!==13)process.exit(1)})"
```

Expected: linked mechanic references are current and the script prints `4 13`.

- [ ] **Step 8: Commit the verified release and docs**

```powershell
git add src/mechanics/linked-passengers/index.js test/mechanic-registry.test.js test/mechanic-architecture.test.js docs/project/code-navigation.md docs/project/playable-project-progress.md task_plan.md progress.md
git commit -m "feat: release linked passenger mechanic"
```

## Plan Self-Review Gate

Before execution begins, verify the plan itself:

- [ ] Chance generation covers 0–100%, strict `< chance`, uniform integer length 2..allowed maximum, multiple non-overlapping chains, and same-color-only runs.
- [ ] Authored generation covers exact start arrays, both queues, 2/3/4/6/8/10 demos, earlier-valid-wins overlap handling, invalid-current-start scanning, no clamping, one warning maximum, missing/non-array/extra handling.
- [ ] Queue behavior covers complete visible admission, intentional capacity gaps, stable absolute source indices, and complete refill batches.
- [ ] Conveyor behavior covers atomic entry, current crossing slot as head, trailing slots opposite movement, modulo wrap, no partial dequeue, and initial-fill escape.
- [ ] Boarding behavior covers chain-head triggering, all-member discovery/order, sufficient same-color vehicle capacity, all-or-none clearing, looping on insufficient space, aggregate events, and win/fail availability checks.
- [ ] UI covers independent chance/authored modes, 30% and max-10 defaults, page-session persistence, refresh reset, and no question/star stacking.
- [ ] Visuals cover segmented top connector, one head `×N`, synchronous 250 ms fan-in, one aggregate smoke/audio/pulse, cleanup, mobile layout, and reduced motion.
- [ ] Release remains planned until focused/full/build/browser gates pass, then updates catalog counts and durable docs.

Run an unfinished-marker scan without embedding the marker strings literally in this plan:

```powershell
node -e "const fs=require('fs');const p='docs/superpowers/plans/2026-07-13-linked-passengers.md';const s=fs.readFileSync(p,'utf8');const terms=['T'+'ODO','T'+'BD','F'+'IXME','place'+'holder'];const hits=terms.filter(t=>s.includes(t));console.log(hits);if(hits.length)process.exit(1)"
```

Expected: `[]`.

Finally run:

```powershell
git status --short
git log -1 --oneline
```

Expected before implementation: only the committed plan/design documentation changes are present; no production implementation is accidentally staged or modified.
