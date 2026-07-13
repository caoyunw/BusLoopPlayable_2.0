import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import linkedPassengerMechanic, {
  createRuntime
} from '../src/mechanics/linked-passengers/index.js';
import { createLinkedPassengerRuntime } from '../src/mechanics/linked-passengers/model.js';
import { LEVEL_1 } from '../src/level-data.js';
import { BusLoopGame } from '../src/game-model.js';
import * as mechanics from '../src/mechanics/index.js';
import * as THREE from 'three';
import { SceneView } from '../src/scene-view.js';

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

class DetailElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.hidden = false;
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  matches(selector) {
    if (selector.startsWith('[') && selector.endsWith(']')) {
      return this.attributes.has(selector.slice(1, -1));
    }
    return this.tagName === selector.toUpperCase();
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
  }
}

const detailDocument = {
  createElement: (tagName) => new DetailElement(tagName)
};

test('linked detail styles stay mechanic-owned and load after question settings', () => {
  const css = readFileSync(join('src', 'styles.css'), 'utf8');
  const linkedCss = readFileSync(
    join('src', 'mechanics', 'linked-passengers', 'styles.css'),
    'utf8'
  );

  assert.match(
    css,
    /^@import ['"]\.\/mechanics\/question-passenger\/styles\.css['"];\s*\n@import ['"]\.\/mechanics\/linked-passengers\/styles\.css['"];/
  );
  assert.match(linkedCss, /\[data-linked-passenger-settings\]/);
  assert.match(linkedCss, /\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(linkedCss, /:focus-visible/);
  assert.match(linkedCss, /@media\s*\(max-width:\s*860px\)/);
});

test('linked detail settings render and commit chance max-length and authored modes independently', () => {
  const commits = [];
  const view = linkedPassengerMechanic.createDetailView({
    document: detailDocument,
    options: { mode: 'chance', chance: 0.3, maxLength: 10 },
    state: {
      linkedPassenger: {
        maxVehicleSeats: 10,
        chainCount: 2,
        linkedGroupCount: 5,
        invalidAuthoredCount: 0,
        authoredChainCount: 12,
        authoredLinkedGroupCount: 66,
        authoredInvalidAuthoredCount: 0
      }
    },
    onCommit: (options) => commits.push(options)
  });
  const mode = view.element.querySelector('[data-linked-mode]');
  const chance = view.element.querySelector('[data-linked-chance]');
  const maxLength = view.element.querySelector('[data-linked-max-length]');
  const authoredSummary = view.element.querySelector('[data-linked-authored-summary]');

  assert.ok(view.element.matches('[data-linked-passenger-settings]'));
  assert.equal(mode.value, 'chance');
  assert.equal(chance.value, '30');
  assert.equal(maxLength.value, '10');
  assert.equal(maxLength.getAttribute('max'), '10');
  assert.match(authoredSummary.textContent, /12/);
  assert.match(authoredSummary.textContent, /66/);
  assert.doesNotMatch(authoredSummary.textContent, /固定标记：2 组连体/);
  assert.doesNotMatch(authoredSummary.textContent, /，5 排乘客/);

  chance.value = '45';
  chance.dispatchEvent({ type: 'change' });
  maxLength.value = '6';
  maxLength.dispatchEvent({ type: 'change' });
  mode.value = 'authored';
  mode.dispatchEvent({ type: 'change' });

  assert.equal(authoredSummary.textContent, '固定标记：12 组连体，66 排乘客');
  assert.deepEqual(commits, [
    { mode: 'chance', chance: 0.45, maxLength: 10 },
    { mode: 'chance', chance: 0.45, maxLength: 6 },
    { mode: 'authored', chance: 0.45, maxLength: 6 }
  ]);
  view.destroy();
  chance.value = '70';
  chance.dispatchEvent({ type: 'change' });
  assert.equal(commits.length, 3);
});

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
    invalidAuthoredCount: 0,
    authoredChainCount: 0,
    authoredLinkedGroupCount: 0,
    authoredInvalidAuthoredCount: 0
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
  assert.equal(state.authoredChainCount, 2);
  assert.equal(state.authoredLinkedGroupCount, 4);
  assert.equal(state.authoredInvalidAuthoredCount, 3);
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
  assert.equal(typeof linkedPassengerMechanic.createDetailView, 'function');
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

test('chance state exposes authored summary without consuming extra random values', () => {
  let randomCalls = 0;
  const runtime = createLinkedPassengerRuntime({
    level: makeLevel([[0, 0]], [[2, 0]]),
    options: { mode: 'chance', chance: 0, maxLength: 2 },
    random() {
      randomCalls += 1;
      return 0.5;
    }
  });

  assert.equal(randomCalls, 0);
  assert.deepEqual(runtime.createState().linkedPassenger, {
    mode: 'chance',
    chance: 0,
    maxLength: 2,
    maxVehicleSeats: 10,
    chainCount: 0,
    linkedGroupCount: 0,
    invalidAuthoredCount: 0,
    authoredChainCount: 1,
    authoredLinkedGroupCount: 2,
    authoredInvalidAuthoredCount: 0
  });
  assert.equal(randomCalls, 1);
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
    invalidAuthoredCount: 0,
    authoredChainCount: 0,
    authoredLinkedGroupCount: 0,
    authoredInvalidAuthoredCount: 0
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

test('atomic entry commits the first validated runtime batch without asking the hook again', () => {
  const game = makeLinkedGame();
  game.initializeQueues([3], 0.5, [2], 1);
  let hookCalls = 0;
  game.mechanicRuntime.getBeltEntryBatch = (context) => {
    hookCalls += 1;
    return hookCalls === 1
      ? context.queue
      : [context.queue[0]];
  };
  const expectedPassengerIds = game.snapshot().queueItems[0].map((item) => item.id);

  assert.equal(game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 }), true);
  assert.equal(hookCalls, 1);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].passengerId), expectedPassengerIds);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.sourceIndex), [3]);
});

test('sparse runtime batches are rejected without consuming passengers or changing slots and events', () => {
  const game = makeLinkedGame();
  game.initializeQueues([3], 0.5, [2], 1);
  game.mechanicRuntime.getBeltEntryBatch = ({ queue }) => {
    const sparseBatch = Array(2);
    sparseBatch[0] = queue[0];
    return sparseBatch;
  };
  const beforeIds = game.snapshot().queueItems[0].map((item) => item.id);
  const beforeEvent = { ...game.lastEvent };

  assert.equal(game.peekPassengerBatch(0), null);
  assert.equal(game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 }), false);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.id), beforeIds);
  assert.equal(game.slots.every((slot) => slot.colorIndex === null), true);
  assert.deepEqual(game.lastEvent, beforeEvent);
});

test('a batch larger than the conveyor ring is rejected before dequeue', () => {
  const queue = Array(6).fill(0);
  const level = makeGameLevel({
    queue,
    authoredStarts: [6, 0, 0, 0, 0, 0],
    seats: 6
  });
  level.queueCapacity = 6;
  const game = makeLinkedGame(level);
  const beforeIds = game.snapshot().queueItems[0].map((item) => item.id);
  const beforeEvent = { ...game.lastEvent };

  assert.equal(game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 }), false);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.id), beforeIds);
  assert.equal(game.slots.every((slot) => slot.colorIndex === null), true);
  assert.deepEqual(game.lastEvent, beforeEvent);
});

test('atomic entry rejects foreign heads and missing trailing slots without mutation', () => {
  const foreignHeadGame = makeLinkedGame();
  foreignHeadGame.initializeQueues([3], 0.5, [2], 1);
  const foreignBefore = foreignHeadGame.snapshot().queueItems[0].map((item) => item.id);
  assert.equal(
    foreignHeadGame.tryEnterPassengerBatch({ index: 0 }, { index: 0, percent: 0.1 }),
    false
  );
  assert.deepEqual(foreignHeadGame.snapshot().queueItems[0].map((item) => item.id), foreignBefore);

  const missingSlotGame = makeLinkedGame();
  missingSlotGame.initializeQueues([3], 0.5, [2], 1);
  const missingBefore = missingSlotGame.snapshot().queueItems[0].map((item) => item.id);
  const removedSlot = missingSlotGame.slots[4];
  missingSlotGame.slots[4] = undefined;
  assert.equal(
    missingSlotGame.tryEnterPassengerBatch(missingSlotGame.slots[0], { index: 0, percent: 0.1 }),
    false
  );
  missingSlotGame.slots[4] = removedSlot;
  assert.deepEqual(missingSlotGame.snapshot().queueItems[0].map((item) => item.id), missingBefore);
});

test('update keeps a blocked chain queued and emits the end of fast initial fill', () => {
  const game = makeLinkedGame();
  game.initializeQueues([3], 0.5, [2], 1);
  game.slots[0].progress = 0.09;
  game.slots[0].previousProgress = 0.09;
  game.slots[4].colorIndex = 9;
  const beforeIds = game.snapshot().queueItems[0].map((item) => item.id);
  let notifications = 0;
  const unsubscribe = game.subscribe(() => {
    notifications += 1;
  });

  game.update(0.02);
  unsubscribe();

  assert.equal(game.initialFillActive, false);
  assert.equal(notifications, 2);
  assert.deepEqual(game.snapshot().queueItems[0].map((item) => item.id), beforeIds);
  assert.equal(game.slots[0].colorIndex, null);
  assert.equal(game.slots[3].colorIndex, null);
  assert.equal(game.slots[4].colorIndex, 9);
});

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
  assert.equal(game.hasBoardablePassenger(), false);

  game.update(0);

  assert.equal(vehicle.boardedGroups, 2);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].colorIndex), [0, 0, 0]);
  assert.equal(game.snapshot().boardingEvents.length, 0);
});

test('linked passengers board atomically and emit one deeply cloned aggregate event', () => {
  const game = makeLinkedGame(makeGameLevel({ seats: 4 }));
  game.initializeQueues([3], 0.5, [2], 1);
  const expectedPassengerIds = game.snapshot().queueItems[0].map((item) => item.id);
  game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
  const vehicle = prepareVehicle(game, 1);
  for (const slotIndex of [0, 4, 3]) {
    game.slots[slotIndex].progress = 0.6;
    game.slots[slotIndex].previousProgress = 0.6;
  }
  assert.equal(game.hasBoardablePassenger(), true);

  game.update(0);

  const event = game.snapshot().boardingEvents.at(-1);
  assert.equal(vehicle.boardedGroups, 4);
  assert.equal(vehicle.state, 'boarding-final');
  assert.equal(event.groupCount, 3);
  assert.deepEqual(event.passengerIds, expectedPassengerIds);
  assert.deepEqual(event.slotIndices, [0, 4, 3]);
  assert.deepEqual(event.progresses.map((value) => Number(value.toFixed(6))), [0.6, 0.6, 0.6]);
  assert.equal(event.linkedPassenger.length, 3);
  assert.deepEqual([0, 4, 3].map((index) => game.slots[index].colorIndex), [null, null, null]);

  event.passengerIds.push(99);
  event.slotIndices.push(2);
  event.progresses[0] = 0;
  event.linkedPassenger.length = 99;
  const freshEvent = game.snapshot().boardingEvents.at(-1);
  assert.deepEqual(freshEvent.passengerIds, expectedPassengerIds);
  assert.deepEqual(freshEvent.slotIndices, [0, 4, 3]);
  assert.deepEqual(freshEvent.progresses.map((value) => Number(value.toFixed(6))), [0.6, 0.6, 0.6]);
  assert.equal(freshEvent.linkedPassenger.length, 3);
});

test('snapshot recursively clones aggregate and last-event arrays and mechanic objects', () => {
  const game = makeLinkedGame();
  const event = {
    passengerIds: [1, 2],
    mechanicData: {
      nested: { value: 3 },
      items: [{ value: 4 }]
    }
  };
  game.boardingEvents = [event];
  game.lastEvent = { type: 'group-boarded', ...event };

  const snapshot = game.snapshot();
  snapshot.boardingEvents[0].passengerIds.push(99);
  snapshot.boardingEvents[0].mechanicData.nested.value = 30;
  snapshot.boardingEvents[0].mechanicData.items[0].value = 40;
  snapshot.lastEvent.passengerIds.push(98);
  snapshot.lastEvent.mechanicData.nested.value = 300;

  const fresh = game.snapshot();
  assert.deepEqual(fresh.boardingEvents[0], event);
  assert.deepEqual(fresh.lastEvent, { type: 'group-boarded', ...event });
  assert.notEqual(fresh.boardingEvents[0].mechanicData, event.mechanicData);
  assert.notEqual(fresh.lastEvent.mechanicData, event.mechanicData);
});

test('invalid runtime boarding batches leave slots vehicles and events unchanged', () => {
  const cases = [
    {
      name: 'sparse',
      getBatch(slots) {
        const batch = Array(2);
        batch[0] = slots[0];
        return batch;
      }
    },
    { name: 'foreign', getBatch: () => [{ index: 0, colorIndex: 0, passengerId: 999 }] },
    { name: 'duplicate', getBatch: (slots) => [slots[0], slots[0]] }
  ];

  for (const fixture of cases) {
    const game = makeLinkedGame(makeGameLevel({ seats: 4 }));
    game.initializeQueues([3], 0.5, [2], 1);
    game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
    const vehicle = prepareVehicle(game, 0);
    for (const slotIndex of [0, 4, 3]) {
      game.slots[slotIndex].progress = 0.6;
      game.slots[slotIndex].previousProgress = 0.6;
    }
    const beforeColors = game.slots.map((slot) => slot.colorIndex);
    const beforePassengerIds = game.slots.map((slot) => slot.passengerId);
    game.mechanicRuntime.getBoardingBatch = ({ slots }) => fixture.getBatch(slots);

    game.update(0);

    assert.deepEqual(game.slots.map((slot) => slot.colorIndex), beforeColors, fixture.name);
    assert.deepEqual(game.slots.map((slot) => slot.passengerId), beforePassengerIds, fixture.name);
    assert.equal(vehicle.boardedGroups, 0, fixture.name);
    assert.equal(game.snapshot().boardingEvents.length, 0, fixture.name);
  }
});

test('an incomplete linked chain cannot board or mutate its remaining members', () => {
  const game = makeLinkedGame(makeGameLevel({ seats: 4 }));
  game.initializeQueues([3], 0.5, [2], 1);
  game.tryEnterPassengerBatch(game.slots[0], { index: 0, percent: 0.1 });
  const vehicle = prepareVehicle(game, 0);
  for (const slotIndex of [0, 4, 3]) {
    game.slots[slotIndex].progress = 0.6;
    game.slots[slotIndex].previousProgress = 0.6;
  }
  game.slots[3].linkedPassenger.chainId = 'broken-chain';
  const beforeColors = game.slots.map((slot) => slot.colorIndex);

  game.update(0);

  assert.deepEqual(game.slots.map((slot) => slot.colorIndex), beforeColors);
  assert.equal(vehicle.boardedGroups, 0);
  assert.equal(game.snapshot().boardingEvents.length, 0);
});

test('composite batch boarding preserves scalar runtime behavior and prefers batch hooks', () => {
  const calls = [];
  const composite = mechanics.createCompositeRuntime([
    {
      id: 'scalar',
      onPassengerBoarded({ slot }) {
        calls.push(`scalar-${slot.passengerId}`);
        return { scalarPassengerId: slot.passengerId };
      }
    },
    {
      id: 'batch',
      onPassengerBoarded() {
        calls.push('unexpected-scalar');
        return { wrong: true };
      },
      onPassengerBatchBoarded({ slots }) {
        calls.push(`batch-${slots.length}`);
        return { batchCount: slots.length };
      }
    }
  ]);
  const slots = [{ passengerId: 7 }, { passengerId: 8 }];

  assert.deepEqual(composite.onPassengerBatchBoarded({ slots }), {
    scalarPassengerId: 7,
    batchCount: 2
  });
  assert.deepEqual(calls, ['scalar-7', 'batch-2']);
});

test('scene owns linked connector lifecycle and keeps reduced-motion visuals static', () => {
  const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');

  assert.match(sceneSource, /linkedPassengerConnectors = new Map/);
  assert.match(sceneSource, /makeLinkedPassengerBadgeTexture/);
  assert.match(sceneSource, /syncLinkedPassengerConnectors/);
  assert.match(sceneSource, /linkedPassenger\?\.chainId/);
  assert.match(sceneSource, /reducedMotionQuery\?\.matches/);
});

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

test('connector sync renders only complete chains in one location and disposes stale records', () => {
  const view = Object.create(SceneView.prototype);
  const queueRoots = [0, 1, 2].map((x) => ({
    visible: true,
    position: new THREE.Vector3(x, 0, 0)
  }));
  const beltRoots = Array.from({ length: 3 }, (_, index) => ({
    visible: index === 2,
    position: new THREE.Vector3(index, 0, 1)
  }));
  const disposed = [];
  const removed = [];
  view.scene = { remove: (root) => removed.push(root) };
  view.queuePassengerViews = [queueRoots];
  view.passengerViews = beltRoots;
  view.linkedPassengerConnectors = new Map();
  view.reducedMotionQuery = { matches: true };
  view.makeLinkedPassengerConnector = (length) => ({
    length,
    root: { visible: false, scale: new THREE.Vector3(4, 4, 4) },
    segments: Array.from({ length: length - 1 }, () => ({
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      geometry: { dispose: () => disposed.push('geometry') },
      material: { dispose: () => disposed.push('material') }
    })),
    badge: {
      position: new THREE.Vector3(),
      material: { opacity: 0, dispose: () => disposed.push('badge') }
    }
  });
  const metadata = [0, 1, 2].map((memberIndex) => ({
    chainId: 'linked-0-0',
    length: 3,
    memberIndex,
    isHead: memberIndex === 0
  }));
  const completeQueue = metadata.map((linkedPassenger) => ({ linkedPassenger }));

  view.syncLinkedPassengerConnectors({ slots: [] }, [completeQueue]);

  const record = view.linkedPassengerConnectors.get('linked-0-0');
  assert.ok(record);
  assert.equal(record.root.visible, true);
  assert.deepEqual(record.root.scale.toArray(), [1, 1, 1]);
  assert.equal(record.badge.material.opacity, 1);
  assert.deepEqual(record.badge.position.toArray(), [0, 0.88, 0]);

  view.syncLinkedPassengerConnectors({
    slots: [{ index: 2, linkedPassenger: metadata[2] }]
  }, [[completeQueue[0], completeQueue[1]]]);

  assert.equal(view.linkedPassengerConnectors.size, 0);
  assert.deepEqual(disposed, ['geometry', 'material', 'geometry', 'material', 'badge']);
  assert.deepEqual(removed, [record.root]);
});
