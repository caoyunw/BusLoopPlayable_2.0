import test from 'node:test';
import assert from 'node:assert/strict';
import { BusLoopGame } from '../src/game-model.js';
import {
  findCollisionContact,
  getVehicleCollisionSize
} from '../src/vehicle-collision.js';

function createLevel(overrides = {}) {
  return {
    id: 501,
    mapScale: 1,
    sceneName: 'VehicleCollisionTest',
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
    vehicleSize: { width: 0.4, length: 0.8 },
    collision: {
      vehicleSizes: {
        4: { width: 0.4, length: 0.4 },
        6: { width: 0.4, length: 0.6 },
        10: { width: 0.4, length: 0.8 }
      },
      garageSize: { width: 1, length: 1 }
    },
    vehicleMotion: {
      spotStartX: -2,
      spotSpacing: 1,
      spotZ: 4,
      spotYaw: 0,
      spotApproachOffsetZ: 0,
      spotApproachDirection: 'screen-down'
    },
    containers: [{ id: 0, type: 1, x: 0, z: 0, yaw: 0 }],
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 2, seats: 10, colorIndex: 1, x: 0, z: 2, yaw: 90 }
    ],
    vehicleDepthes: { 1: [] },
    passengerSequence: Object.freeze([]),
    passengerQueues: Object.freeze([]),
    assets: { audio: {} },
    ...overrides
  };
}

test('collision size selection uses explicit per-vehicle Unity size keys', () => {
  const level = createLevel({
    collision: {
      vehicleSizes: {
        compact: { width: 0.31, length: 0.45 },
        4: { width: 0.4, length: 0.4 },
        6: { width: 0.4, length: 0.6 },
        10: { width: 0.4, length: 0.8 }
      },
      vehicleSizeKeyByColor: { 8: 'compact' },
      garageSize: { width: 1, length: 1 }
    }
  });

  assert.deepEqual(getVehicleCollisionSize(level, { seats: 4, colorIndex: 0 }), {
    width: 0.4,
    length: 0.4
  });
  assert.deepEqual(getVehicleCollisionSize(level, { seats: 10, colorIndex: 8 }), {
    width: 0.31,
    length: 0.45
  });
});

test('runtime collision graph ignores legacy depth chains and uses current geometry', () => {
  const game = new BusLoopGame(createLevel({
    vehicleDepthes: { 1: [] }
  }));

  assert.deepEqual(game.getBlockers(1), [2]);
  game.getVehicle(2).state = 'moving-to-spot';
  assert.deepEqual(game.getBlockers(1), []);
});

test('reset rebuilds collision decisions from restored parked state', () => {
  const game = new BusLoopGame(createLevel());
  game.getVehicle(2).state = 'at-spot';
  assert.deepEqual(game.getBlockers(1), []);

  game.reset();
  assert.deepEqual(game.getBlockers(1), [2]);
});

test('CanMoveToStation-equivalent state gate accepts only parked vehicles', () => {
  const game = new BusLoopGame(createLevel());
  const vehicle = game.getVehicle(1);

  assert.equal(game.canMoveToStation(vehicle), true);
  vehicle.state = 'colliding';
  assert.equal(game.canMoveToStation(vehicle), false);
  assert.deepEqual(game.clickVehicle(1), { ok: false, reason: 'unavailable' });
});

test('full station is rejected before collision feedback like Unity normal input', () => {
  const game = new BusLoopGame(createLevel({ spotCount: 1 }));
  for (const spot of game.spots) spot.vehicleId = 99;

  assert.deepEqual(game.clickVehicle(1), { ok: false, reason: 'spots-full' });
  assert.equal(game.getVehicle(1).state, 'parked');
});

test('edge contact uses attacker and target sizes and returns the oriented contact point', () => {
  const level = createLevel();
  const attacker = level.vehicles[0];
  const target = level.vehicles[1];
  const contact = findCollisionContact(level, attacker, [{
    type: 'vehicle',
    id: target.id,
    vehicle: target,
    box: {
      position: { x: target.x, z: target.z },
      yaw: target.yaw,
      size: getVehicleCollisionSize(level, target),
      forward: { x: 1, z: 0 },
      right: { x: 0, z: -1 }
    }
  }]);

  assert.ok(contact);
  assert.ok(Math.abs(contact.distance - 1.6) < 1e-6);
  assert.ok(Math.abs(contact.position.z - 1.8) < 1e-6);
});

test('garage body participates as a container collision candidate', () => {
  const level = createLevel({
    containers: [
      { id: 0, type: 1, x: 0, z: 0, yaw: 0 },
      { id: 7, type: 2, x: 0, z: 2, yaw: 0 }
    ],
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 3, seats: 4, colorIndex: 2, x: 0, z: 0, yaw: 0, containerType: 2, containerId: 7 }
    ],
    vehicleDepthes: {}
  });
  const game = new BusLoopGame(level, { mechanicId: 'base' });

  assert.deepEqual(game.getBlockers(1), ['container:7:body']);
  const result = game.clickVehicle(1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked');
  assert.equal(game.getVehicle(1).collision.targetType, 'container');
  assert.equal(game.getVehicle(1).collision.targetContainerId, 7);
  assert.equal(game.getVehicle(1).collision.targetId, null);
});

test('garage release waits for the Unity door box to become clear', () => {
  const level = createLevel({
    containers: [
      { id: 0, type: 1, x: 0, z: 0, yaw: 0 },
      { id: 7, type: 2, x: 0, z: 2, yaw: 0 }
    ],
    vehicles: [
      { id: 3, seats: 4, colorIndex: 2, x: 0, z: 0, yaw: 0, containerType: 2, containerId: 7 },
      { id: 4, seats: 10, colorIndex: 1, x: 0, z: 2.9, yaw: 0 }
    ],
    vehicleDepthes: {}
  });
  const game = new BusLoopGame(level, { mechanicId: 'base' });

  game.update(0.01);
  assert.equal(game.getVehicle(3).state, 'in-garage');
  game.getVehicle(4).state = 'at-spot';
  game.update(0.01);
  assert.equal(game.getVehicle(3).state, 'leaving-garage');
});

test('conveyor vehicles use Unity lateral interval blockers instead of ground SAT', () => {
  const level = createLevel({
    collision: {
      vehicleSizes: {
        4: { width: 0.4, length: 0.4 },
        10: { width: 0.4, length: 0.8 }
      },
      maxVehicleSize: { width: 0.4, length: 0.8 },
      garageSize: { width: 1, length: 1 },
      conveyor: {
        size: { width: 4, length: 1 },
        exitWidth: 4,
        wallThickness: 0.1
      }
    },
    containers: [{ id: 9, type: 3, x: 0, z: 0, yaw: 0 }],
    vehicles: [
      { id: 5, seats: 4, colorIndex: 0, x: -1, z: 0, yaw: 90, containerType: 3, containerId: 9 },
      { id: 6, seats: 10, colorIndex: 1, x: -0.9, z: 0, yaw: 0 }
    ],
    vehicleDepthes: {}
  });
  const game = new BusLoopGame(level);

  assert.deepEqual(game.getBlockers(5), [6]);
  game.getVehicle(6).state = 'at-spot';
  assert.deepEqual(game.getBlockers(5), []);
  assert.equal(game.clickVehicle(5).ok, true);
});

test('conveyor wall contact is exposed as a container candidate', () => {
  const level = createLevel({
    collision: {
      vehicleSizes: { 4: { width: 0.4, length: 0.4 } },
      maxVehicleSize: { width: 0.4, length: 0.4 },
      garageSize: { width: 1, length: 1 },
      conveyor: {
        size: { width: 4, length: 1 },
        exitWidth: 4,
        wallThickness: 0.1
      }
    },
    containers: [{ id: 9, type: 3, x: 0, z: 0, yaw: 0 }],
    vehicles: [
      { id: 5, seats: 4, colorIndex: 0, x: -2, z: 0, yaw: 90, containerType: 3, containerId: 9 }
    ],
    vehicleDepthes: {}
  });
  const game = new BusLoopGame(level);

  assert.deepEqual(game.getBlockers(5), ['container:9:wall']);
});

test('blocked vehicle selects a direct graph candidate and enters collision feedback', () => {
  const game = new BusLoopGame(createLevel());
  const result = game.clickVehicle(1);

  assert.deepEqual(result, { ok: false, reason: 'blocked', blockers: [2] });
  assert.equal(game.getVehicle(1).state, 'colliding');
  assert.equal(game.getVehicle(1).collision.targetId, 2);
  assert.equal(game.getVehicle(1).collision.targetType, 'vehicle');
});
