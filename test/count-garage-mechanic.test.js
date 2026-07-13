import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { SCENE_TUNING } from '../src/scene-tuning.js';
import { getMechanicById } from '../src/mechanic-registry.js';

function createCountGarageLevel() {
  const fieldVehicles = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    seats: 4,
    colorIndex: index % 3,
    x: index * 0.4,
    z: 0,
    yaw: 0
  }));
  return {
    id: 100,
    mapScale: 1,
    sceneName: 'CountGarageTest',
    groupSize: 4,
    spotCount: 24,
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
      { id: 1, type: 'Garage', position: { x: 0, y: 0, z: -1 }, yaw: 0 },
      { id: 2, type: 'Garage', position: { x: 2, y: 0, z: -1 }, yaw: 0 }
    ],
    vehicles: [
      ...fieldVehicles,
      { id: 101, seats: 4, colorIndex: 4, x: 0, z: 1, yaw: 0, containerType: 'Garage', containerId: 1 },
      { id: 201, seats: 4, colorIndex: 5, x: 2, z: 1, yaw: 0, containerType: 'Garage', containerId: 2 }
    ],
    vehicleDepthes: {},
    passengerSequence: Object.freeze([]),
    passengerQueues: Object.freeze([]),
    assets: { audio: {} }
  };
}

function withParkingSpotCount(count, run) {
  const previous = SCENE_TUNING.parkingSpots.count;
  SCENE_TUNING.parkingSpots.count = count;
  try {
    run();
  } finally {
    SCENE_TUNING.parkingSpots.count = previous;
  }
}

test('count garage unlocks garage 1 after 10 dispatched vehicles and garage 2 after 20', () => {
  assert.equal(getMechanicById('count-garage').status, 'playable');

  withParkingSpotCount(24, () => {
    const game = new BusLoopGame(createCountGarageLevel(), {
      mechanicId: 'count-garage',
      mechanics: { 'count-garage': { outDuration: 0.5 } }
    });

    assert.equal(game.getMechanicId(), 'count-garage');
    assert.deepEqual(game.snapshot().garages.map((garage) => ({
      id: garage.id,
      locked: garage.locked,
      unlockRemaining: garage.unlockRemaining,
      displayCount: garage.displayCount
    })), [
      { id: 1, locked: true, unlockRemaining: 10, displayCount: 10 },
      { id: 2, locked: true, unlockRemaining: 20, displayCount: 20 }
    ]);

    for (let id = 1; id <= 9; id += 1) {
      assert.equal(game.clickVehicle(id).ok, true);
    }
    game.update(0.1);
    assert.deepEqual(game.snapshot().garages.map((garage) => ({
      id: garage.id,
      locked: garage.locked,
      unlockRemaining: garage.unlockRemaining,
      exitingVehicleId: garage.exitingVehicleId
    })), [
      { id: 1, locked: true, unlockRemaining: 1, exitingVehicleId: null },
      { id: 2, locked: true, unlockRemaining: 11, exitingVehicleId: null }
    ]);

    assert.equal(game.clickVehicle(10).ok, true);
    game.update(0.1);
    let state = game.snapshot();
    assert.equal(state.garages[0].locked, false);
    assert.equal(state.garages[0].unlockRemaining, 0);
    assert.equal(state.garages[0].exitingVehicleId, 101);
    assert.equal(state.vehicles.find((vehicle) => vehicle.id === 101).state, 'leaving-garage');
    assert.equal(state.garages[1].locked, true);
    assert.equal(state.garages[1].unlockRemaining, 10);
    assert.equal(state.garages[1].exitingVehicleId, null);

    for (let id = 11; id <= 19; id += 1) {
      assert.equal(game.clickVehicle(id).ok, true);
    }
    game.update(0.1);
    state = game.snapshot();
    assert.equal(state.garages[1].locked, true);
    assert.equal(state.garages[1].unlockRemaining, 1);
    assert.equal(state.garages[1].exitingVehicleId, null);

    assert.equal(game.clickVehicle(20).ok, true);
    game.update(0.1);
    state = game.snapshot();
    assert.equal(state.garages[1].locked, false);
    assert.equal(state.garages[1].unlockRemaining, 0);
    assert.equal(state.garages[1].exitingVehicleId, 201);
    assert.equal(state.vehicles.find((vehicle) => vehicle.id === 201).state, 'leaving-garage');
  });
});

test('count garage scene label renders a distinct locked state', () => {
  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');

  assert.match(viewSource, /updateGarageCountLabel\(label,\s*value,\s*\{\s*locked\s*=\s*false\s*\}/);
  assert.match(viewSource, /label\.userData\.locked/);
  assert.match(viewSource, /locked\s*\?\s*'900 46px Arial, sans-serif'/);
  assert.match(viewSource, /locked:\s*garage\.locked/);
});
