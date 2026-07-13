import assert from 'node:assert/strict';
import test from 'node:test';

import * as questionPassengerMechanic from '../src/mechanics/question-passenger/index.js';

function makeLevel(authoredMasks = [[true, false], [false, true]]) {
  return {
    mechanics: {
      'question-passenger': { authoredMasks }
    }
  };
}

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

test('invalid mode and chance values normalize to safe chance assignment', () => {
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
});

test('runtime exposes mechanic identity and empty slot metadata', () => {
  const runtime = questionPassengerMechanic.createRuntime();

  assert.equal(runtime.id, 'question-passenger');
  assert.deepEqual(runtime.createSlotData(), { questionPassenger: null });
  assert.equal(questionPassengerMechanic.definition.status, 'planned');
  assert.equal(questionPassengerMechanic.default.definition, questionPassengerMechanic.definition);
  assert.equal(questionPassengerMechanic.default.createRuntime, questionPassengerMechanic.createRuntime);
});
