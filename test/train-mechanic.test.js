import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planTrainCarriages
} from '../src/mechanics/train/model.js';

test('chance assignment selects only capacity-ten vehicles in a complete four-car set', () => {
  const vehicles = [
    { id: 1, seats: 10 },
    { id: 2, seats: 10 },
    { id: 3, seats: 10 },
    { id: 4, seats: 10 },
    { id: 5, seats: 10 },
    { id: 6, seats: 6 }
  ];

  assert.deepEqual(
    planTrainCarriages({
      vehicles,
      mode: 'chance',
      chance: 1,
      random: () => 0
    }),
    {
      mode: 'chance',
      chance: 1,
      vehicleIds: [1, 2, 3, 4],
      authoredGroupCount: 0,
      authoredCarriageCount: 0,
      invalidAuthoredGroupCount: 0
    }
  );
});

test('authored assignment accepts only disjoint groups of four valid capacity-ten vehicles', () => {
  const vehicles = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    seats: index === 8 ? 6 : 10
  }));

  assert.deepEqual(
    planTrainCarriages({
      vehicles,
      mode: 'authored',
      chance: 0.8,
      authoredGroups: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [1, 5, 9, 10],
        [2, 2, 3, 4],
        [5, 6, 7],
        [5, 6, 7, 99]
      ],
      random: () => {
        throw new Error('authored mode must not consume random values');
      }
    }),
    {
      mode: 'authored',
      chance: 0.8,
      vehicleIds: [1, 2, 3, 4, 5, 6, 7, 8],
      authoredGroupCount: 2,
      authoredCarriageCount: 8,
      invalidAuthoredGroupCount: 4
    }
  );
});

test('chance assignment clamps options and caps selection at twelve carriages', () => {
  const vehicles = Array.from({ length: 17 }, (_, index) => ({ id: index, seats: 10 }));
  const plan = planTrainCarriages({
    vehicles,
    mode: 'invalid',
    chance: 4,
    random: () => 0
  });

  assert.equal(plan.mode, 'chance');
  assert.equal(plan.chance, 1);
  assert.equal(plan.vehicleIds.length, 12);
  assert.deepEqual(
    planTrainCarriages({ vehicles, chance: 0, random: () => 0 }).vehicleIds,
    []
  );
});
