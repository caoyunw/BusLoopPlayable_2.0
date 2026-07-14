import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeRotaryLanes,
  rotateLaneOccupants
} from '../src/mechanics/rotary-lane/model.js';

const VEHICLES = Object.freeze([
  { id: 1, seats: 4, colorIndex: 0, x: 0, z: 0, yaw: 0 },
  { id: 2, seats: 4, colorIndex: 1, x: 1, z: 0, yaw: 90 },
  { id: 3, seats: 4, colorIndex: 2, x: 1, z: 1, yaw: 180 }
]);

const LANE = Object.freeze({
  id: 'loop-a',
  slots: Object.freeze([
    Object.freeze({ x: 0, z: 0, yaw: 90, vehicleId: 1 }),
    Object.freeze({ x: 1, z: 0, yaw: 0, vehicleId: null }),
    Object.freeze({ x: 1, z: 1, yaw: -90, vehicleId: 2 }),
    Object.freeze({ x: 0, z: 1, yaw: 180, vehicleId: 3 })
  ])
});

test('normalization keeps valid degree-based lanes and rejects invalid or conflicting lanes', () => {
  const result = normalizeRotaryLanes({
    lanes: [
      LANE,
      { ...LANE, id: 'loop-a' },
      { id: 'too-short', slots: LANE.slots.slice(0, 2) },
      {
        id: 'duplicate-vehicle',
        slots: LANE.slots.map((slot, index) => ({
          ...slot,
          vehicleId: index === 0 ? 1 : null
        }))
      },
      {
        id: 'unknown-vehicle',
        slots: LANE.slots.map((slot, index) => ({
          ...slot,
          vehicleId: index === 0 ? 999 : null
        }))
      }
    ]
  }, VEHICLES);

  assert.equal(result.invalidLaneCount, 4);
  assert.deepEqual(result.lanes, [LANE]);
});

test('occupants and empty slots rotate forward exactly one slot with wraparound', () => {
  assert.deepEqual(
    rotateLaneOccupants([1, null, 2, 3]),
    [3, 1, null, 2]
  );
});
