import assert from 'node:assert/strict';
import test from 'node:test';

import { BusLoopGame } from '../src/game-model.js';
import { LEVEL_1 } from '../src/level-data.js';
import * as questionPassengerMechanic from '../src/mechanics/question-passenger/index.js';
import { createQuestionPassengerRuntime } from '../src/mechanics/question-passenger/model.js';

function makeLevel(authoredMasks = [[true, false], [false, true]]) {
  return {
    mechanics: {
      'question-passenger': { authoredMasks }
    }
  };
}

test('level12 provides frozen authored question-passenger masks', () => {
  const questionConfig = LEVEL_1.mechanics['question-passenger'];
  const authoredMasks = questionConfig.authoredMasks;

  assert.equal(authoredMasks.length, 2);
  assert.deepEqual(
    authoredMasks.map((row) => row.length),
    LEVEL_1.passengerQueues.map((row) => row.length)
  );
  assert.equal(authoredMasks.every((row) => row.every((value) => typeof value === 'boolean')), true);
  assert.equal(authoredMasks.flat().filter(Boolean).length, 132);
  assert.equal(authoredMasks.flat().length, 438);
  assert.equal(Object.isFrozen(authoredMasks), true);
  assert.equal(authoredMasks.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(questionConfig), true);
  assert.equal(Object.isFrozen(LEVEL_1.mechanics), true);
});

test('level12 authored mode follows fixed masks without calling random', () => {
  const runtime = createQuestionPassengerRuntime({
    level: LEVEL_1,
    options: { mode: 'authored' },
    random() {
      throw new Error('authored mode must not call random');
    }
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'authored',
      chance: 0.3,
      authoredMarked: 132,
      authoredTotal: 438
    }
  });
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 0 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }).questionPassenger.hidden, true);
});

test('chance mode defaults to 30% and uses a strict lower bound', () => {
  const randomValues = [0.2999, 0.3];
  const runtime = questionPassengerMechanic.createRuntime({
    random: () => randomValues.shift(),
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
  assert.deepEqual(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }), {
    questionPassenger: {
      hidden: true,
      wasHidden: true,
      revealVersion: 0
    }
  });
  assert.deepEqual(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }), {
    questionPassenger: {
      hidden: false,
      wasHidden: false,
      revealVersion: 0
    }
  });
});

test('authored mode uses only strict true masks and never calls random', () => {
  let randomCalls = 0;
  const runtime = questionPassengerMechanic.createRuntime({
    random: () => {
      randomCalls += 1;
      return 0;
    },
    level: makeLevel([[true, 1, false], [false, true]]),
    options: { mode: 'authored' }
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'authored',
      chance: 0.3,
      authoredMarked: 2,
      authoredTotal: 5
    }
  });
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 2, sourceIndex: 0 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 99 }).questionPassenger.hidden, false);
  assert.equal(randomCalls, 0);
});

test('authored masks require array rows from the exact configuration path', () => {
  const missingLevelState = questionPassengerMechanic.createRuntime().createState().questionPassenger;
  assert.equal(missingLevelState.authoredMarked, 0);
  assert.equal(missingLevelState.authoredTotal, 0);

  const missingMasksState = questionPassengerMechanic.createRuntime({
    level: { mechanics: { 'question-passenger': {} } }
  }).createState().questionPassenger;
  assert.equal(missingMasksState.authoredMarked, 0);
  assert.equal(missingMasksState.authoredTotal, 0);

  const nonArrayMasksState = questionPassengerMechanic.createRuntime({
    level: makeLevel('bad')
  }).createState().questionPassenger;
  assert.equal(nonArrayMasksState.authoredMarked, 0);
  assert.equal(nonArrayMasksState.authoredTotal, 0);

  const mixedRowsRuntime = questionPassengerMechanic.createRuntime({
    level: makeLevel([[true, false], { 0: true }, [true, 1]]),
    options: { mode: 'authored' }
  });
  const mixedRowsState = mixedRowsRuntime.createState().questionPassenger;
  assert.equal(mixedRowsState.authoredMarked, 2);
  assert.equal(mixedRowsState.authoredTotal, 4);
  assert.equal(
    mixedRowsRuntime.createQueueItemData({ queueIndex: 1, sourceIndex: 0 }).questionPassenger.hidden,
    false
  );

  const wrongPathState = questionPassengerMechanic.createRuntime({
    level: {
      authoredMasks: [[true]],
      mechanics: {
        authoredMasks: [[true]],
        questionPassenger: { authoredMasks: [[true]] }
      }
    }
  }).createState().questionPassenger;
  assert.equal(wrongPathState.authoredMarked, 0);
  assert.equal(wrongPathState.authoredTotal, 0);
});

test('mode and chance options normalize to safe chance assignment', () => {
  const invalidRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0.2999,
    options: { mode: 'invalid', chance: Number.NaN }
  });
  assert.equal(invalidRuntime.createState().questionPassenger.mode, 'chance');
  assert.equal(invalidRuntime.createState().questionPassenger.chance, 0.3);
  assert.equal(invalidRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);

  const belowRangeRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0,
    options: { chance: -2 }
  });
  assert.equal(belowRangeRuntime.createState().questionPassenger.chance, 0);
  assert.equal(belowRangeRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, false);

  const aboveRangeRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0.999,
    options: { chance: 4 }
  });
  assert.equal(aboveRangeRuntime.createState().questionPassenger.chance, 1);
  assert.equal(aboveRangeRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);

  const coercedRandomValues = [0.4499, 0.45];
  const coercedRuntime = questionPassengerMechanic.createRuntime({
    random: () => coercedRandomValues.shift(),
    options: { chance: '0.45' }
  });
  assert.equal(coercedRuntime.createState().questionPassenger.chance, 0.45);
  assert.equal(coercedRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(coercedRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);

  const positiveInfinityRuntime = questionPassengerMechanic.createRuntime({
    options: { chance: Number.POSITIVE_INFINITY }
  });
  assert.equal(positiveInfinityRuntime.createState().questionPassenger.chance, 0.3);

  const negativeInfinityRuntime = questionPassengerMechanic.createRuntime({
    options: { chance: Number.NEGATIVE_INFINITY }
  });
  assert.equal(negativeInfinityRuntime.createState().questionPassenger.chance, 0.3);
});

test('runtime exposes mechanic identity and empty slot metadata', () => {
  const runtime = questionPassengerMechanic.createRuntime();

  assert.equal(runtime.id, 'question-passenger');
  assert.deepEqual(runtime.createSlotData(), { questionPassenger: null });
  assert.equal(questionPassengerMechanic.definition.status, 'planned');
  assert.equal(questionPassengerMechanic.default.definition, questionPassengerMechanic.definition);
  assert.equal(questionPassengerMechanic.default.createRuntime, questionPassengerMechanic.createRuntime);
});

test('hidden passengers reveal once when entering a belt slot without mutating queue state', () => {
  const runtime = questionPassengerMechanic.createRuntime({ random: () => 0 });
  const passenger = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const slot = runtime.createSlotData();

  runtime.onPassengerEnteredBelt({ slot, passenger });

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
  assert.deepEqual(passenger.questionPassenger, {
    hidden: true,
    wasHidden: true,
    revealVersion: 0
  });
});

test('passengers without question-passenger state clear belt slot state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.onPassengerEnteredBelt({ slot, passenger: {} });

  assert.equal(slot.questionPassenger, null);
});

test('passengers with explicit null question-passenger state clear populated belt slots', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.onPassengerEnteredBelt({ slot, passenger: { questionPassenger: null } });

  assert.equal(slot.questionPassenger, null);
});

test('visible passengers preserve their reveal version when cloned to a belt slot', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const passenger = {
    questionPassenger: {
      hidden: false,
      wasHidden: false,
      revealVersion: 7
    }
  };
  const slot = runtime.createSlotData();

  runtime.onPassengerEnteredBelt({ slot, passenger });

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: false,
    revealVersion: 7
  });
  assert.deepEqual(passenger.questionPassenger, {
    hidden: false,
    wasHidden: false,
    revealVersion: 7
  });
  assert.notEqual(slot.questionPassenger, passenger.questionPassenger);
});

test('queue-item and decorated global snapshots isolate nested runtime state', () => {
  const runtime = questionPassengerMechanic.createRuntime({ random: () => 0 });
  const queueItem = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const game = { mechanicState: runtime.createState() };

  const queueSnapshot = runtime.cloneQueueItemSnapshot(queueItem);
  const globalSnapshot = runtime.decorateSnapshot(game);
  queueSnapshot.questionPassenger.hidden = false;
  globalSnapshot.questionPassenger.mode = 'authored';

  assert.equal(queueItem.questionPassenger.hidden, true);
  assert.equal(game.mechanicState.questionPassenger.mode, 'chance');
  assert.notEqual(queueSnapshot.questionPassenger, queueItem.questionPassenger);
  assert.notEqual(globalSnapshot.questionPassenger, game.mechanicState.questionPassenger);
});

test('slot snapshots clone nested question-passenger state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  const snapshot = runtime.cloneSlotSnapshot(slot);
  snapshot.questionPassenger.revealVersion = 9;

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
  assert.notEqual(snapshot.questionPassenger, slot.questionPassenger);
});

test('queue-item and slot snapshots normalize missing or null mechanic state to null', () => {
  const runtime = questionPassengerMechanic.createRuntime();

  assert.deepEqual(runtime.cloneQueueItemSnapshot({}), { questionPassenger: null });
  assert.deepEqual(
    runtime.cloneQueueItemSnapshot({ questionPassenger: null }),
    { questionPassenger: null }
  );
  assert.deepEqual(runtime.cloneSlotSnapshot({}), { questionPassenger: null });
  assert.deepEqual(
    runtime.cloneSlotSnapshot({ questionPassenger: null }),
    { questionPassenger: null }
  );
});

test('clearing slot data removes question-passenger state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.clearSlotData({ slot });

  assert.equal(slot.questionPassenger, null);
});

test('question-passenger runtime flows hidden queue metadata through game belt entry', () => {
  const authoredMasks = LEVEL_1.passengerQueues.map((queue, queueIndex) => (
    queue.map((_, sourceIndex) => queueIndex === 0 && sourceIndex === 0)
  ));
  const level = {
    ...LEVEL_1,
    mechanics: {
      'question-passenger': { authoredMasks }
    }
  };
  const game = new BusLoopGame(level);
  game.mechanicRuntime = createQuestionPassengerRuntime({
    level,
    options: { mode: 'authored' }
  });

  game.reset();

  const queueSnapshot = game.snapshot();
  assert.deepEqual(queueSnapshot.queueItems[0][0].questionPassenger, {
    hidden: true,
    wasHidden: true,
    revealVersion: 0
  });
  queueSnapshot.queueItems[0][0].questionPassenger.hidden = false;
  assert.equal(game.snapshot().queueItems[0][0].questionPassenger.hidden, true);

  game.slots[0].progress = 0.999;
  game.slots[0].previousProgress = 0.999;
  game.update(0.01);

  const beltSlot = game.snapshot().slots[0];
  assert.equal(beltSlot.entryIndex, 0);
  assert.deepEqual(beltSlot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
});
