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
import { validateLevelDocument } from '../tools/rotary-level-contract/validate.js';

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

function validValidationDocument() {
  return {
    format: FORMAT,
    documentId: 'strict-validation',
    target: {
      levelId: 'GameSceneDualQueue2/18',
      adapter: 'busloop-level-data.v1',
      contextFingerprint: `sha256:${'1'.repeat(64)}`
    },
    coordinates: {
      plane: 'xz',
      unit: 'level-unit',
      yaw: 'degrees',
      geometryProfile: 'busloop-level18-rotary.v1'
    },
    vehicles: [{
      id: 1,
      colorIndex: 0,
      seats: 4,
      placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
    }],
    rotaryLanes: [],
    context: {
      ...emptyContext([0, 1]),
      vehicleFootprints: {
        4: { width: 0.27, length: 0.4814318817567568 },
        6: { width: 0.27, length: 0.5639630614864864 },
        10: { width: 0.27, length: 0.6785897 }
      }
    }
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

test('strict validation reports stable codes and paths', () => {
  const cases = [
    {
      mutate(document) {
        document.unexpected = true;
      },
      expected: ['document.unknown-key', '/unexpected']
    },
    {
      mutate(document) {
        document.vehicles[0].placement.extra = true;
      },
      expected: [
        'vehicle.placement.unknown-key',
        '/vehicles/0/placement/extra'
      ]
    },
    {
      mutate(document) {
        document.vehicles[0].placement.x = Number.NaN;
      },
      expected: ['value.non-finite', '/vehicles/0/placement/x']
    },
    {
      mutate(document) {
        document.vehicles[0].colorIndex = 9;
      },
      expected: ['vehicle.color-not-allowed', '/vehicles/0/colorIndex']
    },
    {
      mutate(document) {
        document.vehicles[0].seats = 8;
      },
      expected: ['vehicle.unsupported-seats', '/vehicles/0/seats']
    }
  ];

  for (const { mutate, expected: [code, path] } of cases) {
    const document = validValidationDocument();
    mutate(document);
    assert.ok(
      validateLevelDocument(document).errors.some((entry) => (
        entry.code === code && entry.path === path
      )),
      `expected ${code} at ${path}`
    );
  }
});
