import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

import { computeContextFingerprint } from '../tools/rotary-level-contract/fingerprint.js';
import { worldToScreen } from '../tools/rotary-level-editor/canvas-view.js';
import { createEditorApplication } from '../tools/rotary-level-editor/app-controller.js';
import { createDraftEnvelope, saveDraft } from '../tools/rotary-level-editor/persistence.js';
import {
  buildObjectTreeModel,
  buildPropertyModel,
  buildValidationRows
} from '../tools/rotary-level-editor/panels.js';

const editorRoot = new URL('../tools/rotary-level-editor/', import.meta.url);

class FakeUiClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeUiNode {
  constructor(ownerDocument, tagName = 'div') {
    this.ownerDocument = ownerDocument ?? this;
    this.tagName = tagName.toUpperCase();
    this.listeners = new Map();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = new FakeUiClassList();
    this.disabled = false;
    this.value = '';
    this.files = [];
    this.open = false;
    this.textContent = '';
  }

  addEventListener(type, listener) {
    const values = this.listeners.get(type) ?? new Set();
    values.add(listener);
    this.listeners.set(type, values);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  async dispatchAsync(type, values = {}) {
    const event = {
      type,
      target: this,
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      code: '',
      key: '',
      preventDefault() {},
      ...values
    };
    await Promise.all(
      [...(this.listeners.get(type) ?? [])].map((listener) => listener(event))
    );
  }

  listenerCount() {
    return [...this.listeners.values()]
      .reduce((count, listeners) => count + listeners.size, 0);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  getAttribute(name) {
    return this[name] ?? null;
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  focus() {}

  blur() {}

  click() {
    return this.dispatchAsync('click');
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }

  setPointerCapture() {}

  releasePointerCapture() {}
}

function createUiDocument() {
  const root = new FakeUiNode(null, 'document');
  root.ownerDocument = root;
  root.body = new FakeUiNode(root, 'body');
  const nodes = new Map();
  const add = (selector, tagName = 'div') => {
    const node = new FakeUiNode(root, tagName);
    nodes.set(selector, node);
    return node;
  };
  for (const [selector, tagName] of [
    ['#toolbar', 'header'],
    ['#object-tree-content', 'div'],
    ['#editor-canvas', 'canvas'],
    ['#property-panel-content', 'div'],
    ['#validation-rows', 'div'],
    ['#validation-summary', 'div'],
    ['#import-input', 'input'],
    ['#save-as-dialog', 'dialog'],
    ['#save-as-document-id', 'input'],
    ['#recovery-dialog', 'dialog'],
    ['#document-name', 'span'],
    ['#draft-status', 'output'],
    ['#canvas-status', 'output'],
    ['#toast-region', 'div']
  ]) add(selector, tagName);
  const context = { setTransform() {} };
  nodes.get('#editor-canvas').getContext = () => context;

  const actions = new Map();
  for (const action of [
    'new',
    'import',
    'export',
    'save-as',
    'undo',
    'redo',
    'select',
    'add-vehicle',
    'add-lane',
    'confirm-save-as',
    'download-recovery',
    'discard-recovery',
    'restore-recovery'
  ]) {
    const button = new FakeUiNode(root, 'button');
    button.dataset.action = action;
    actions.set(action, button);
  }
  root.defaultView = new FakeUiNode(root, 'window');
  root.defaultView.devicePixelRatio = 1;
  root.defaultView.cancelAnimationFrame = () => {};
  root.querySelector = (selector) => nodes.get(selector)
    ?? (selector.startsWith('[data-action="')
      ? actions.get(selector.slice(14, -2))
      : null);
  root.querySelectorAll = (selector) => selector === '[data-action]'
    ? [...actions.values()]
    : [];
  root.createElement = (tagName) => new FakeUiNode(root, tagName);
  return { root, nodes, actions };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

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

async function applicationTemplate() {
  const source = documentWithAllOwnerships();
  const template = {
    format: 'level.rotary.v1',
    documentId: 'level18-template',
    target: {
      levelId: 'GameSceneDualQueue2/18',
      adapter: 'busloop-level-data.v1',
      contextFingerprint: `sha256:${'0'.repeat(64)}`
    },
    coordinates: {
      plane: 'xz',
      unit: 'level-unit',
      yaw: 'degrees',
      geometryProfile: 'busloop-level18-rotary.v1'
    },
    vehicles: [],
    rotaryLanes: [],
    context: {
      ...structuredClone(source.context),
      vehicleFootprints: {
        4: { width: 0.27, length: 0.4814318817567568 },
        6: { width: 0.27, length: 0.5639630614864864 },
        10: { width: 0.27, length: 0.6785897 }
      },
      rotaryRoadWidth: 0.42,
      allowedColorIndexes: [0, 1, 2]
    }
  };
  template.target.contextFingerprint = await computeContextFingerprint(
    template,
    webcrypto.subtle
  );
  return template;
}

test('application flow isolates import failure and wires new, export, Save As, drafts, and errors', async () => {
  const template = await applicationTemplate();
  const ui = createUiDocument();
  const storage = createMemoryStorage();
  const downloads = [];
  const application = await createEditorApplication({
    root: ui.root,
    storage,
    loadTemplate: async () => structuredClone(template),
    download(descriptor) {
      downloads.push(descriptor);
    },
    requestFrame: () => 1,
    now: () => 1234
  });

  assert.equal(application.snapshot().document.documentId, 'untitled-level18');
  assert.deepEqual(application.snapshot().document.vehicles, []);

  const imported = structuredClone(template);
  imported.documentId = 'formal-layout';
  imported.vehicles.push({
    id: 1,
    colorIndex: 0,
    seats: 4,
    placement: { kind: 'field', x: 0, z: 0, yaw: 0 }
  });
  ui.nodes.get('#import-input').files = [{
    text: async () => JSON.stringify(imported)
  }];
  await ui.nodes.get('#import-input').dispatchAsync('change');
  assert.equal(application.snapshot().document.documentId, 'formal-layout');
  assert.equal(application.snapshot().historyLength, 0);

  ui.nodes.get('#import-input').files = [{ text: async () => '{bad' }];
  await ui.nodes.get('#import-input').dispatchAsync('change');
  assert.equal(application.snapshot().document.documentId, 'formal-layout');

  await ui.actions.get('export').dispatchAsync('click');
  assert.match(downloads.at(-1).filename, /^formal-layout\./);

  ui.nodes.get('#save-as-document-id').value = 'renamed-layout';
  await ui.actions.get('confirm-save-as').dispatchAsync('click');
  assert.equal(application.snapshot().document.documentId, 'renamed-layout');
  assert.equal(application.snapshot().historyLength, 1);
  assert.match(downloads.at(-1).filename, /^renamed-layout\./);

  await ui.actions.get('add-vehicle').dispatchAsync('click');
  const screen = worldToScreen({ x: 0, z: 0 }, application.snapshot().camera);
  await ui.nodes.get('#editor-canvas').dispatchAsync('pointerdown', {
    clientX: screen.x,
    clientY: screen.y,
    pointerId: 1
  });
  assert.equal(application.snapshot().exportDisabled, true);
  assert.equal(ui.actions.get('export').disabled, true);
  assert.equal(ui.actions.get('download-recovery').disabled, false);

  const errorButton = ui.nodes.get('#validation-rows').children[0];
  await errorButton.dispatchAsync('click');
  assert.deepEqual(application.snapshot().selection, [
    { type: 'vehicle', id: 2 }
  ]);

  await ui.root.defaultView.dispatchAsync('pagehide');
  assert.ok(
    [...storage.values.keys()].some((key) => key.endsWith(':renamed-layout'))
  );

  await ui.actions.get('new').dispatchAsync('click');
  assert.deepEqual(application.snapshot().document.vehicles, []);
  assert.deepEqual(application.snapshot().document.rotaryLanes, []);
  assert.equal(
    application.snapshot().document.target.contextFingerprint,
    template.target.contextFingerprint
  );

  const listenerCountBeforeDispose = ui.root.defaultView.listenerCount()
    + ui.nodes.get('#editor-canvas').listenerCount();
  assert.ok(listenerCountBeforeDispose > 0);
  application.dispose();
  assert.equal(ui.root.defaultView.listenerCount(), 0);
  assert.equal(ui.nodes.get('#editor-canvas').listenerCount(), 0);
});

test('cold start opens recovery choice for a changed isolated draft', async () => {
  const template = await applicationTemplate();
  const ui = createUiDocument();
  const storage = createMemoryStorage();
  const recovered = structuredClone(template);
  recovered.documentId = 'untitled-level18';
  recovered.vehicles.push({
    id: 1,
    colorIndex: 0,
    seats: 4,
    placement: { kind: 'field', x: 1, z: 1, yaw: 0 }
  });
  saveDraft(storage, createDraftEnvelope({
    document: recovered,
    historyCursor: 1,
    history: []
  }, 'sha256:different-baseline', 1000));

  const application = await createEditorApplication({
    root: ui.root,
    storage,
    loadTemplate: async () => structuredClone(template),
    download() {},
    requestFrame: () => 1,
    now: () => 1234
  });
  assert.equal(ui.nodes.get('#recovery-dialog').open, true);
  await ui.actions.get('restore-recovery').dispatchAsync('click');
  assert.equal(application.snapshot().document.vehicles.length, 1);
  application.dispose();
});
