import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { getMechanicById } from '../src/mechanic-registry.js';
import { createMechanicRuntime, resolvePlayableMechanicId } from '../src/mechanics/index.js';

const TEST_LEVEL = Object.freeze({
  id: 104,
  conveyorCapacity: 4,
  queueCapacity: 4,
  queueCount: 2,
  passengerQueues: Object.freeze([
    Object.freeze([1, 1, 2, 2]),
    Object.freeze([3, 3, 4, 4])
  ]),
  passengerSequence: Object.freeze([1, 1, 2, 2, 3, 3, 4, 4]),
  passengerQueue: { spacing: 0.5 },
  passengerEntryMotion: {
    passengerSpeed: 1,
    initialFillCatchUpDuration: 0.2,
    catchUpExtraSpeed: 0,
    snapDistance: 0.02
  },
  conveyorSpeed: 1,
  conveyorPathLength: 1,
  entryPercents: [0.1, 0.6],
  exitStart: 0.8,
  exitEnd: 0.9,
  spotCount: 1,
  groupSize: 4,
  boardingDepartureDelay: 1,
  longPressMultiplier: 3,
  longPressThreshold: 0.25,
  mapScale: 1,
  vehicleSize: { width: 0.8, length: 1.2 },
  vehicleMotion: { spotYaw: 0, spotApproachOffsetZ: 0.4 },
  vehicles: Object.freeze([{ id: 1, seats: 4, colorIndex: 1, x: 0, z: 0, yaw: 0 }]),
  assets: { audio: {} }
});

function makeValveGame() {
  return new BusLoopGame(TEST_LEVEL, { mechanicId: 'valve' });
}

function readyQueueHead(game, queueIndex) {
  if (game.queues[queueIndex]?.[0]) game.queues[queueIndex][0].distanceFromHead = 0;
}

test('valve is a playable mechanic with its own runtime', () => {
  assert.equal(getMechanicById('valve').status, 'playable');
  assert.equal(resolvePlayableMechanicId('valve'), 'valve');
  assert.equal(createMechanicRuntime('valve', { level: TEST_LEVEL }).id, 'valve');
});

test('valve opens one side and switches after that side color run enters the belt', () => {
  const game = makeValveGame();
  game.initialFillActive = false;

  assert.equal(game.snapshot().valve.activeEntryIndex, 0);
  assert.equal(game.snapshot().valve.activeColorIndex, 1);
  assert.equal(game.canPassengerEnterBelt({ index: 0 }), true);
  assert.equal(game.canPassengerEnterBelt({ index: 1 }), false);

  const first = game.dequeuePassenger(0, true);
  game.mechanicRuntime.onPassengerEnteredBelt({ game, slot: { entryIndex: 0 }, passenger: first });
  readyQueueHead(game, 0);
  assert.equal(game.snapshot().valve.activeEntryIndex, 0);
  assert.equal(game.snapshot().valve.visibleRunRemaining, undefined);
  assert.equal(game.snapshot().valve.entries[0].visibleRunRemaining, 1);

  const second = game.dequeuePassenger(0, true);
  game.mechanicRuntime.onPassengerEnteredBelt({ game, slot: { entryIndex: 0 }, passenger: second });

  const state = game.snapshot().valve;
  assert.equal(state.activeEntryIndex, 1);
  assert.equal(state.activeColorIndex, 3);
  assert.equal(state.switchCount, 1);
  assert.equal(game.canPassengerEnterBelt({ index: 0 }), false);
  assert.equal(game.canPassengerEnterBelt({ index: 1 }), true);
});

test('valve lets both side queues feed the belt during initial fill', () => {
  const game = makeValveGame();

  assert.equal(game.snapshot().valve.initialFillOpen, true);
  assert.equal(game.snapshot().valve.entries[0].open, true);
  assert.equal(game.snapshot().valve.entries[1].open, true);
  assert.equal(game.canPassengerEnterBelt({ index: 0 }), true);
  assert.equal(game.canPassengerEnterBelt({ index: 1 }), true);

  game.slots[0].progress = 0.55;
  game.slots[0].previousProgress = 0.55;
  game.update(0.1);
  const state = game.snapshot();
  assert.equal(state.queueRemaining[1], 3);
  assert.equal(state.slots[0].entryIndex, 1);
  assert.equal(state.slots[0].colorIndex, 3);
  assert.equal(state.valve.switchCount, 0);
  assert.equal(state.valve.started, false);
});

test('closed valve side does not feed an empty belt slot after initial fill', () => {
  const game = makeValveGame();
  game.initialFillActive = false;
  const rightBefore = game.snapshot().queueRemaining[1];

  game.slots[0].progress = 0.55;
  game.slots[0].previousProgress = 0.55;
  game.update(0.1);
  assert.equal(game.snapshot().queueRemaining[1], rightBefore);

  game.slots[0].progress = 0.05;
  game.slots[0].previousProgress = 0.05;
  game.update(0.1);
  assert.equal(game.snapshot().queueRemaining[0], 3);
  assert.equal(game.snapshot().slots[0].entryIndex, 0);
  assert.equal(game.snapshot().slots[0].colorIndex, 1);
});

test('valve scene view renders entrance markers from snapshot state', () => {
  const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  const modelSource = readFileSync(join('src', 'mechanics', 'valve', 'model.js'), 'utf8');

  assert.match(modelSource, /createValveRuntime/);
  assert.match(modelSource, /canPassengerEnterBelt/);
  assert.match(sceneSource, /buildValveViews/);
  assert.match(sceneSource, /updateValves/);
  assert.match(sceneSource, /snapshot\.valve/);
});
