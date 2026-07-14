import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  FORMAT,
  canonicalStringify,
  createEmptyDocument,
  normalizeYaw
} from '../tools/rotary-level-contract/document.js';
import { computeContextFingerprint } from '../tools/rotary-level-contract/fingerprint.js';

function emptyContext(allowedColorIndexes = [0, 1]) {
  return {
    garages: [],
    parkingSpots: [],
    conveyors: [],
    passengerQueues: [],
    protectedGeometry: [],
    vehicleFootprints: {},
    rotaryRoadWidth: 0.42,
    allowedColorIndexes
  };
}

test('empty v1 document has strict coordinate and ownership sections', () => {
  const document = createEmptyDocument({
    documentId: 'untitled',
    target: { levelId: 'GameSceneDualQueue2/18', adapter: 'busloop-level-data.v1' },
    context: emptyContext()
  });

  assert.equal(document.format, FORMAT);
  assert.deepEqual(document.vehicles, []);
  assert.deepEqual(document.rotaryLanes, []);
  assert.equal(document.coordinates.yaw, 'degrees');
});

test('yaw normalization is stable in [-180, 180)', () => {
  assert.equal(normalizeYaw(180), -180);
  assert.equal(normalizeYaw(450), 90);
  assert.equal(normalizeYaw(-540), -180);
});

test('canonical serialization is byte-stable without timestamps', () => {
  const value = { z: 1, a: { y: 2, x: 1 }, list: [{ b: 2, a: 1 }] };

  assert.equal(
    canonicalStringify(value),
    '{\n  "a": {\n    "x": 1,\n    "y": 2\n  },\n  "list": [\n    {\n      "a": 1,\n      "b": 2\n    }\n  ],\n  "z": 1\n}\n'
  );
});

test('context fingerprint excludes editable vehicles and lanes', async () => {
  const base = createEmptyDocument({
    documentId: 'a',
    target: { levelId: 'GameSceneDualQueue2/18', adapter: 'busloop-level-data.v1' },
    context: emptyContext([0])
  });

  const first = await computeContextFingerprint(base, webcrypto.subtle);
  const second = await computeContextFingerprint({ ...base, vehicles: [{ id: 1 }] }, webcrypto.subtle);

  assert.equal(first, second);
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
});
