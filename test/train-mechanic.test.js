import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { GameAudioController } from '../src/audio-controller.js';
import { BusLoopGame } from '../src/game-model.js';
import { LEVEL_1 } from '../src/level-data.js';
import { SceneView } from '../src/scene-view.js';
import { SCENE_TUNING } from '../src/scene-tuning.js';
import { createCompositeRuntime } from '../src/mechanics/index.js';
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

test('active train selection composes with the level garage runtime', () => {
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: 'train',
    mechanics: { train: { mode: 'authored' } }
  });
  const snapshot = game.snapshot();

  assert.equal(game.getMechanicId(), 'train');
  assert.equal(snapshot.train.mode, 'authored');
  assert.equal(snapshot.train.carriageVehicleIds.length, 12);
  assert.ok(snapshot.garages.length > 0);
});

test('chance runtime exposes the authored train summary without extra random draws', () => {
  const game = new BusLoopGame(LEVEL_1, { random: () => 0 });
  let randomCalls = 0;
  const runtime = createTrainRuntime({
    level: LEVEL_1,
    random: () => {
      randomCalls += 1;
      return 0.5;
    },
    options: { mode: 'chance', chance: 0 }
  });

  game.mechanicState = runtime.createState(game);

  assert.equal(game.mechanicState.train.mode, 'chance');
  assert.equal(game.mechanicState.train.carriageVehicleIds.length, 0);
  assert.equal(game.mechanicState.train.authoredGroupCount, 3);
  assert.equal(game.mechanicState.train.authoredCarriageCount, 12);
  assert.equal(
    randomCalls,
    game.vehicles.filter(({ seats }) => seats === 10).length
  );
});

function createAuthoredTrainGame() {
  const level = {
    ...LEVEL_1,
    containers: [],
    vehicleDepthes: {},
    mechanics: LEVEL_1.mechanics
  };
  const game = new BusLoopGame(level, { random: () => 0 });
  const runtime = createTrainRuntime({
    level,
    options: { mode: 'authored' },
    random: () => 0
  });
  game.mechanicRuntime = runtime;
  game.mechanicState = runtime.createState(game);
  runtime.afterReset({ game });
  return { game, runtime };
}

test('train carriage dispatch reserves the rail without consuming a normal parking spot', () => {
  const { game } = createAuthoredTrainGame();
  const result = game.clickVehicle(28);

  assert.deepEqual(result, { ok: true, trackSlotIndex: 0 });
  assert.equal(game.getVehicle(28).state, 'moving-to-track');
  assert.equal(game.getVehicle(28).trackSlotIndex, 0);
  assert.deepEqual(game.mechanicState.train.trackSlots[0], {
    index: 0,
    vehicleId: 28
  });
  assert.equal(game.spots.every(({ vehicleId }) => vehicleId === null), true);
});

test('ordinary vehicles still dispatch to normal spots while train destinations report their own limits', () => {
  const { game } = createAuthoredTrainGame();
  const ordinaryResult = game.clickVehicle(30);
  assert.deepEqual(ordinaryResult, { ok: true, spotIndex: 0 });

  for (const id of [28, 29, 31, 39]) {
    assert.equal(game.clickVehicle(id).ok, true);
  }
  assert.deepEqual(game.clickVehicle(32), {
    ok: false,
    reason: 'train-track-full'
  });

  const second = createAuthoredTrainGame().game;
  second.mechanicState.train.locomotive.phase = 'entering';
  assert.deepEqual(second.clickVehicle(28), {
    ok: false,
    reason: 'train-transition'
  });
});

test('composite runtimes forward train dispatch and notify sibling vehicle features once', () => {
  const { game, runtime } = createAuthoredTrainGame();
  let dispatchNotifications = 0;
  const sibling = {
    id: 'sibling',
    createState: () => ({}),
    onVehicleDispatched() {
      dispatchNotifications += 1;
    }
  };
  const composite = createCompositeRuntime([runtime, sibling]);
  game.mechanicRuntime = composite;

  assert.deepEqual(game.clickVehicle(28), { ok: true, trackSlotIndex: 0 });
  assert.equal(dispatchNotifications, 1);
});

test('train runtime moves dispatched carriages to the track and prioritizes them for boarding', () => {
  const { game, runtime } = createAuthoredTrainGame();
  game.clickVehicle(28);

  runtime.update({ game, delta: 1 });
  const carriage = game.getVehicle(28);
  assert.equal(carriage.state, 'at-track');
  assert.equal(carriage.motionData, null);

  const ordinary = game.getVehicle(45);
  ordinary.state = 'at-spot';
  ordinary.spotIndex = 0;
  game.spots[0].vehicleId = ordinary.id;
  assert.equal(ordinary.colorIndex, carriage.colorIndex);
  assert.equal(game.findBoardableVehicle(carriage.colorIndex), carriage);
});

test('a full train carriage waits on the rail instead of departing by itself', () => {
  const { game, runtime } = createAuthoredTrainGame();
  game.clickVehicle(28);
  runtime.update({ game, delta: 1 });
  const carriage = game.getVehicle(28);
  carriage.boardedGroups = 9;
  const slot = game.slots[0];
  slot.colorIndex = carriage.colorIndex;
  slot.passengerId = 9001;

  assert.equal(game.tryBoardPassengerBatch(slot), true);
  assert.equal(carriage.boardedGroups, 10);
  assert.equal(carriage.state, 'train-full');
  assert.equal(game.mechanicState.train.departurePendingAt, null);
  assert.equal(game.boardingEvents.at(-1).trainTrackSlotIndex, 0);
});

test('four full carriages depart atomically and a replacement locomotive enters', () => {
  const level = {
    ...LEVEL_1,
    containers: [],
    vehicleDepthes: {},
    mechanics: LEVEL_1.mechanics
  };
  const game = new BusLoopGame(level, { random: () => 0 });
  const runtime = createTrainRuntime({
    level,
    options: {
      mode: 'authored',
      fullLoadDelay: 0.01,
      departureDuration: 0.1,
      locomotiveEntryDuration: 0.1
    },
    random: () => 0
  });
  game.mechanicRuntime = runtime;
  game.mechanicState = runtime.createState(game);
  runtime.afterReset({ game });

  for (const id of [28, 29, 31, 39]) {
    assert.equal(game.clickVehicle(id).ok, true);
    runtime.update({ game, delta: 1 });
    const vehicle = game.getVehicle(id);
    vehicle.boardedGroups = 10;
    assert.equal(runtime.onVehicleFilled({ game, vehicle }), true);
  }
  assert.equal(game.mechanicState.train.departurePendingAt, 0.01);

  game.time = 0.02;
  runtime.update({ game, delta: 0 });
  assert.equal(game.mechanicState.train.locomotive.phase, 'departing');
  assert.equal(
    [28, 29, 31, 39].every((id) => game.getVehicle(id).state === 'train-departing'),
    true
  );
  assert.equal(game.lastEvent.type, 'train-full');

  runtime.update({ game, delta: 0.1 });
  assert.equal([28, 29, 31, 39].every((id) => game.getVehicle(id).state === 'done'), true);
  assert.deepEqual(game.mechanicState.train.trackSlots, [null, null, null, null]);
  assert.equal(game.mechanicState.train.locomotive.phase, 'entering');

  runtime.update({ game, delta: 0.1 });
  assert.deepEqual(game.mechanicState.train.locomotive, {
    phase: 'ready',
    motion: 1,
    cycle: 1
  });
});

test('open train destinations and locomotive transitions prevent premature deadlock loss', () => {
  const { game } = createAuthoredTrainGame();
  const ordinary = game.getVehicle(30);
  ordinary.state = 'at-spot';
  for (const spot of game.spots) spot.vehicleId = ordinary.id;
  game.sourceQueues = [[], []];
  game.queues = [[], []];
  for (const slot of game.slots) {
    slot.colorIndex = 2;
    slot.passengerId = slot.index + 1;
  }

  game.checkEndState();
  assert.equal(game.status, 'playing');

  game.mechanicState.train.locomotive.phase = 'entering';
  game.checkEndState();
  assert.equal(game.status, 'playing');
});

test('main keeps train settings page-local with a fresh thirty-percent default', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /train:\s*\{\s*mode:\s*['"]chance['"],\s*chance:\s*0\.3\s*\}/
  );
  assert.match(source, /mechanicSessionOptions\[id\]\s*=\s*\{/);
});

test('train scene tuning defines one horizontal four-car track below normal spots', () => {
  assert.deepEqual(
    {
      trackZ: SCENE_TUNING.train.trackZ,
      headX: SCENE_TUNING.train.headX,
      slotSpacing: SCENE_TUNING.train.slotSpacing,
      slotCount: SCENE_TUNING.train.slotCount
    },
    {
      trackZ: 2.6,
      headX: 3.2,
      slotSpacing: 1.25,
      slotCount: 4
    }
  );
});

test('scene owns procedural train track carriage locomotive and capacity-board builders', () => {
  const source = readFileSync(new URL('../src/scene-view.js', import.meta.url), 'utf8');

  for (const method of [
    'createTrainTrackView',
    'createTrainCarriageView',
    'createTrainLocomotiveView',
    'getTrainTrackPosition',
    'updateTrainViews',
    'disposeTrainViews'
  ]) {
    assert.equal(typeof SceneView.prototype[method], 'function', `${method} must exist`);
  }
  assert.match(source, /new THREE\.BoxGeometry/);
  assert.match(source, /new THREE\.CylinderGeometry/);
  assert.match(source, /trainTrackPositions/);
  assert.match(source, /trainSeatCountBoards/);
  assert.match(source, /vehicle\.trainCarriage/);
  assert.match(source, /userData\.vehicleId\s*=\s*vehicle\.id/);
});

test('train remaining-position boards anchor above the carriage roof', () => {
  const source = readFileSync(new URL('../src/scene-view.js', import.meta.url), 'utf8');

  assert.equal(typeof SceneView.prototype.getTrainSeatCountBoardPosition, 'function');
  const position = SceneView.prototype.getTrainSeatCountBoardPosition(0);
  const trackPosition = SceneView.prototype.getTrainTrackPosition(0);

  assert.equal(position.x, trackPosition.x);
  assert.equal(position.z, trackPosition.z);
  assert.ok(position.y > SCENE_TUNING.train.trackY + 0.7);
  assert.match(source, /board\.position\.copy\(this\.getTrainSeatCountBoardPosition\(index\)\)/);
});

test('train boarding events resolve to the rail position instead of a normal spot', () => {
  const view = Object.create(SceneView.prototype);
  view.spotPositions = [new THREE.Vector3(1, 0, 1)];
  view.trainTrackPositions = [new THREE.Vector3(4, 0, 4)];

  assert.equal(
    view.resolveBoardingTarget({ spotIndex: 0, trainTrackSlotIndex: 0 }),
    view.trainTrackPositions[0]
  );
  assert.equal(view.resolveBoardingTarget({ spotIndex: 0 }), view.spotPositions[0]);
});

test('train full feedback deduplicates smoke and the full-vehicle audio by train cycle', () => {
  const view = Object.create(SceneView.prototype);
  const smokeVehicleIds = [];
  view.lastTrainFullKey = '';
  view.vehicleBoardingPulses = new Map();
  view.vehicleEffects = {
    spawnAboardSmoke(vehicleId) {
      smokeVehicleIds.push(vehicleId);
    }
  };
  const snapshot = {
    resetVersion: 4,
    time: 3,
    lastEvent: {
      type: 'train-full',
      cycle: 2,
      vehicleIds: [28, 29, 31, 39]
    }
  };

  view.processTrainEvents(snapshot);
  view.processTrainEvents(snapshot);
  assert.deepEqual(smokeVehicleIds, [28]);
  assert.equal(view.vehicleBoardingPulses.get(28).length, 1);

  const controller = new GameAudioController({
    bus_full: { clips: ['full.wav'], volume: 1 }
  });
  const played = [];
  controller.play = (name) => played.push(name);
  controller.handleGameEvent(snapshot.lastEvent, snapshot.time);
  controller.handleGameEvent(snapshot.lastEvent, snapshot.time);
  assert.deepEqual(played, ['bus_full']);
});

test('scene maps train motion states and locomotive entry from snapshot progress', () => {
  const source = readFileSync(new URL('../src/scene-view.js', import.meta.url), 'utf8');

  assert.match(source, /vehicle\.state === ['"]moving-to-track['"]/);
  assert.match(source, /vehicle\.state === ['"]train-departing['"]/);
  assert.match(source, /locomotive\.phase === ['"]entering['"]/);
  assert.match(source, /SCENE_TUNING\.train\.entryX/);
  assert.match(source, /SCENE_TUNING\.train\.exitX/);
});
