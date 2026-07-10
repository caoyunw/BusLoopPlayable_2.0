import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { getMechanicById } from '../src/mechanic-registry.js';

const makeRandom = (values) => {
  let index = 0;
  return () => values[index++] ?? 1;
};

const TEST_LEVEL = Object.freeze({
  id: 99,
  conveyorCapacity: 2,
  queueCapacity: 2,
  queueCount: 1,
  passengerQueues: [[0, 0, 0, 0]],
  passengerSequence: [0, 0, 0, 0],
  passengerQueue: { spacing: 0.5 },
  passengerEntryMotion: { passengerSpeed: 1, initialFillCatchUpDuration: 0.2, catchUpExtraSpeed: 0, snapDistance: 0.02 },
  conveyorSpeed: 1,
  conveyorPathLength: 1,
  entryPercents: [0.1],
  exitStart: 0.25,
  exitEnd: 0.32,
  spotCount: 1,
  groupSize: 4,
  boardingDepartureDelay: 1,
  longPressMultiplier: 3,
  longPressThreshold: 0.25,
  mapScale: 1,
  vehicleSize: { width: 0.8, length: 1.2 },
  vehicleMotion: { spotYaw: 0, spotApproachOffsetZ: 0.4 },
  vehicles: [{ id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 }],
  assets: { audio: {} }
});

function makeStarGame(randomValues = [0]) {
  return new BusLoopGame(TEST_LEVEL, {
    mechanicId: 'star-passenger',
    random: makeRandom(randomValues),
    starPassenger: { chance: 0.5, expireExitPasses: 3, progressTarget: 3 }
  });
}

function prepareBoardableVehicle(game) {
  const vehicle = game.getVehicle(1);
  Object.assign(vehicle, { state: 'at-spot', spotIndex: 0, boardedGroups: 0 });
  game.spots[0].vehicleId = vehicle.id;
  return vehicle;
}

test('star passenger is a playable mechanic in the registry', () => {
  assert.equal(getMechanicById('star-passenger').status, 'playable');
});

test('star passenger mechanic randomly marks only some passengers with collectible rewards', () => {
  const game = makeStarGame([0.1, 0.8, 0.2, 0.9]);
  const state = game.snapshot();

  assert.equal(state.starReward.enabled, true);
  assert.equal(state.starReward.coins, 0);
  assert.equal(state.starReward.target, 3);
  assert.equal(state.queueItems[0][0].starReward.active, true);
  assert.equal(state.queueItems[0][1].starReward, null);
});

test('star passenger gains one coin when boarding before the reward expires', () => {
  const game = makeStarGame([0.1, 0.8]);
  prepareBoardableVehicle(game);
  const slot = game.slots[0];
  Object.assign(slot, {
    colorIndex: 0,
    passengerId: 1,
    progress: 0.27,
    previousProgress: 0.27,
    starReward: { active: true, exitPasses: 2, expired: false }
  });

  game.update(0);
  const state = game.snapshot();

  assert.equal(state.starReward.coins, 1);
  assert.equal(state.starReward.collected, 1);
  assert.equal(state.slots[0].colorIndex, null);
  assert.equal(state.boardingEvents.at(-1).passengerId, 1);
  assert.equal(state.boardingEvents.at(-1).starRewardCollected, true);
});

test('star passenger reward disappears after passing the exit three times without boarding', () => {
  const game = makeStarGame([0.1, 0.8]);
  const slot = game.slots[0];
  Object.assign(slot, {
    colorIndex: 0,
    passengerId: 1,
    progress: 0.24,
    previousProgress: 0.24,
    starReward: { active: true, exitPasses: 2, expired: false }
  });

  game.update(0.02);
  const state = game.snapshot();

  assert.equal(state.starReward.coins, 0);
  assert.equal(state.starReward.expired, 1);
  assert.equal(state.slots[0].colorIndex, 0);
  assert.equal(state.slots[0].starReward.active, false);
  assert.equal(state.slots[0].starReward.expired, true);
  assert.equal(state.lastEvent.type, 'star-passenger-expired');
});

test('star passenger UI shell exposes coin progress and collection effects', () => {
  const html = readFileSync(join('index.html'), 'utf8');
  const mainSource = readFileSync(join('src', 'main.js'), 'utf8');
  const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'mechanics', 'star-passenger', 'view.js'), 'utf8');
  const styles = readFileSync(join('src', 'mechanics', 'star-passenger', 'styles.css'), 'utf8');

  assert.doesNotMatch(html, /id="star-reward-hud"/);
  assert.match(mainSource, /createMechanicUiControllers/);
  assert.match(viewSource, /id = 'star-reward-hud'/);
  assert.match(viewSource, /spawnStarRewardFlyEffect/);
  assert.match(sceneSource, /updateStarPassengerBadge/);
  assert.match(styles, /\.star-reward-fly/);
});
