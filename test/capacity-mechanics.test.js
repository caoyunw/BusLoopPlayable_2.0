import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { getMechanicById } from '../src/mechanic-registry.js';

const TEST_LEVEL = Object.freeze({
  id: 206,
  conveyorCapacity: 4,
  queueCapacity: 0,
  queueCount: 1,
  passengerQueues: Object.freeze([Object.freeze([])]),
  passengerSequence: Object.freeze([]),
  passengerQueue: { spacing: 0.5 },
  passengerEntryMotion: { passengerSpeed: 1, initialFillCatchUpDuration: 0.2, catchUpExtraSpeed: 0, snapDistance: 0.02 },
  conveyorSpeed: 1,
  conveyorPathLength: 1,
  entryPercents: [0.1],
  exitStart: 0.4,
  exitEnd: 0.6,
  spotCount: 2,
  groupSize: 4,
  boardingDepartureDelay: 1,
  longPressMultiplier: 3,
  longPressThreshold: 0.25,
  mapScale: 1,
  vehicleSize: { width: 0.8, length: 1.2 },
  vehicleMotion: { spotYaw: 0, spotApproachOffsetZ: 0.4 },
  vehicles: Object.freeze([
    { id: 1, seats: 10, colorIndex: 1, x: 0, z: 0, yaw: 0 },
    { id: 2, seats: 10, colorIndex: 1, x: 1, z: 0, yaw: 0 }
  ]),
  assets: { audio: {} }
});

function placeVehicle(game, vehicleId, spotIndex) {
  const vehicle = game.getVehicle(vehicleId);
  Object.assign(vehicle, {
    state: 'at-spot',
    spotIndex,
    boardedGroups: 0,
    motion: 0,
    motionData: null
  });
  game.spots[spotIndex].vehicleId = vehicleId;
  return vehicle;
}

function boardOneGroup(game, vehicle) {
  const slot = game.slots[0];
  slot.colorIndex = vehicle.colorIndex;
  slot.passengerId = 100 + game.boardingEvents.length;
  slot.progress = TEST_LEVEL.exitStart;
  slot.previousProgress = TEST_LEVEL.exitStart - 0.01;
  game.initialFillActive = false;
  game.update(0.01);
}

test('upgrade spot doubles only the first parking spot vehicle capacity', () => {
  assert.equal(getMechanicById('upgrade-spot').status, 'playable');

  const game = new BusLoopGame(TEST_LEVEL, { mechanicId: 'upgrade-spot' });
  const firstVehicle = placeVehicle(game, 1, 0);
  const secondVehicle = placeVehicle(game, 2, 1);

  assert.equal(game.getVehicleSeatCapacity(firstVehicle), 20);
  assert.equal(game.getVehicleSeatCapacity(secondVehicle), 10);

  firstVehicle.boardedGroups = 19;
  boardOneGroup(game, firstVehicle);

  assert.equal(firstVehicle.boardedGroups, 20);
  assert.equal(firstVehicle.state, 'boarding-final');
  assert.equal(game.snapshot().vehicles.find((vehicle) => vehicle.id === 1).seatCapacity, 20);
});

test('double gate keeps vehicle capacity but each first-spot passenger group consumes two seats', () => {
  assert.equal(getMechanicById('double-gate').status, 'playable');

  const game = new BusLoopGame(TEST_LEVEL, { mechanicId: 'double-gate' });
  const vehicle = placeVehicle(game, 1, 0);

  assert.equal(game.getVehicleSeatCapacity(vehicle), 10);
  assert.equal(game.getPassengerBoardingCost({ colorIndex: 1 }, vehicle), 2);

  for (let index = 0; index < 5; index += 1) {
    assert.equal(vehicle.state, 'at-spot');
    boardOneGroup(game, vehicle);
  }

  assert.equal(vehicle.boardedGroups, 10);
  assert.equal(vehicle.state, 'boarding-final');
  assert.equal(game.boardingEvents.length, 5);
  assert.ok(game.boardingEvents.every((event) => event.boardingCost === 2));
});

test('double gate does not affect vehicles outside the first parking spot', () => {
  const game = new BusLoopGame(TEST_LEVEL, { mechanicId: 'double-gate' });
  const vehicle = placeVehicle(game, 2, 1);

  assert.equal(game.getPassengerBoardingCost({ colorIndex: 1 }, vehicle), 1);
  boardOneGroup(game, vehicle);

  assert.equal(vehicle.boardedGroups, 1);
  assert.equal(vehicle.state, 'at-spot');
});

test('upgrade spot and double gate have distinct first-spot scene markers', () => {
  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');

  assert.match(viewSource, /createCapacitySpotMarker/);
  assert.match(viewSource, /makeSpotMarkerLabel\('UP'/);
  assert.match(viewSource, /makeSpotMarkerLabel\('x2'/);
  assert.match(viewSource, /upgradeSpotMarker/);
  assert.match(viewSource, /doubleGateMarker/);
  assert.match(viewSource, /snapshot\.upgradeSpot\?\.spotIndex === index/);
  assert.match(viewSource, /snapshot\.doubleGate\?\.spotIndex === index/);
});
