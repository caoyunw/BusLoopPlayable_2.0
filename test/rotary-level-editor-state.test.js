import test from 'node:test';
import assert from 'node:assert/strict';

import { createEditorStore } from '../tools/rotary-level-editor/editor-store.js';
import {
  assignVehicle,
  deleteLane,
  moveSelection,
  rotateSelection
} from '../tools/rotary-level-editor/document-commands.js';

function documentWithFieldVehicle() {
  return {
    vehicles: [{
      id: 1,
      colorIndex: 0,
      seats: 4,
      placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
    }],
    rotaryLanes: []
  };
}

function documentWithGarageAndLane() {
  return {
    vehicles: [
      {
        id: 10,
        colorIndex: 0,
        seats: 4,
        placement: {
          kind: 'garage',
          garageId: 7,
          stockOrder: 0,
          storedPose: { x: 3, z: 3, yaw: 0 }
        }
      },
      {
        id: 11,
        colorIndex: 1,
        seats: 6,
        placement: {
          kind: 'garage',
          garageId: 7,
          stockOrder: 1,
          storedPose: { x: 3, z: 4, yaw: 0 }
        }
      }
    ],
    rotaryLanes: [{
      id: 'outer',
      slots: [{ id: 'slot-a', x: -1, z: 0, yaw: 90 }]
    }]
  };
}

function documentWithOccupiedLane() {
  return {
    vehicles: [{
      id: 1,
      colorIndex: 0,
      seats: 4,
      placement: {
        kind: 'rotary-slot',
        laneId: 'outer',
        slotId: 'slot-a'
      }
    }],
    rotaryLanes: [{
      id: 'outer',
      slots: [
        { id: 'slot-a', x: -1, z: 0, yaw: 90 },
        { id: 'slot-b', x: 1, z: 0, yaw: -90 },
        { id: 'slot-c', x: 0, z: 1, yaw: 180 }
      ]
    }]
  };
}

test('drag preview becomes one undoable command', () => {
  const store = createEditorStore(documentWithFieldVehicle());
  store.beginPreview('Move vehicle');
  store.updatePreview((document) => moveSelection(
    document,
    [{ type: 'vehicle', id: 1 }],
    1,
    0
  ));
  store.updatePreview((document) => moveSelection(
    document,
    [{ type: 'vehicle', id: 1 }],
    2,
    0
  ));
  store.commitPreview();
  assert.equal(store.snapshot().document.vehicles[0].placement.x, 2);
  assert.equal(store.snapshot().historyLength, 1);
  store.undo();
  assert.equal(store.snapshot().document.vehicles[0].placement.x, 0);
});

test('assigning a garage vehicle to a lane is atomic and compacts stock order', () => {
  const result = assignVehicle(documentWithGarageAndLane(), 10, {
    kind: 'rotary-slot',
    laneId: 'outer',
    slotId: 'slot-a'
  });
  assert.deepEqual(
    result.vehicles.find(({ id }) => id === 10).placement,
    { kind: 'rotary-slot', laneId: 'outer', slotId: 'slot-a' }
  );
  assert.deepEqual(
    result.vehicles
      .filter(({ placement }) => placement.kind === 'garage')
      .map(({ placement }) => placement.stockOrder),
    [0]
  );
});

test('deleting a lane preserves occupants as field vehicles at slot poses', () => {
  const result = deleteLane(documentWithOccupiedLane(), 'outer');
  assert.equal(result.rotaryLanes.length, 0);
  assert.deepEqual(
    result.vehicles[0].placement,
    { kind: 'field', x: -1, z: 0, yaw: 90 }
  );
});

test('new edit after undo clears redo branch', () => {
  const store = createEditorStore(documentWithFieldVehicle());
  store.commit('move', (document) => moveSelection(
    document,
    [{ type: 'vehicle', id: 1 }],
    1,
    0
  ));
  store.undo();
  store.commit('rotate', (document) => rotateSelection(
    document,
    [{ type: 'vehicle', id: 1 }],
    15
  ));
  assert.equal(store.canRedo(), false);
});
