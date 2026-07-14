import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BusLoopGame } from '../src/game-model.js';
import { LEVEL_1 } from '../src/level-data.js';
import {
  createRotaryLaneRuntime,
  normalizeRotaryLanes,
  rotateLaneOccupants
} from '../src/mechanics/rotary-lane/model.js';

const VEHICLES = Object.freeze([
  { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
  { id: 2, seats: 4, colorIndex: 1, x: 1, z: 0, yaw: 90 },
  { id: 3, seats: 4, colorIndex: 2, x: 1, z: 1, yaw: 180 }
]);

const LANE = Object.freeze({
  id: 'loop-a',
  slots: Object.freeze([
    Object.freeze({ x: 0, z: 0, yaw: 90, vehicleId: 1 }),
    Object.freeze({ x: 1, z: 0, yaw: 0, vehicleId: null }),
    Object.freeze({ x: 1, z: 1, yaw: -90, vehicleId: 2 }),
    Object.freeze({ x: 0, z: 1, yaw: 180, vehicleId: 3 })
  ])
});

function createLaneGame({ lanes = [LANE], vehicles = VEHICLES, options = {} } = {}) {
  const level = {
    ...LEVEL_1,
    containers: [],
    vehicleDepthes: {},
    vehicles: vehicles.map((vehicle) => ({ ...vehicle })),
    mechanics: {
      ...LEVEL_1.mechanics,
      'rotary-lane': { lanes }
    }
  };
  const game = new BusLoopGame(level, { random: () => 0 });
  const runtime = createRotaryLaneRuntime({
    level,
    options: { shiftDuration: 0.1, ...options }
  });
  game.mechanicRuntime = runtime;
  game.mechanicState = runtime.createState(game);
  runtime.afterReset({ game });
  return { game, runtime };
}

function advance(game, seconds, step = 0.05) {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) game.update(step);
}

test('normalization keeps valid degree-based lanes and rejects invalid or conflicting lanes', () => {
  const result = normalizeRotaryLanes({
    lanes: [
      LANE,
      { ...LANE, id: 'loop-a' },
      { id: 'too-short', slots: LANE.slots.slice(0, 2) },
      {
        id: 'duplicate-vehicle',
        slots: LANE.slots.map((slot, index) => ({
          ...slot,
          vehicleId: index === 0 ? 1 : null
        }))
      },
      {
        id: 'unknown-vehicle',
        slots: LANE.slots.map((slot, index) => ({
          ...slot,
          vehicleId: index === 0 ? 999 : null
        }))
      }
    ]
  }, VEHICLES);

  assert.equal(result.invalidLaneCount, 4);
  assert.deepEqual(result.lanes, [LANE]);
});

test('occupants and empty slots rotate forward exactly one slot with wraparound', () => {
  assert.deepEqual(
    rotateLaneOccupants([1, null, 2, 3]),
    [3, 1, null, 2]
  );
});

test('afterReset places authored lane vehicles and enables dynamic blockers', () => {
  const { game } = createLaneGame();
  const vehicle = game.getVehicle(2);
  assert.deepEqual(
    { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw, dynamic: vehicle.useDynamicBlockers },
    { x: 1, z: 1, yaw: -90, dynamic: true }
  );
});

test('successful ordinary dispatch starts one synchronized shift and locks all input', () => {
  const ordinary = { id: 4, seats: 4, colorIndex: 0, x: -2, z: 0, yaw: 180 };
  const { game } = createLaneGame({ vehicles: [...VEHICLES, ordinary] });
  assert.equal(game.clickVehicle(4).ok, true);
  assert.equal(game.mechanicState.rotaryLane.phase, 'shifting');
  assert.equal(game.canVehicleDispatch(game.getVehicle(1)), false);
  assert.deepEqual(
    game.mechanicState.rotaryLane.lanes[0].occupants,
    [3, 1, null, 2]
  );
  advance(game, 0.15);
  assert.equal(game.mechanicState.rotaryLane.phase, 'idle');
  assert.equal(game.getVehicle(1).x, 1);
  assert.equal(game.getVehicle(1).z, 0);
  assert.equal(game.getVehicle(1).yaw, 0);
});

test('blocked or unavailable clicks do not rotate the lane', () => {
  const blocker = { id: 4, seats: 4, colorIndex: 0, x: 0.35, z: 0, yaw: 0 };
  const { game } = createLaneGame({ vehicles: [...VEHICLES, blocker] });
  const before = [...game.mechanicState.rotaryLane.lanes[0].occupants];
  assert.equal(game.getBlockers(1).includes(4), true);
  assert.equal(game.clickVehicle(1).ok, false);
  assert.deepEqual(game.mechanicState.rotaryLane.lanes[0].occupants, before);
  assert.equal(game.mechanicState.rotaryLane.phase, 'idle');
});

test('dispatching a lane vehicle waits for origin clearance before shifting all lanes', () => {
  const secondLane = {
    id: 'loop-b',
    slots: [
      { x: 3, z: 3, yaw: 90, vehicleId: 5 },
      { x: 4, z: 3, yaw: 0, vehicleId: null },
      { x: 4, z: 4, yaw: -90, vehicleId: 6 },
      { x: 3, z: 4, yaw: 180, vehicleId: 7 }
    ]
  };
  const extra = [5, 6, 7].map((id, index) => ({
    id, seats: 4, colorIndex: index, x: 3 + index * 0.2, z: 3, yaw: 90
  }));
  const { game } = createLaneGame({
    lanes: [LANE, secondLane],
    vehicles: [...VEHICLES, ...extra]
  });
  assert.equal(game.clickVehicle(1).ok, true);
  assert.equal(game.mechanicState.rotaryLane.phase, 'waiting-clearance');
  assert.deepEqual(game.mechanicState.rotaryLane.lanes[0].occupants, [null, null, 2, 3]);
  advance(game, 0.05);
  assert.notEqual(game.mechanicState.rotaryLane.phase, 'idle');
  advance(game, 0.5);
  assert.equal(game.mechanicState.rotaryLane.phase, 'idle');
  assert.deepEqual(game.mechanicState.rotaryLane.lanes[1].occupants, [7, 5, null, 6]);
});

test('active clearance or shifting state is pending and snapshot data is cloned', () => {
  const ordinary = { id: 4, seats: 4, colorIndex: 0, x: -2, z: 0, yaw: 180 };
  const { game, runtime } = createLaneGame({ vehicles: [...VEHICLES, ordinary] });
  game.clickVehicle(4);
  assert.equal(runtime.hasPendingVehicles(game), true);
  const snapshot = runtime.decorateSnapshot(game);
  snapshot.rotaryLane.lanes[0].slots[0].x = 999;
  assert.equal(game.mechanicState.rotaryLane.lanes[0].slots[0].x, 0);
  advance(game, 0.15);
  assert.equal(runtime.hasPendingVehicles(game), false);
});

test('reset restores authored occupancy positions yaw and idle state', () => {
  const ordinary = { id: 4, seats: 4, colorIndex: 0, x: -2, z: 0, yaw: 180 };
  const { game } = createLaneGame({ vehicles: [...VEHICLES, ordinary] });
  game.clickVehicle(4);
  advance(game, 0.15);
  game.reset();
  assert.equal(game.mechanicState.rotaryLane.phase, 'idle');
  assert.deepEqual(game.mechanicState.rotaryLane.lanes[0].occupants, [1, null, 2, 3]);
  assert.deepEqual(
    { x: game.getVehicle(1).x, z: game.getVehicle(1).z, yaw: game.getVehicle(1).yaw },
    { x: 0, z: 0, yaw: 90 }
  );
});

test('level18 authors one frozen six-slot rotary lane', () => {
  const config = LEVEL_1.mechanics['rotary-lane'];
  assert.equal(Object.isFrozen(config), true);
  assert.equal(config.lanes.length, 1);
  assert.equal(Object.isFrozen(config.lanes[0]), true);
  assert.equal(Object.isFrozen(config.lanes[0].slots), true);
  assert.equal(config.lanes[0].slots.length, 6);
  assert.deepEqual(
    config.lanes[0].slots.map(({ vehicleId }) => vehicleId),
    [56, 55, 32, 31, 28, 35]
  );
});

test('selected rotary lane runtime composes with automatic level garages', () => {
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: 'rotary-lane',
    random: () => 0
  });
  const snapshot = game.snapshot();
  assert.match(game.mechanicRuntime.id, /rotary-lane/);
  assert.match(game.mechanicRuntime.id, /garage/);
  assert.equal(snapshot.rotaryLane.lanes.length, 1);
  assert.equal(snapshot.garages.length, 2);
});

test('scene owns rotary lane geometry lifecycle arrows separators and trigger glow', () => {
  const source = readFileSync(new URL('../src/scene-view.js', import.meta.url), 'utf8');
  for (const token of [
    'rotaryLaneViews',
    'createRotaryLaneView',
    'updateRotaryLaneViews',
    'disposeRotaryLaneViews',
    'triggerVersion',
    'reducedMotionQuery'
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /BoxGeometry/);
  assert.match(source, /ConeGeometry/);
  assert.match(source, /emissiveIntensity/);
});
