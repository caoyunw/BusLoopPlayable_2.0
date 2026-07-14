import {
  buildCanvasModel,
  hitTestEditorPoint,
  hitTestMarquee,
  screenToWorld,
  worldToScreen
} from './canvas-view.js';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function sameSelection(left, right) {
  if (left.type !== right.type || left.id !== right.id) return false;
  return left.type !== 'slot' || left.laneId === right.laneId;
}

function snap(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

function isEditableHit(hit) {
  return hit && ['vehicle', 'slot', 'lane'].includes(hit.type);
}

function shouldIgnoreKeyboard(event) {
  const target = event.target;
  const tagName = target?.tagName?.toLowerCase();
  return target?.isContentEditable
    || tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select';
}

export function createCanvasController(options) {
  const {
    canvas,
    getSnapshot,
    getCamera,
    setCamera,
    store,
    commands,
    requestRender,
    onModeChange = () => {},
    keyboardTarget = globalThis.window ?? canvas,
    gridSize = 0.05,
    angleStep = 15
  } = options;

  if (!canvas
    || typeof getSnapshot !== 'function'
    || typeof getCamera !== 'function'
    || typeof setCamera !== 'function'
    || !store
    || !commands
    || typeof requestRender !== 'function') {
    throw new Error('Canvas controller is missing required dependencies');
  }

  let mode = 'select';
  let pointerState = null;
  let spacePressed = false;
  let draftLane = [];
  let draftHover = null;
  let moveChanged = false;
  let dragSelection = [];
  let marqueeAdditive = false;
  let disposed = false;

  function controllerEvent(type, detail = {}) {
    commands.onControllerCommand?.({ type, ...detail });
  }

  function changeMode(nextMode) {
    mode = nextMode;
    onModeChange(nextMode);
  }

  function render() {
    requestRender({
      draftLane: structuredClone(
        draftHover ? [...draftLane, draftHover] : draftLane
      ),
      marquee: pointerState?.kind === 'marquee'
        ? {
            x1: pointerState.start.x,
            y1: pointerState.start.y,
            x2: pointerState.current.x,
            y2: pointerState.current.y
          }
        : null
    });
  }

  function screenPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const camera = getCamera();
    return {
      x: (event.clientX - rect.left) * camera.width / rect.width,
      y: (event.clientY - rect.top) * camera.height / rect.height
    };
  }

  function worldPoint(event) {
    return screenToWorld(screenPoint(event), getCamera());
  }

  function snappedWorldPoint(event) {
    const point = worldPoint(event);
    if (event.altKey) return point;
    return {
      x: snap(point.x, gridSize),
      z: snap(point.z, gridSize)
    };
  }

  function currentModel() {
    const snapshot = getSnapshot();
    return buildCanvasModel(
      snapshot.document,
      snapshot.validation ?? { errors: [], warnings: [] },
      snapshot.selection,
      draftLane
    );
  }

  function hitAt(event) {
    const camera = getCamera();
    return hitTestEditorPoint(
      worldPoint(event),
      currentModel(),
      8 / camera.zoom
    );
  }

  function updateSelectionForHit(hit, shiftKey) {
    const current = getSnapshot().selection;
    if (!shiftKey) {
      const next = [hit];
      store.setSelection(next);
      return next;
    }
    const existingIndex = current.findIndex((entry) => sameSelection(entry, hit));
    const next = structuredClone(current);
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    else next.push(hit);
    store.setSelection(next);
    return next;
  }

  function closeDraftLane() {
    const points = structuredClone(draftLane);
    store.commit('Add rotary lane', (source) => {
      if (typeof commands.closeLane === 'function') {
        return commands.closeLane(source, points);
      }
      let document = commands.addLane(source);
      const laneId = document.rotaryLanes.at(-1).id;
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const yaw = Math.atan2(next.x - point.x, next.z - point.z)
          * 180 / Math.PI;
        document = commands.addLaneSlot(document, laneId, {
          x: point.x,
          z: point.z,
          yaw
        });
      });
      return document;
    });
    controllerEvent('close-lane', { points });
    draftLane = [];
    draftHover = null;
    changeMode('select');
    render();
  }

  function handleLaneClick(event) {
    const screen = screenPoint(event);
    if (draftLane.length >= 3) {
      const firstScreen = worldToScreen(draftLane[0], getCamera());
      if (Math.hypot(screen.x - firstScreen.x, screen.y - firstScreen.y) <= 10) {
        closeDraftLane();
        return;
      }
    }
    const point = snappedWorldPoint(event);
    if (draftLane.length === 0) {
      draftLane = [point];
      controllerEvent('start-lane', { point });
    } else {
      draftLane = [...draftLane, point];
      controllerEvent('add-slot', { point });
    }
    draftHover = null;
    render();
  }

  function handlePointerDown(event) {
    if (disposed || event.button !== 0) return;
    canvas.focus?.();
    canvas.setPointerCapture?.(event.pointerId);
    const screen = screenPoint(event);

    if (spacePressed) {
      pointerState = {
        kind: 'pan',
        start: screen,
        camera: getCamera()
      };
      event.preventDefault();
      return;
    }

    if (mode === 'add-vehicle') {
      const point = snappedWorldPoint(event);
      store.commit('Add vehicle', (document) => commands.addVehicle(document, {
        x: point.x,
        z: point.z,
        yaw: 0
      }));
      controllerEvent('add-vehicle', { point });
      changeMode('select');
      render();
      return;
    }

    if (mode === 'lane') {
      handleLaneClick(event);
      return;
    }

    const hit = hitAt(event);
    if (isEditableHit(hit)) {
      const nextSelection = updateSelectionForHit(hit, event.shiftKey);
      if (nextSelection.some((entry) => sameSelection(entry, hit))) {
        dragSelection = structuredClone(nextSelection);
        moveChanged = false;
        store.beginPreview('Move selection');
        pointerState = { kind: 'move', startWorld: worldPoint(event) };
      }
      render();
      return;
    }

    marqueeAdditive = event.shiftKey;
    pointerState = { kind: 'marquee', start: screen, current: screen };
    render();
  }

  function handlePointerMove(event) {
    if (disposed) return;
    if (!pointerState) {
      if (mode === 'lane' && draftLane.length > 0) {
        draftHover = snappedWorldPoint(event);
        render();
      }
      return;
    }

    if (pointerState.kind === 'pan') {
      const screen = screenPoint(event);
      const { start, camera } = pointerState;
      setCamera({
        ...camera,
        centerX: camera.centerX - (screen.x - start.x) / camera.zoom,
        centerZ: camera.centerZ + (screen.y - start.y) / camera.zoom
      });
      render();
      return;
    }

    if (pointerState.kind === 'marquee') {
      pointerState = { ...pointerState, current: screenPoint(event) };
      render();
      return;
    }

    if (pointerState.kind === 'move') {
      const current = worldPoint(event);
      let deltaX = current.x - pointerState.startWorld.x;
      let deltaZ = current.z - pointerState.startWorld.z;
      if (!event.altKey) {
        deltaX = snap(deltaX, gridSize);
        deltaZ = snap(deltaZ, gridSize);
      }
      if (Math.abs(deltaX) < 1e-12 && Math.abs(deltaZ) < 1e-12) return;
      moveChanged = true;
      store.updatePreview((document) => commands.moveSelection(
        document,
        dragSelection,
        deltaX,
        deltaZ
      ));
      controllerEvent('move-selection', { deltaX, deltaZ });
      render();
    }
  }

  function finishMarquee() {
    const camera = getCamera();
    const startWorld = screenToWorld(pointerState.start, camera);
    const currentWorld = screenToWorld(pointerState.current, camera);
    const hits = hitTestMarquee({
      x1: startWorld.x,
      z1: startWorld.z,
      x2: currentWorld.x,
      z2: currentWorld.z
    }, currentModel());
    if (marqueeAdditive) {
      const next = structuredClone(getSnapshot().selection);
      for (const hit of hits) {
        if (!next.some((entry) => sameSelection(entry, hit))) next.push(hit);
      }
      store.setSelection(next);
    } else {
      store.setSelection(hits);
    }
  }

  function handlePointerUp(event) {
    if (disposed || !pointerState) return;
    if (pointerState.kind === 'move') {
      if (moveChanged) store.commitPreview();
      else store.cancelPreview();
      moveChanged = false;
      dragSelection = [];
    } else if (pointerState.kind === 'marquee') {
      finishMarquee();
    }
    pointerState = null;
    canvas.releasePointerCapture?.(event.pointerId);
    render();
  }

  function handlePointerCancel(event) {
    if (disposed) return;
    if (pointerState?.kind === 'move') store.cancelPreview();
    pointerState = null;
    moveChanged = false;
    dragSelection = [];
    canvas.releasePointerCapture?.(event.pointerId);
    render();
  }

  function handleWheel(event) {
    if (disposed) return;
    event.preventDefault();
    const screen = screenPoint(event);
    const camera = getCamera();
    const anchoredWorld = screenToWorld(screen, camera);
    const zoom = clamp(
      camera.zoom * Math.exp(-event.deltaY * 0.0015),
      30,
      500
    );
    setCamera({
      ...camera,
      zoom,
      centerX: anchoredWorld.x - (screen.x - camera.width / 2) / zoom,
      centerZ: anchoredWorld.z + (screen.y - camera.height / 2) / zoom
    });
    render();
  }

  function deleteSelection() {
    const selection = getSnapshot().selection;
    if (selection.length === 0) return;
    store.commit('Delete selection', (source) => selection.reduce(
      (document, selected) => {
        if (selected.type === 'vehicle') {
          return commands.deleteVehicle(document, selected.id);
        }
        if (selected.type === 'slot') {
          return commands.deleteLaneSlot(
            document,
            selected.laneId,
            selected.slotId ?? selected.id
          );
        }
        if (selected.type === 'lane') {
          return commands.deleteLane(document, selected.id);
        }
        return document;
      },
      source
    ));
    store.setSelection([]);
    controllerEvent('delete-selection', { selection });
  }

  function cancelCurrentGesture() {
    if (pointerState?.kind === 'move') store.cancelPreview();
    pointerState = null;
    moveChanged = false;
    dragSelection = [];
    if (draftLane.length > 0) {
      draftLane = [];
      draftHover = null;
      controllerEvent('cancel-lane');
    }
    render();
  }

  function handleKeyDown(event) {
    if (disposed || shouldIgnoreKeyboard(event)) return;
    if (event.code === 'Space') {
      spacePressed = true;
      event.preventDefault();
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.code === 'KeyZ') {
      if (event.shiftKey) store.redo();
      else store.undo();
      event.preventDefault();
      render();
      return;
    }
    if (modifier && event.code === 'KeyY') {
      store.redo();
      event.preventDefault();
      render();
      return;
    }
    if (event.code === 'Escape') {
      cancelCurrentGesture();
      event.preventDefault();
      return;
    }
    if (event.code === 'Delete' || event.code === 'Backspace') {
      deleteSelection();
      event.preventDefault();
      render();
      return;
    }
    if (event.code === 'KeyQ' || event.code === 'KeyE') {
      const selection = getSnapshot().selection;
      if (selection.length === 0) return;
      const deltaYaw = event.code === 'KeyQ' ? -angleStep : angleStep;
      store.commit('Rotate selection', (document) => commands.rotateSelection(
        document,
        selection,
        deltaYaw
      ));
      controllerEvent('rotate-selection', { deltaYaw });
      event.preventDefault();
      render();
    }
  }

  function handleKeyUp(event) {
    if (event.code === 'Space') spacePressed = false;
  }

  const listeners = [
    [canvas, 'pointerdown', handlePointerDown],
    [canvas, 'pointermove', handlePointerMove],
    [canvas, 'pointerup', handlePointerUp],
    [canvas, 'pointercancel', handlePointerCancel],
    [canvas, 'wheel', handleWheel],
    [keyboardTarget, 'keydown', handleKeyDown],
    [keyboardTarget, 'keyup', handleKeyUp]
  ];
  for (const [target, type, listener] of listeners) {
    target.addEventListener(type, listener, type === 'wheel' ? { passive: false } : undefined);
  }

  function setMode(nextMode) {
    if (!['select', 'add-vehicle', 'lane'].includes(nextMode)) {
      throw new Error(`Unknown editor mode ${nextMode}`);
    }
    if (nextMode !== 'lane' && draftLane.length > 0) {
      draftLane = [];
      draftHover = null;
    }
    changeMode(nextMode);
    render();
  }

  function getMode() {
    return mode;
  }

  function getDraftLane() {
    return structuredClone(draftLane);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pointerState?.kind === 'move') store.cancelPreview();
    pointerState = null;
    for (const [target, type, listener] of listeners) {
      target.removeEventListener(type, listener);
    }
  }

  return { setMode, getMode, getDraftLane, dispose };
}
