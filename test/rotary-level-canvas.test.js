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
import { createCanvasController } from '../tools/rotary-level-editor/canvas-controller.js';
import { createEditorStore } from '../tools/rotary-level-editor/editor-store.js';
import * as documentCommands from '../tools/rotary-level-editor/document-commands.js';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, values = {}) {
    const event = {
      type,
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault() {},
      ...values
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  listenerCount() {
    return [...this.listeners.values()]
      .reduce((count, listeners) => count + listeners.size, 0);
  }
}

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

function interactionDocument({ vehicle = true } = {}) {
  const document = baseDocument();
  document.rotaryLanes = [];
  document.context.protectedGeometry = [];
  if (!vehicle) document.vehicles = [];
  return document;
}

function createControllerHarness({ document = interactionDocument(), mode = 'select' } = {}) {
  const canvas = new FakeEventTarget();
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 300,
    height: 300
  });
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  canvas.focus = () => {};
  const keyboard = new FakeEventTarget();
  const store = createEditorStore(document);
  let camera = {
    centerX: 0,
    centerZ: 0,
    zoom: 100,
    width: 300,
    height: 300
  };
  const commandEvents = [];
  const controller = createCanvasController({
    canvas,
    keyboardTarget: keyboard,
    getSnapshot: store.snapshot,
    getCamera: () => ({ ...camera }),
    setCamera(next) {
      camera = { ...next };
    },
    store,
    commands: {
      ...documentCommands,
      onControllerCommand(event) {
        commandEvents.push(event);
      }
    },
    requestRender() {}
  });
  controller.setMode(mode);
  const pointer = (type, values) => canvas.dispatch(type, values);
  return {
    canvas,
    keyboard,
    store,
    controller,
    commandEvents,
    getCamera: () => camera,
    pointerClick(values) {
      pointer('pointerdown', values);
      pointer('pointerup', values);
    },
    pointer,
    key(type, values) {
      keyboard.dispatch(type, values);
    }
  };
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

test('click selection toggles with Shift and blank drag creates marquee selection', () => {
  const harness = createControllerHarness();
  harness.pointerClick({ clientX: 150, clientY: 150 });
  assert.deepEqual(harness.store.snapshot().selection, [
    { type: 'vehicle', id: 1 }
  ]);
  harness.pointerClick({ clientX: 150, clientY: 150, shiftKey: true });
  assert.deepEqual(harness.store.snapshot().selection, []);

  harness.pointer('pointerdown', { clientX: 100, clientY: 200 });
  harness.pointer('pointermove', { clientX: 200, clientY: 100 });
  harness.pointer('pointerup', { clientX: 200, clientY: 100 });
  assert.deepEqual(harness.store.snapshot().selection, [
    { type: 'vehicle', id: 1 }
  ]);
});

test('selected drag is one preview command and Alt bypasses grid snap', () => {
  const harness = createControllerHarness();
  harness.pointerClick({ clientX: 150, clientY: 150 });
  harness.pointer('pointerdown', { clientX: 150, clientY: 150 });
  harness.pointer('pointermove', { clientX: 157, clientY: 150 });
  harness.pointer('pointerup', { clientX: 157, clientY: 150 });
  assert.equal(harness.store.snapshot().document.vehicles[0].placement.x, 0.05);
  assert.equal(harness.store.snapshot().historyLength, 1);

  harness.store.undo();
  harness.pointer('pointerdown', { clientX: 150, clientY: 150 });
  harness.pointer('pointermove', {
    clientX: 157,
    clientY: 150,
    altKey: true
  });
  harness.pointer('pointerup', { clientX: 157, clientY: 150, altKey: true });
  assert.ok(
    Math.abs(harness.store.snapshot().document.vehicles[0].placement.x - 0.07)
      < 1e-9
  );
});

test('wheel anchors zoom, Space pans, and keyboard edits selection', () => {
  const harness = createControllerHarness();
  const beforeWorld = screenToWorld({ x: 220, y: 100 }, harness.getCamera());
  harness.canvas.dispatch('wheel', {
    clientX: 220,
    clientY: 100,
    deltaY: -120
  });
  const afterWorld = screenToWorld({ x: 220, y: 100 }, harness.getCamera());
  assert.ok(Math.abs(beforeWorld.x - afterWorld.x) < 1e-9);
  assert.ok(Math.abs(beforeWorld.z - afterWorld.z) < 1e-9);

  const beforePan = { ...harness.getCamera() };
  harness.key('keydown', { code: 'Space', key: ' ' });
  harness.pointer('pointerdown', { clientX: 100, clientY: 100 });
  harness.pointer('pointermove', { clientX: 120, clientY: 110 });
  harness.pointer('pointerup', { clientX: 120, clientY: 110 });
  harness.key('keyup', { code: 'Space', key: ' ' });
  assert.notEqual(harness.getCamera().centerX, beforePan.centerX);

  harness.pointerClick({
    clientX: worldToScreen({ x: 0, z: 0 }, harness.getCamera()).x,
    clientY: worldToScreen({ x: 0, z: 0 }, harness.getCamera()).y
  });
  harness.key('keydown', { key: 'e', code: 'KeyE' });
  assert.equal(harness.store.snapshot().document.vehicles[0].placement.yaw, 15);
  harness.key('keydown', { key: 'Delete', code: 'Delete' });
  assert.equal(harness.store.snapshot().document.vehicles.length, 0);
});

test('lane mode closes only after three slots and start click', () => {
  const harness = createControllerHarness({
    document: interactionDocument({ vehicle: false }),
    mode: 'lane'
  });
  harness.pointerClick({ clientX: 100, clientY: 100 });
  harness.pointerClick({ clientX: 200, clientY: 100 });
  harness.pointerClick({ clientX: 200, clientY: 200 });
  harness.pointerClick({ clientX: 100, clientY: 100 });
  assert.deepEqual(
    harness.commandEvents.map(({ type }) => type),
    ['start-lane', 'add-slot', 'add-slot', 'close-lane']
  );
  assert.equal(harness.store.snapshot().document.rotaryLanes.length, 1);
  assert.equal(harness.store.snapshot().document.rotaryLanes[0].slots.length, 3);
});

test('Escape cancels a draft lane without history and dispose removes listeners', () => {
  const harness = createControllerHarness({
    document: interactionDocument({ vehicle: false }),
    mode: 'lane'
  });
  harness.pointerClick({ clientX: 100, clientY: 100 });
  harness.pointerClick({ clientX: 200, clientY: 100 });
  harness.key('keydown', { key: 'Escape', code: 'Escape' });
  assert.deepEqual(harness.controller.getDraftLane(), []);
  assert.equal(harness.store.snapshot().historyLength, 0);
  assert.ok(harness.canvas.listenerCount() > 0);
  assert.ok(harness.keyboard.listenerCount() > 0);
  harness.controller.dispose();
  assert.equal(harness.canvas.listenerCount(), 0);
  assert.equal(harness.keyboard.listenerCount(), 0);
});
