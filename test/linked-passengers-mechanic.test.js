import test from 'node:test';
import assert from 'node:assert/strict';
import linkedPassengerMechanic, {
  createRuntime
} from '../src/mechanics/linked-passengers/index.js';
import { createLinkedPassengerRuntime } from '../src/mechanics/linked-passengers/model.js';
import { LEVEL_1 } from '../src/level-data.js';
import { BusLoopGame } from '../src/game-model.js';
import * as mechanics from '../src/mechanics/index.js';

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

test('linked runtime normalizes options, clones metadata, and implements batch hooks', () => {
  const values = [0, 0];
  const runtime = createRuntime({
    level: makeLevel([[0, 0, 0]]),
    options: { mode: 'wrong', chance: 4, maxLength: 99 },
    random: () => values.shift() ?? 1
  });
  const state = runtime.createState().linkedPassenger;
  assert.equal(runtime.id, 'linked-passengers');
  assert.equal(state.mode, 'chance');
  assert.equal(state.chance, 1);
  assert.equal(state.maxLength, 10);
  assert.deepEqual(runtime.createSlotData(), { linkedPassenger: null });

  const headMetadata = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).linkedPassenger;
  const tailMetadata = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).linkedPassenger;
  assert.deepEqual(headMetadata, {
    chainId: 'linked-0-0',
    length: 2,
    memberIndex: 0,
    isHead: true
  });
  const item = { linkedPassenger: headMetadata };
  const itemSnapshot = runtime.cloneQueueItemSnapshot(item);
  assert.deepEqual(itemSnapshot, item);
  assert.notEqual(itemSnapshot.linkedPassenger, item.linkedPassenger);
  const slotSnapshot = runtime.cloneSlotSnapshot(item);
  assert.deepEqual(slotSnapshot, item);
  assert.notEqual(slotSnapshot.linkedPassenger, item.linkedPassenger);

  const game = { mechanicState: { linkedPassenger: state } };
  const decorated = runtime.decorateSnapshot(game);
  assert.deepEqual(decorated.linkedPassenger, state);
  assert.notEqual(decorated.linkedPassenger, state);
  assert.equal(runtime.getQueueAdmissionBatchSize({ queueIndex: 0, sourceIndex: 0 }), 2);
  assert.equal(runtime.getQueueAdmissionBatchSize({ queueIndex: 0, sourceIndex: 1 }), 1);

  const head = { id: 1, linkedPassenger: headMetadata };
  const tail = { id: 2, linkedPassenger: tailMetadata };
  assert.deepEqual(runtime.getBeltEntryBatch({ queue: [head, tail] }), [head, tail]);
  assert.deepEqual(runtime.getBeltEntryBatch({ queue: [head] }), []);
  assert.deepEqual(runtime.getBeltEntryBatch({ queue: [tail] }), []);
  const unlinked = { id: 3, linkedPassenger: null };
  assert.deepEqual(runtime.getBeltEntryBatch({ queue: [unlinked] }), [unlinked]);

  const headSlot = { index: 0, linkedPassenger: headMetadata };
  const tailSlot = { index: 1, linkedPassenger: tailMetadata };
  assert.deepEqual(
    runtime.getBoardingBatch({ slot: headSlot, slots: [tailSlot, headSlot] }),
    [headSlot, tailSlot]
  );
  assert.deepEqual(runtime.getBoardingBatch({ slot: tailSlot, slots: [tailSlot, headSlot] }), []);
  assert.deepEqual(runtime.getBoardingBatch({ slot: unlinked, slots: [unlinked] }), [unlinked]);

  const enteredSlot = { linkedPassenger: null };
  runtime.onPassengerEnteredBelt({ slot: enteredSlot, passenger: head });
  assert.deepEqual(enteredSlot.linkedPassenger, headMetadata);
  assert.notEqual(enteredSlot.linkedPassenger, headMetadata);
  assert.deepEqual(runtime.onPassengerBatchBoarded({ slots: [headSlot, tailSlot] }), {
    linkedPassenger: { chainId: 'linked-0-0', length: 2 }
  });
  assert.deepEqual(runtime.onPassengerBatchBoarded({ slots: [unlinked] }), {});
  runtime.clearSlotData({ slot: enteredSlot });
  assert.equal(enteredSlot.linkedPassenger, null);
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

test('level18 authored starts contain balanced 2 3 4 6 8 and 10 row chains on both queues', () => {
  const rows = LEVEL_1.mechanics['linked-passengers'].authoredStarts;
  assert.deepEqual(rows.map((row) => row.filter((value) => value > 0)), [
    [10, 4, 8, 3, 6, 2],
    [8, 6, 10, 4, 3, 2]
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
  assert.equal(game.snapshot().queues[0].length, 3);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.sourceIndex), [3, 4, 5]);
  assert.equal(game.snapshot().sourceRemaining, 0);
});

test('linked passenger batch hooks remain reachable through a linked-passengers plus garage composite', () => {
  assert.equal(typeof mechanics.createCompositeRuntime, 'function');
  const linked = createLinkedPassengerRuntime({
    level: makeLevel([[0, 0]], [[2, 0]]),
    options: { mode: 'authored' }
  });
  linked.createState();
  const composite = mechanics.createCompositeRuntime([
    linked,
    {
      id: 'garage',
      onPassengerBatchBoarded: () => ({ garageBatch: true })
    }
  ]);
  const head = {
    linkedPassenger: linked.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).linkedPassenger
  };
  const tail = {
    linkedPassenger: linked.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).linkedPassenger
  };

  assert.equal(composite.id, 'linked-passengers+garage');
  assert.equal(composite.getQueueAdmissionBatchSize({ queueIndex: 0, sourceIndex: 0 }), 2);
  assert.deepEqual(composite.getBeltEntryBatch({ queue: [head, tail] }), [head, tail]);
  assert.deepEqual(composite.getBoardingBatch({ slot: head, slots: [tail, head] }), [head, tail]);
  assert.deepEqual(composite.onPassengerBatchBoarded({ slots: [head, tail] }), {
    linkedPassenger: { chainId: 'linked-0-0', length: 2 },
    garageBatch: true
  });
});

test('queue capacity normalization rejects non-finite values and preserves bounded numeric inputs', () => {
  const level = makeGameLevel({
    queue: [0, 1, 2, 3, 4, 5],
    authoredStarts: [0, 0, 0, 0, 0, 0]
  });
  const game = new BusLoopGame(level);

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
    game.initializeQueues([value], 0.5, [2], 1);
    assert.equal(game.snapshot().queues[0].length, level.queueCapacity);
    assert.equal(game.snapshot().sourceRemaining, 1);
  }

  game.initializeQueues([-1], 0.5, [2], 1);
  assert.equal(game.snapshot().queues[0].length, 0);
  assert.equal(game.snapshot().sourceRemaining, 6);

  game.initializeQueues([2.9], 0.5, [2], 1);
  assert.equal(game.snapshot().queues[0].length, 2);
  assert.equal(game.snapshot().sourceRemaining, 4);
});
