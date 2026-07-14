import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildObjectTreeModel,
  buildPropertyModel,
  buildValidationRows
} from '../tools/rotary-level-editor/panels.js';

const editorRoot = new URL('../tools/rotary-level-editor/', import.meta.url);

function documentWithAllOwnerships() {
  return {
    vehicles: [
      {
        id: 1,
        colorIndex: 0,
        seats: 4,
        placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
      },
      {
        id: 2,
        colorIndex: 1,
        seats: 6,
        placement: {
          kind: 'rotary-slot',
          laneId: 'outer',
          slotId: 'slot-a'
        }
      },
      {
        id: 3,
        colorIndex: 2,
        seats: 10,
        placement: {
          kind: 'garage',
          garageId: 7,
          stockOrder: 0,
          storedPose: { x: 3, z: 3, yaw: 0 }
        }
      }
    ],
    rotaryLanes: [{
      id: 'outer',
      slots: [
        { id: 'slot-a', x: -1, z: 0, yaw: 90 },
        { id: 'slot-b', x: 1, z: 0, yaw: -90 },
        { id: 'slot-c', x: 0, z: 1, yaw: 180 }
      ]
    }],
    context: {
      garages: [{
        id: 7,
        x: 3,
        z: 3,
        yaw: 0,
        width: 0.6,
        length: 0.8
      }],
      parkingSpots: [{
        id: 'parking-1',
        kind: 'parking',
        label: 'Parking 1',
        x: 2,
        z: 1,
        yaw: 0,
        width: 0.5,
        length: 0.8,
        protected: true
      }],
      conveyors: [{ id: 'conveyor-1', label: 'Conveyor', count: 1 }],
      passengerQueues: [{ id: 'queue-1', label: 'Queue', count: 4 }],
      protectedGeometry: []
    }
  };
}

test('semantic shell contains all editor regions, actions, and dialogs', async () => {
  const html = await readFile(new URL('index.html', editorRoot), 'utf8');
  for (const id of [
    'toolbar',
    'object-tree',
    'editor-canvas',
    'property-panel',
    'validation-panel'
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const action of [
    'new',
    'import',
    'export',
    'save-as',
    'undo',
    'redo',
    'select',
    'add-vehicle',
    'add-lane'
  ]) {
    assert.match(html, new RegExp(`data-action=["']${action}["']`));
  }
  assert.match(html, /id=["']import-input["'][^>]*hidden/);
  assert.match(html, /id=["']save-as-dialog["']/);
  assert.match(html, /id=["']recovery-dialog["']/);
  assert.match(html, /src=["']\.\/main\.js["']/);
});

test('styles define desktop grid, responsive drawers, and state classes', async () => {
  const css = await readFile(new URL('styles.css', editorRoot), 'utf8');
  assert.match(css, /grid-template-columns:\s*220px\s+minmax\(0,\s*1fr\)\s+280px/);
  assert.match(css, /grid-template-areas:[\s\S]*"toolbar toolbar toolbar"/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  for (const className of [
    'is-error',
    'is-selected',
    'is-readonly',
    'export-disabled'
  ]) {
    assert.match(css, new RegExp(`\\.${className}`));
  }
});

test('tree groups field, lane, garage, and read-only objects', () => {
  const model = buildObjectTreeModel(documentWithAllOwnerships(), []);
  assert.deepEqual(
    model.groups.map(({ id }) => id),
    ['field', 'lanes', 'garages', 'readonly']
  );
  assert.equal(model.groups[0].items.length, 1);
  assert.equal(model.groups[1].items[0].children[0].occupantId, 2);
  assert.equal(model.groups[2].items[0].children[0].id, 3);
  assert.ok(model.groups[3].items.length >= 3);
});

test('rotary vehicle property coordinates target its referenced slot', () => {
  const model = buildPropertyModel(
    documentWithAllOwnerships(),
    [{ type: 'vehicle', id: 2 }]
  );
  const x = model.fields.find(({ key }) => key === 'x');
  assert.equal(x.value, -1);
  assert.deepEqual(x.target, { type: 'slot', laneId: 'outer', id: 'slot-a' });
});

test('error row carries object focus target and JSON path', () => {
  const rows = buildValidationRows({
    errors: [{
      code: 'vehicle.duplicate-id',
      objectType: 'vehicle',
      objectId: 7,
      path: '/vehicles/1/id',
      message: 'duplicate'
    }],
    warnings: []
  });
  assert.deepEqual(rows[0].focus, { type: 'vehicle', id: 7 });
  assert.equal(rows[0].path, '/vehicles/1/id');
});

test('panel rendering source never injects document values with innerHTML', async () => {
  const source = await readFile(new URL('panels.js', editorRoot), 'utf8');
  assert.doesNotMatch(source, /innerHTML/);
  assert.match(source, /textContent/);
  assert.match(source, /createElement/);
});
