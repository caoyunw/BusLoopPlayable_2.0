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
