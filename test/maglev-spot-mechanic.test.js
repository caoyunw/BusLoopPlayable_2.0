import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { getMechanicById } from '../src/mechanic-registry.js';
import { createMechanicRuntime, resolvePlayableMechanicId } from '../src/mechanics/index.js';

const TEST_LEVEL = Object.freeze({
  id: 305,
  conveyorCapacity: 4,
  queueCapacity: 0,
  queueCount: 1,
  passengerQueues: Object.freeze([Object.freeze([])]),
  passengerSequence: Object.freeze([]),
  passengerQueue: { spacing: 0.5 },
  passengerEntryMotion: {
    passengerSpeed: 1,
    initialFillCatchUpDuration: 0.2,
    catchUpExtraSpeed: 0,
    snapDistance: 0.02
  },
  conveyorSpeed: 1,
  conveyorPathLength: 1,
  entryPercents: [0.1],
  exitStart: 0.4,
  exitEnd: 0.6,
  spotCount: 3,
  groupSize: 4,
  boardingDepartureDelay: 1,
  longPressMultiplier: 3,
  longPressThreshold: 0.25,
  mapScale: 1,
  vehicleSize: { width: 0.8, length: 1.2 },
  vehicleMotion: { spotYaw: 0, spotApproachOffsetZ: 0.4 },
  vehicleDepthes: Object.freeze({
    100: Object.freeze([28]),
    101: Object.freeze([31])
  }),
  vehicles: Object.freeze([
    { id: 10, seats: 4, colorIndex: 1, x: -2, z: 0, yaw: 0 },
    { id: 28, seats: 4, colorIndex: 1, x: 0, z: 0, yaw: 0 },
    { id: 35, seats: 4, colorIndex: 1, x: 1, z: 0, yaw: 0 },
    { id: 31, seats: 4, colorIndex: 1, x: 2, z: 0, yaw: 0 },
    { id: 48, seats: 4, colorIndex: 1, x: 3, z: 0, yaw: 0 },
    { id: 100, seats: 4, colorIndex: 1, x: 0, z: -1, yaw: 0 },
    { id: 101, seats: 4, colorIndex: 1, x: 2, z: -1, yaw: 0 }
  ]),
  assets: { audio: {} }
});

test('maglev spot is a playable mechanic with its own runtime', () => {
  assert.equal(getMechanicById('maglev-spot').status, 'playable');
  assert.equal(resolvePlayableMechanicId('maglev-spot'), 'maglev-spot');
  assert.equal(createMechanicRuntime('maglev-spot', { level: TEST_LEVEL }).id, 'maglev-spot');
});

test('maglev spot starts lowered and toggles after every successful dispatch', () => {
  const game = new BusLoopGame(TEST_LEVEL, { mechanicId: 'maglev-spot' });

  assert.equal(game.snapshot().maglevSpot.raised, false);
  assert.deepEqual(game.snapshot().maglevSpot.elevatedVehicleIds, []);
  assert.deepEqual(game.getBlockers(100), [28]);
  assert.deepEqual(game.getBlockers(101), [31]);

  assert.deepEqual(game.clickVehicle(10), { ok: true, spotIndex: 0 });

  const raised = game.snapshot().maglevSpot;
  assert.equal(raised.raised, true);
  assert.equal(raised.toggleCount, 1);
  assert.deepEqual(raised.elevatedVehicleIds, [28, 35]);
  assert.deepEqual(game.getBlockers(100), []);
  assert.deepEqual(game.getBlockers(101), [31]);
  assert.equal(game.canVehicleDispatch(game.getVehicle(28)), false);
  assert.equal(game.canVehicleDispatch(game.getVehicle(31)), true);
});

test('raised maglev vehicles cannot dispatch until the spots lower again', () => {
  const game = new BusLoopGame(TEST_LEVEL, { mechanicId: 'maglev-spot' });

  assert.equal(game.clickVehicle(10).ok, true);
  assert.deepEqual(game.clickVehicle(28), { ok: false, reason: 'mechanic-disabled' });

  assert.equal(game.clickVehicle(100).ok, true);
  assert.equal(game.snapshot().maglevSpot.raised, false);
  assert.deepEqual(game.snapshot().maglevSpot.elevatedVehicleIds, []);
  assert.equal(game.clickVehicle(28).ok, true);
});

test('maglev spot scene view renders square spot markers and elevated vehicle offsets', () => {
  const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  const modelSource = readFileSync(join('src', 'mechanics', 'maglev-spot', 'model.js'), 'utf8');

  assert.match(modelSource, /DEFAULT_MAGLEV_VEHICLE_IDS = Object\.freeze\(\[28, 35, 33, 50, 39, 58, 41, 52\]\)/);
  assert.match(modelSource, /canVehicleDispatch/);
  assert.match(modelSource, /isVehicleBlocking/);
  assert.match(sceneSource, /createMaglevSpotView/);
  assert.match(sceneSource, /new THREE\.BoxGeometry\(0\.76, 0\.045, 0\.76\)/);
  assert.match(sceneSource, /updateMaglevSpots/);
  assert.match(sceneSource, /\['parked', 'colliding'\]\.includes\(vehicle\.state\)/);
  assert.match(sceneSource, /snapshot\.maglevSpot\?\.elevatedVehicleIds\?\.includes\(vehicle\.id\)/);
  assert.match(sceneSource, /game\.canVehicleDispatch\(vehicle\)/);
});
