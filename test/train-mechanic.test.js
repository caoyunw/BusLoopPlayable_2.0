import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVEL_1 } from '../src/level-data.js';
import {
  createTrainRuntime,
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

test('level18 provides three frozen valid authored train groups', () => {
  const groups = LEVEL_1.mechanics.train.authoredGroups;
  const allIds = groups.flat();
  const vehiclesById = new Map(LEVEL_1.vehicles.map((vehicle) => [vehicle.id, vehicle]));

  assert.equal(Object.isFrozen(groups), true);
  assert.equal(groups.length, 3);
  assert.equal(new Set(allIds).size, 12);
  for (const group of groups) {
    assert.equal(Object.isFrozen(group), true);
    assert.equal(group.length, 4);
    for (const id of group) {
      const vehicle = vehiclesById.get(id);
      assert.equal(vehicle?.seats, 10);
      assert.equal(vehicle?.containerType, undefined);
    }
  }
});

test('train runtime creates isolated track state and marks only selected vehicles after reset', () => {
  const runtime = createTrainRuntime({
    level: LEVEL_1,
    options: { mode: 'authored', chance: 0.8 },
    random: () => {
      throw new Error('authored runtime must not consume random values');
    }
  });
  const game = {
    level: LEVEL_1,
    vehicles: LEVEL_1.vehicles.map((vehicle) => ({
      ...vehicle,
      state: 'parked',
      boardedGroups: 0,
      motion: 0,
      motionData: null,
      spotIndex: null
    }))
  };

  game.mechanicState = runtime.createState(game);
  runtime.afterReset({ game });

  assert.equal(runtime.id, 'train');
  assert.deepEqual(game.mechanicState.train.trackSlots, [null, null, null, null]);
  assert.deepEqual(game.mechanicState.train.locomotive, {
    phase: 'ready',
    motion: 1,
    cycle: 0
  });
  assert.equal(game.mechanicState.train.authoredGroupCount, 3);
  assert.equal(game.mechanicState.train.authoredCarriageCount, 12);
  assert.equal(game.vehicles.filter(({ trainCarriage }) => trainCarriage).length, 12);
  assert.equal(game.vehicles.every((vehicle) => (
    vehicle.trainCarriage ? vehicle.seats === 10 : vehicle.trackSlotIndex == null
  )), true);

  const snapshot = runtime.decorateSnapshot(game);
  snapshot.train.trackSlots[0] = { vehicleId: 999 };
  snapshot.train.carriageVehicleIds.pop();
  snapshot.train.locomotive.phase = 'mutated';
  assert.deepEqual(game.mechanicState.train.trackSlots, [null, null, null, null]);
  assert.equal(game.mechanicState.train.carriageVehicleIds.length, 12);
  assert.equal(game.mechanicState.train.locomotive.phase, 'ready');
});
