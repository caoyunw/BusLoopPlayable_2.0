import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { LEVEL_1 } from '../src/level-data.js';
import { getMechanicById } from '../src/mechanic-registry.js';

function createGarageLevel(overrides = {}) {
  return {
    id: 99,
    mapScale: 1,
    sceneName: 'GarageTest',
    groupSize: 4,
    spotCount: 2,
    conveyorCapacity: 0,
    conveyorSpeed: 0.5,
    conveyorPathLength: 1,
    queueCount: 0,
    queueCapacity: 0,
    entryPercents: [],
    longPressThreshold: 0.2,
    longPressMultiplier: 3,
    exitStart: 0.6,
    exitEnd: 0.8,
    boardingDepartureDelay: 0.1,
    passengerQueue: { spacing: 0.4 },
    passengerEntryMotion: { passengerSpeed: 1 },
    vehicleSize: { width: 0.3, length: 0.7 },
    vehicleMotion: {
      spotStartX: 0,
      spotSpacing: 1,
      spotZ: 0,
      spotYaw: 0,
      spotApproachOffsetZ: 0,
      spotApproachDirection: 'screen-down'
    },
    containers: [
      { id: 7, type: 'Garage', position: { x: 0, y: 0, z: -1 }, yaw: 0 }
    ],
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0, containerType: 'Garage', containerId: 7 },
      { id: 2, seats: 4, colorIndex: 1, x: 0.8, z: 0, yaw: 0 }
    ],
    vehicleDepthes: { 1: [2] },
    passengerSequence: Object.freeze([]),
    passengerQueues: Object.freeze([]),
    assets: { audio: {} },
    ...overrides
  };
}

function advance(game, duration, step = 0.1) {
  for (let elapsed = 0; elapsed < duration; elapsed += step) {
    game.update(Math.min(step, duration - elapsed));
  }
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: expected ${expected}, got ${actual}`);
}

test('garage mechanic is playable and exposes runtime state', () => {
  assert.equal(getMechanicById('garage').status, 'playable');

  const game = new BusLoopGame(createGarageLevel(), { mechanicId: 'garage' });
  const state = game.snapshot();

  assert.equal(game.getMechanicId(), 'garage');
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 1).state, 'in-garage');
  assert.deepEqual(state.garages.map((garage) => ({
    id: garage.id,
    vehicleIds: garage.vehicleIds,
    displayCount: garage.displayCount,
    hidden: garage.hidden
  })), [{ id: 7, vehicleIds: [1], displayCount: 1, hidden: false }]);
});

test('garage containers are active as level features in the base runtime', () => {
  const game = new BusLoopGame(createGarageLevel(), { mechanicId: 'base' });
  const state = game.snapshot();

  assert.equal(game.getMechanicId(), 'base');
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 1).state, 'in-garage');
  assert.deepEqual(state.garages.map((garage) => ({
    id: garage.id,
    vehicleIds: garage.vehicleIds,
    displayCount: garage.displayCount,
    hidden: garage.hidden
  })), [{ id: 7, vehicleIds: [1], displayCount: 1, hidden: false }]);
});

test('garage releases its next hidden vehicle without using authored vehicleDepth blockers', () => {
  const game = new BusLoopGame(createGarageLevel(), {
    mechanicId: 'garage',
    mechanics: { garage: { outDuration: 0.5 } }
  });

  game.update(0.1);
  let state = game.snapshot();
  const releasing = state.vehicles.find((vehicle) => vehicle.id === 1);
  assert.equal(releasing.state, 'leaving-garage');
  assert.equal(state.garages[0].exitingVehicleId, 1);
  assert.equal(state.garages[0].displayCount, 0);
  assert.equal(state.garages[0].hidden, true);
  assert.equal(state.lastEvent.type, 'garage-out');

  advance(game, 0.5);
  state = game.snapshot();
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 1).state, 'parked');
  assert.equal(state.garages[0].vehicleIds.length, 0);
  assert.equal(state.garages[0].exitingVehicleId, null);
});

test('level18 garage first hidden vehicles 38 and 60 auto-release on entry', () => {
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: 'garage',
    mechanics: { garage: { outDuration: 0.5 } }
  });

  game.update(0.1);
  const state = game.snapshot();
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 38).state, 'leaving-garage');
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 60).state, 'leaving-garage');
  assert.deepEqual(state.garages.map((garage) => garage.exitingVehicleId), [38, 60]);
  assert.deepEqual(state.garages.map((garage) => garage.displayCount), [7, 7]);
  assert.deepEqual(state.garages.map((garage) => garage.hidden), [false, false]);
});

test('garage vehicles park at the Unity ParkPos anchor after driving out', () => {
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: 'garage',
    mechanics: { garage: { outDuration: 0.5 } }
  });

  advance(game, 0.6, 0.05);
  let state = game.snapshot();
  const vehicle38 = state.vehicles.find((vehicle) => vehicle.id === 38);
  const vehicle60 = state.vehicles.find((vehicle) => vehicle.id === 60);

  assert.equal(vehicle38.state, 'parked');
  assertNear(vehicle38.x, -0.7070351, 'vehicle 38 park x');
  assertNear(vehicle38.z, 0.33480565, 'vehicle 38 park z');
  assertNear(vehicle38.yaw, 0, 'vehicle 38 park yaw');
  assert.equal(vehicle60.state, 'parked');
  assertNear(vehicle60.x, -0.03203510999999959, 'vehicle 60 park x');
  assertNear(vehicle60.z, 0.6061714244346113, 'vehicle 60 park z');
  assertNear(vehicle60.yaw, -89.999998, 'vehicle 60 park yaw');
  assert.deepEqual(state.garages.map((garage) => garage.exitingVehicleId), [null, null]);

  advance(game, 0.2, 0.05);
  state = game.snapshot();
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 61).state, 'in-garage');
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 68).state, 'in-garage');

  game.getVehicle(38).state = 'at-spot';
  game.update(0.05);
  state = game.snapshot();
  assert.equal(state.vehicles.find((vehicle) => vehicle.id === 61).state, 'leaving-garage');
  assert.equal(state.garages[0].exitingVehicleId, 61);
});

test('garage release order follows authored vehicle order and releases one at a time', () => {
  const level = createGarageLevel({
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0, containerType: 'Garage', containerId: 7 },
      { id: 3, seats: 4, colorIndex: 2, x: 0.4, z: 0, yaw: 0, containerType: 'Garage', containerId: 7 }
    ],
    vehicleDepthes: {}
  });
  const game = new BusLoopGame(level, {
    mechanicId: 'garage',
    mechanics: { garage: { outDuration: 0.25 } }
  });

  game.update(0.01);
  assert.equal(game.snapshot().garages[0].exitingVehicleId, 1);
  assert.equal(game.snapshot().garages[0].displayCount, 1);

  advance(game, 0.25, 0.05);
  assert.equal(game.snapshot().vehicles.find((vehicle) => vehicle.id === 1).state, 'parked');
  assert.equal(game.snapshot().garages[0].exitingVehicleId, null);
  assert.equal(game.clickVehicle(1).ok, true);
  game.update(0.01);
  assert.equal(game.snapshot().garages[0].exitingVehicleId, 3);
  assert.equal(game.snapshot().garages[0].displayCount, 0);
  assert.equal(game.snapshot().garages[0].hidden, true);
});

test('garage scene view has a Unity model asset and renderer support hooks', () => {
  const levelData = readFileSync(join('src', 'level-data.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');

  assert.match(levelData, /garage:\s*'\/assets\/unity\/models\/Truck_01\.fbx'/);
  assert.match(levelData, /Truck_Main_DarkBlue\.png/);
  assert.match(levelData, /Truck_Metal_Matcap\.png/);
  assert.match(viewSource, /garageTemplate/);
  assert.match(viewSource, /updateGarages\(snapshot\)/);
  assert.match(viewSource, /garageYawOffsetDegrees/);
  assert.match(viewSource, /garageModelPitchDegrees/);
  assert.match(viewSource, /sourceMaterialNames/);
  assert.match(viewSource, /MeshMatcapMaterial/);
  assert.match(viewSource, /vehicle\.state === 'leaving-garage'/);
});
