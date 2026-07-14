import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyTransportTunnelApproach,
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
