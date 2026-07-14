import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { getMechanicById } from '../src/mechanic-registry.js';
import { LEVEL_1 } from '../src/level-data.js';

const TEST_LEVEL = Object.freeze({
  id: 105,
  conveyorCapacity: 4,
  queueCapacity: 3,
  queueCount: 2,
  passengerQueues: Object.freeze([
    Object.freeze([4, 4, 5, 8, 0]),
    Object.freeze([5, 8])
  ]),
  passengerSequence: Object.freeze([4, 4, 5, 8, 0, 5, 8]),
  passengerQueue: { spacing: 0.5 },
  passengerEntryMotion: { passengerSpeed: 1, initialFillCatchUpDuration: 0.2, catchUpExtraSpeed: 0, snapDistance: 0.02 },
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
  vehicles: Object.freeze([{ id: 1, seats: 4, colorIndex: 4, x: 0, z: 0, yaw: 0 }]),
  assets: { audio: {} }
});

function makeOrderGame(level = TEST_LEVEL) {
  return new BusLoopGame(level, { mechanicId: 'order-passenger' });
}

function boardColor(game, colorIndex) {
  return game.mechanicRuntime.onPassengerBoarded({
    game,
    slot: { colorIndex },
    vehicle: game.vehicles[0]
  });
}

test('order passenger is playable and targets red, yellow, and brown passenger totals', () => {
  assert.equal(getMechanicById('order-passenger').status, 'playable');

  const game = makeOrderGame();
  const order = game.snapshot().orderPassenger;

  assert.deepEqual(order.targetColorIndices, [4, 5, 8]);
  assert.deepEqual(
    order.items.map(({ colorIndex, totalPassengers, remainingPassengers }) => ({
      colorIndex,
      totalPassengers,
      remainingPassengers
    })),
    [
      { colorIndex: 4, totalPassengers: 8, remainingPassengers: 8 },
      { colorIndex: 5, totalPassengers: 8, remainingPassengers: 8 },
      { colorIndex: 8, totalPassengers: 8, remainingPassengers: 8 }
    ]
  );
});

test('order passenger counts level18 targets as passenger groups times four', () => {
  const game = makeOrderGame(LEVEL_1);
  const items = Object.fromEntries(
    game.snapshot().orderPassenger.items.map((item) => [item.colorIndex, item.remainingPassengers])
  );

  assert.equal(items[4], 46 * 4);
  assert.equal(items[5], 56 * 4);
  assert.equal(items[8], 44 * 4);
});

test('order passenger decrements only matching colors and wins when all order targets are boarded', () => {
  const game = makeOrderGame();

  assert.deepEqual(boardColor(game, 0), { orderPassengerMatched: false });
  assert.equal(game.snapshot().orderPassenger.items[0].remainingPassengers, 8);

  for (const colorIndex of [4, 4, 5, 5, 8]) {
    boardColor(game, colorIndex);
  }
  game.checkEndState();
  assert.equal(game.status, 'playing');
  assert.equal(game.snapshot().orderPassenger.completed, false);

  const finalEvent = boardColor(game, 8);
  assert.equal(finalEvent.orderPassengerCompleted, true);
  game.checkEndState();

  assert.equal(game.status, 'won');
  assert.deepEqual(
    game.snapshot().orderPassenger.items.map((item) => item.remainingPassengers),
    [0, 0, 0]
  );
  assert.equal(game.vehicles.every((vehicle) => vehicle.state === 'done'), false);
  assert.deepEqual(game.lastEvent, {
    type: 'win',
    reason: 'mechanic-goal-complete',
    mechanicId: 'order-passenger'
  });
});

test('order passenger top panel is owned by the mechanic UI layer', () => {
  const uiSource = readFileSync(join('src', 'mechanics', 'ui.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'mechanics', 'order-passenger', 'view.js'), 'utf8');
  const styles = readFileSync(join('src', 'mechanics', 'order-passenger', 'styles.css'), 'utf8');

  assert.match(uiSource, /createOrderPassengerHud/);
  assert.match(viewSource, /id = 'order-passenger-hud'/);
  assert.match(viewSource, /order-passenger-icon/);
  assert.match(viewSource, /order-passenger-check/);
  assert.match(viewSource, /rgb\(255, 211, 32\)/);
  assert.match(viewSource, /remainingPassengers/);
  assert.match(viewSource, /count\.hidden = isComplete/);
  assert.match(viewSource, /check\.hidden = !isComplete/);
  assert.match(viewSource, /mechanic\?\.id !== 'order-passenger'/);
  assert.match(styles, /\.order-passenger-hud/);
  assert.match(styles, /\.order-passenger-check/);
  assert.match(styles, /order-passenger-check-pop/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /top:\s*14px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
});
