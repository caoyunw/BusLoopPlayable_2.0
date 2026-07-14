import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BusLoopGame } from '../src/game-model.js';
import { LEVEL_1 } from '../src/level-data.js';
import { SceneView } from '../src/scene-view.js';
import {
  classifyTransportTunnelApproach,
  createTransportTunnelRuntime,
  getTransportTunnelExitPose,
  normalizeTransportTunnelPairs
} from '../src/mechanics/transport-tunnel/model.js';

const DIMENSIONS = Object.freeze({ width: 0.27, length: 0.68 });
const PAIR = Object.freeze({
  id: 'purple-1',
  label: '1',
  color: '#9a67ff',
  entrance: Object.freeze({
    x: 0,
    z: 1,
    yaw: 0,
    width: 0.5,
    approachDistance: 3
  }),
  exit: Object.freeze({
    x: 5,
    z: 0,
    yaw: 90,
    width: 0.5,
    spawnDistance: 0.8
  })
});

function createTunnelGame({ vehicles, options = {}, pairs = [PAIR], vehicleDepthes = {} } = {}) {
  const level = {
    ...LEVEL_1,
    containers: [],
    vehicleDepthes,
    vehicles: vehicles ?? [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 2, seats: 4, colorIndex: 1, x: 0.05, z: -0.8, yaw: 0 }
    ],
    mechanics: {
      ...LEVEL_1.mechanics,
      'transport-tunnel': { pairs }
    }
  };
  const game = new BusLoopGame(level, { random: () => 0 });
  const runtime = createTransportTunnelRuntime({
    level,
    options: {
      entryDuration: 0.1,
      hiddenDuration: 0.1,
      exitDuration: 0.1,
      ...options
    }
  });
  game.mechanicRuntime = runtime;
  game.mechanicState = runtime.createState(game);
  return { game, runtime };
}

test('tunnel normalization keeps valid degree-based pairs and rejects malformed or duplicate pairs', () => {
  const result = normalizeTransportTunnelPairs({
    pairs: [
      PAIR,
      { ...PAIR, id: 'purple-1' },
      { ...PAIR, id: 'missing-exit', exit: null },
      { ...PAIR, id: 'bad-yaw', entrance: { ...PAIR.entrance, yaw: Infinity } },
      { ...PAIR, id: 'bad-width', exit: { ...PAIR.exit, width: 0 } }
    ]
  });

  assert.equal(result.invalidPairCount, 4);
  assert.deepEqual(result.pairs, [PAIR]);
});

test('approach classification distinguishes the aperture, side wall, and unrelated paths', () => {
  const passage = classifyTransportTunnelApproach(
    { id: 1, x: 0, z: 0, yaw: 0 },
    PAIR,
    DIMENSIONS
  );
  assert.equal(passage?.type, 'passage');
  assert.equal(passage?.pairId, PAIR.id);

  const wall = classifyTransportTunnelApproach(
    { id: 2, x: 0.34, z: 0, yaw: 0 },
    PAIR,
    DIMENSIONS
  );
  assert.equal(wall?.type, 'wall');
  assert.equal(wall?.wallSide, 'right');

  const angled = classifyTransportTunnelApproach(
    { id: 3, x: 0, z: 0, yaw: 20 },
    PAIR,
    DIMENSIONS
  );
  assert.equal(angled?.type, 'wall');

  assert.equal(
    classifyTransportTunnelApproach(
      { id: 4, x: 2, z: 0, yaw: 0 },
      PAIR,
      DIMENSIONS
    ),
    null
  );
});

test('exit pose follows the authored exit direction in degrees', () => {
  assert.deepEqual(getTransportTunnelExitPose(PAIR), {
    x: 5.8,
    z: 0,
    yaw: 90
  });
});

test('a valid click reserves its pair and advances through enter hidden exit and parked states', () => {
  const { game } = createTunnelGame();

  assert.deepEqual(game.clickVehicle(1), { ok: true, pairId: PAIR.id });
  assert.equal(game.getVehicle(1).state, 'entering-tunnel');
  assert.equal(game.mechanicState.transportTunnel.pairs[0].busyVehicleId, 1);

  game.update(0.1);
  assert.equal(game.getVehicle(1).state, 'hidden-in-tunnel');
  game.update(0.1);
  assert.equal(game.getVehicle(1).state, 'exiting-tunnel');
  game.update(0.1);

  assert.equal(game.getVehicle(1).state, 'parked');
  assert.equal(game.getVehicle(1).x, 5.8);
  assert.equal(game.getVehicle(1).z, 0);
  assert.equal(game.getVehicle(1).yaw, 90);
  assert.equal(game.getVehicle(1).useDynamicBlockers, true);
  assert.equal(game.mechanicState.transportTunnel.pairs[0].busyVehicleId, null);
});

test('wall collision busy pair and occupied exit return distinct handled failures', () => {
  const wallGame = createTunnelGame({
    vehicles: [{ id: 1, seats: 4, colorIndex: 0, x: 0.34, z: 0, yaw: 0 }]
  }).game;
  assert.deepEqual(wallGame.clickVehicle(1), {
    ok: false,
    reason: 'tunnel-wall-blocked'
  });

  const busyGame = createTunnelGame().game;
  assert.equal(busyGame.clickVehicle(1).ok, true);
  assert.deepEqual(busyGame.clickVehicle(2), {
    ok: false,
    reason: 'tunnel-busy'
  });

  const occupiedGame = createTunnelGame({
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 2, seats: 4, colorIndex: 1, x: 5.8, z: 0, yaw: 90 }
    ]
  }).game;
  assert.deepEqual(occupiedGame.clickVehicle(1), {
    ok: false,
    reason: 'tunnel-exit-blocked'
  });
  assert.equal(
    occupiedGame.mechanicState.transportTunnel.pairs[0].feedback.reason,
    'tunnel-exit-blocked'
  );
});

test('paths unrelated to a tunnel fall through to an ordinary parking spot', () => {
  const { game } = createTunnelGame({
    vehicles: [{ id: 1, seats: 4, colorIndex: 0, x: 2, z: 0, yaw: 0 }]
  });
  assert.deepEqual(game.clickVehicle(1), { ok: true, spotIndex: 0 });
  assert.equal(game.getVehicle(1).state, 'moving-to-spot');
});

test('ordinary authored vehicle blockers win before tunnel dispatch', () => {
  const { game } = createTunnelGame({
    vehicleDepthes: { 1: [2] },
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 2, seats: 4, colorIndex: 1, x: 0, z: 0.5, yaw: 0 }
    ]
  });
  const result = game.clickVehicle(1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked');
  assert.deepEqual(result.blockers, [2]);
  assert.equal(game.mechanicState.transportTunnel.pairs[0].busyVehicleId, null);
});

test('independent pairs can transfer different vehicles at the same time', () => {
  const secondPair = {
    ...PAIR,
    id: 'cyan-2',
    label: '2',
    color: '#31d6e8',
    entrance: { ...PAIR.entrance, x: 4 },
    exit: { ...PAIR.exit, x: -5, yaw: -90 }
  };
  const { game } = createTunnelGame({
    pairs: [PAIR, secondPair],
    vehicles: [
      { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
      { id: 2, seats: 4, colorIndex: 1, x: 4, z: 0, yaw: 0 }
    ]
  });

  assert.deepEqual(game.clickVehicle(1), { ok: true, pairId: 'purple-1' });
  assert.deepEqual(game.clickVehicle(2), { ok: true, pairId: 'cyan-2' });
  assert.deepEqual(
    game.mechanicState.transportTunnel.pairs.map(({ busyVehicleId }) => busyVehicleId),
    [1, 2]
  );
});

test('a transfer is pending and only a currently actionable tunnel counts as an open destination', () => {
  const { game, runtime } = createTunnelGame();
  assert.equal(runtime.hasOpenVehicleDestination(game), true);
  game.clickVehicle(1);
  assert.equal(runtime.hasPendingVehicles(game), true);
  assert.equal(runtime.hasOpenVehicleDestination(game), false);
});

test('an open tunnel and an active transfer both prevent premature parking-capacity loss', () => {
  const { game } = createTunnelGame();
  for (const spot of game.spots) spot.vehicleId = 999;
  game.sourceQueues = [[], []];
  game.queues = [[], []];
  for (const slot of game.slots) {
    slot.colorIndex = 8;
    slot.passengerId = slot.index + 1;
  }

  game.checkEndState();
  assert.equal(game.status, 'playing');
  assert.equal(game.clickVehicle(1).ok, true);
  game.checkEndState();
  assert.equal(game.status, 'playing');
});

test('the same pair can be reused after the exited vehicle clears its spawn footprint', () => {
  const { game } = createTunnelGame();
  game.clickVehicle(1);
  game.update(0.1);
  game.update(0.1);
  game.update(0.1);

  assert.deepEqual(game.clickVehicle(1), { ok: true, spotIndex: 0 });
  assert.deepEqual(game.clickVehicle(2), { ok: true, pairId: PAIR.id });
});

test('snapshot decoration clones pair endpoints and feedback state', () => {
  const { game, runtime } = createTunnelGame({
    vehicles: [{ id: 1, seats: 4, colorIndex: 0, x: 0.34, z: 0, yaw: 0 }]
  });
  game.clickVehicle(1);
  const snapshot = runtime.decorateSnapshot(game);
  snapshot.transportTunnel.pairs[0].entrance.x = 999;
  snapshot.transportTunnel.pairs[0].feedback.reason = 'mutated';

  assert.equal(game.mechanicState.transportTunnel.pairs[0].entrance.x, 0);
  assert.equal(
    game.mechanicState.transportTunnel.pairs[0].feedback.reason,
    'tunnel-wall-blocked'
  );
});

test('level18 authors two frozen independent diagonal tunnel pairs', () => {
  const config = LEVEL_1.mechanics['transport-tunnel'];
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.pairs), true);
  assert.equal(config.pairs.length, 2);
  assert.deepEqual(config.pairs.map(({ id, label }) => ({ id, label })), [
    { id: 'purple-1', label: '1' },
    { id: 'cyan-2', label: '2' }
  ]);
  assert.equal(new Set(config.pairs.map(({ id }) => id)).size, 2);
  for (const pair of config.pairs) {
    assert.equal(Object.isFrozen(pair), true);
    assert.equal(Object.isFrozen(pair.entrance), true);
    assert.equal(Object.isFrozen(pair.exit), true);
  }
});

test('selected transport tunnel runtime composes with automatic level garages', () => {
  const game = new BusLoopGame(LEVEL_1, { mechanicId: 'transport-tunnel' });
  const snapshot = game.snapshot();
  assert.equal(game.getMechanicId(), 'transport-tunnel');
  assert.equal(snapshot.transportTunnel.pairs.length, 2);
  assert.ok(snapshot.garages.length > 0);
});

test('scene owns tunnel lifecycle geometry paired labels and feedback rendering', () => {
  const source = readFileSync(new URL('../src/scene-view.js', import.meta.url), 'utf8');
  for (const method of [
    'createTransportTunnelEndpointView',
    'createTransportTunnelPairView',
    'updateTransportTunnelViews',
    'disposeTransportTunnelViews'
  ]) {
    assert.equal(typeof SceneView.prototype[method], 'function', `${method} must exist`);
  }
  assert.match(source, /transportTunnelViews/);
  assert.match(source, /pair\.label/);
  assert.match(source, /pair\.color/);
  assert.match(source, /new THREE\.ConeGeometry/);
  assert.match(source, /tunnel-wall-blocked/);
  assert.match(source, /tunnel-busy/);
  assert.match(source, /tunnel-exit-blocked/);
  assert.match(source, /reducedMotionQuery/);
});
