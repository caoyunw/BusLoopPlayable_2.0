import test from 'node:test';
import assert from 'node:assert/strict';

import { validateLevelDocument } from '../tools/rotary-level-contract/validate.js';

function validDocument() {
  return {
    format: 'level.rotary.v1',
    documentId: 'geometry',
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
    vehicles: [
      {
        id: 1,
        colorIndex: 0,
        seats: 4,
        placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
      }
    ],
    rotaryLanes: [{
      id: 'outer',
      slots: [
        { id: 'a', x: -2, z: -2, yaw: 90 },
        { id: 'b', x: 2, z: -2, yaw: 0 },
        { id: 'c', x: 2, z: 2, yaw: -90 },
        { id: 'd', x: -2, z: 2, yaw: 180 }
      ]
    }],
    context: {
      garages: [],
      parkingSpots: [],
      conveyors: [],
      passengerQueues: [],
      protectedGeometry: [],
      vehicleFootprints: {
        4: { width: 0.27, length: 0.4814318817567568 },
        6: { width: 0.27, length: 0.5639630614864864 },
        10: { width: 0.27, length: 0.6785897 }
      },
      rotaryRoadWidth: 0.42,
      allowedColorIndexes: [0, 1, 2]
    }
  };
}

test('a closed lane may enclose an ordinary vehicle', () => {
  const result = validateLevelDocument(validDocument());
  assert.deepEqual(result.errors, []);
});

test('road crossing an ordinary vehicle is a blocking error', () => {
  const document = validDocument();
  document.vehicles[0].placement = {
    kind: 'field',
    x: 0,
    z: -2,
    yaw: 0
  };
  assert.ok(
    validateLevelDocument(document).errors.some(
      ({ code }) => code === 'geometry.road-vehicle-overlap'
    )
  );
});

test('duplicate IDs, unknown slots, and duplicate stock order are blocking', () => {
  const document = validDocument();
  document.vehicles.push(
    {
      id: 1,
      colorIndex: 0,
      seats: 4,
      placement: { kind: 'rotary-slot', laneId: 'outer', slotId: 'missing' }
    },
    {
      id: 3,
      colorIndex: 0,
      seats: 4,
      placement: {
        kind: 'garage',
        garageId: 9,
        stockOrder: 0,
        storedPose: { x: 0, z: 0, yaw: 0 }
      }
    },
    {
      id: 4,
      colorIndex: 0,
      seats: 4,
      placement: {
        kind: 'garage',
        garageId: 9,
        stockOrder: 0,
        storedPose: { x: 0, z: 0, yaw: 0 }
      }
    }
  );
  document.context.garages.push({
    id: 9,
    x: 4,
    z: 4,
    yaw: 0,
    width: 0.6,
    length: 0.8
  });
  const codes = validateLevelDocument(document).errors.map(({ code }) => code);
  assert.ok(codes.includes('vehicle.duplicate-id'));
  assert.ok(codes.includes('vehicle.unknown-slot'));
  assert.ok(codes.includes('garage.duplicate-stock-order'));
});

test('self-intersecting lane is rejected and no-empty-slot is a warning', () => {
  const document = validDocument();
  document.rotaryLanes[0].slots = [
    { id: 'a', x: -1, z: -1, yaw: 0 },
    { id: 'b', x: 1, z: 1, yaw: 0 },
    { id: 'c', x: -1, z: 1, yaw: 0 },
    { id: 'd', x: 1, z: -1, yaw: 0 }
  ];
  document.vehicles = document.rotaryLanes[0].slots.map((slot, index) => ({
    id: index + 1,
    colorIndex: 0,
    seats: 4,
    placement: { kind: 'rotary-slot', laneId: 'outer', slotId: slot.id }
  }));
  const result = validateLevelDocument(document);
  assert.ok(result.errors.some(({ code }) => code === 'lane.self-intersection'));
  assert.ok(result.warnings.some(({ code }) => code === 'lane.no-empty-slot'));
});
