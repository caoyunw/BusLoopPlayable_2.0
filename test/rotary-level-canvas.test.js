import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCanvasModel,
  computeDocumentBounds,
  hitTestEditorPoint,
  resizeCanvas,
  screenToWorld,
  worldToScreen
} from '../tools/rotary-level-editor/canvas-view.js';

function baseDocument() {
  return {
    vehicles: [{
      id: 1,
      colorIndex: 0,
      seats: 4,
      placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
    }],
    rotaryLanes: [{
      id: 'outer',
      slots: [
        { id: 'a', x: 0, z: 0, yaw: 0 },
        { id: 'b', x: 1, z: 0, yaw: 90 },
        { id: 'c', x: 1, z: 1, yaw: 180 }
      ]
    }],
    context: {
      garages: [],
      parkingSpots: [],
      conveyors: [],
      passengerQueues: [],
      protectedGeometry: [{
        id: 'protected-1',
        kind: 'protected',
        label: 'Protected',
        x: 0,
        z: 0,
        yaw: 0,
        width: 1,
        length: 1,
        protected: true
      }],
      vehicleFootprints: {
        4: { width: 0.27, length: 0.4814318817567568 },
        6: { width: 0.27, length: 0.5639630614864864 },
        10: { width: 0.27, length: 0.6785897 }
      },
      rotaryRoadWidth: 0.42,
      allowedColorIndexes: [0]
    }
  };
}

function documentWithContext() {
  const document = baseDocument();
  document.rotaryLanes[0].slots[0] = {
    id: 'a',
    x: -2.5,
    z: -1.5,
    yaw: 0
  };
  document.context.garages.push({
    id: 7,
    x: 0,
    z: 0,
    yaw: 0,
    width: 0.6,
    length: 0.8
  });
  document.context.protectedGeometry[0] = {
    ...document.context.protectedGeometry[0],
    x: 3,
    z: 4,
    width: 1,
    length: 1
  };
  return document;
}

test('world and screen transforms round trip with pan and zoom', () => {
  const camera = {
    centerX: 1,
    centerZ: -2,
    zoom: 100,
    width: 800,
    height: 600
  };
  const screen = worldToScreen({ x: 2, z: 0 }, camera);
  assert.deepEqual(screen, { x: 500, y: 100 });
  assert.deepEqual(screenToWorld(screen, camera), { x: 2, z: 0 });
});

test('hit testing prefers vehicle over lane road and read-only context', () => {
  const model = buildCanvasModel(baseDocument(), { errors: [], warnings: [] }, []);
  const hit = hitTestEditorPoint({ x: 0, z: 0 }, model, 0.08);
  assert.deepEqual(hit, { type: 'vehicle', id: 1 });
});

test('fit bounds includes lane, field vehicles, garages, and protected geometry', () => {
  assert.deepEqual(
    computeDocumentBounds(documentWithContext()),
    { minX: -3, maxX: 4, minZ: -2, maxZ: 5 }
  );
});

test('high-DPI resize sets backing pixels and logical transform', () => {
  const calls = [];
  const context = {
    setTransform(...args) {
      calls.push(args);
    }
  };
  const canvas = {
    style: {},
    getContext(type) {
      assert.equal(type, '2d');
      return context;
    }
  };
  assert.equal(resizeCanvas(canvas, 320, 180, 2), context);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 360);
  assert.equal(canvas.style.width, '320px');
  assert.equal(canvas.style.height, '180px');
  assert.deepEqual(calls, [[2, 0, 0, 2, 0, 0]]);
});
