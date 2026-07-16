import { canonicalStringify } from '../rotary-level-contract/document.js';
import { computeContextFingerprint } from '../rotary-level-contract/fingerprint.js';
import { validateLevelDocument } from '../rotary-level-contract/validate.js';
import {
  buildCanvasModel,
  computeDocumentBounds,
  drawEditorCanvas,
  getVehiclePose,
  resizeCanvas
} from './canvas-view.js';
import { createCanvasController } from './canvas-controller.js';
import * as documentCommands from './document-commands.js';
import { createEditorStore } from './editor-store.js';
import {
  createCanonicalDownload,
  createRecoveryDownload,
  importDocument,
  triggerDownload
} from './file-io.js';
import {
  buildObjectTreeModel,
  buildPropertyModel,
  buildValidationRows,
  renderObjectTree,
  renderPropertyPanel,
  renderValidationPanel
} from './panels.js';
import {
  createDraftEnvelope,
  createDraftScheduler,
  isRecoverableDraft,
  loadDraft,
  removeDraft,
  saveDraft
} from './persistence.js';

function requiredNode(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`Rotary editor is missing ${selector}`);
  return node;
}

async function hashDocument(document, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('Web Crypto subtle API is unavailable');
  const bytes = new TextEncoder().encode(canonicalStringify(document));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

function createInitialCamera(document, width, height) {
  const bounds = computeDocumentBounds(document);
  const contentWidth = Math.max(0.01, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(0.01, bounds.maxZ - bounds.minZ);
  return {
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    zoom: Math.max(30, Math.min(
      160,
      (width - 48) / contentWidth,
      (height - 48) / contentHeight
    )),
    width,
    height
  };
}

function contextTargetPose(document, target) {
  if (target.kind === 'garage') {
    return document.context.garages.find(({ id }) => id === target.id);
  }
  const collectionByKind = {
    'parking-spot': 'parkingSpots',
    conveyor: 'conveyors',
    'passenger-queue': 'passengerQueues',
    'protected-geometry': 'protectedGeometry'
  };
  return document.context[collectionByKind[target.kind]]
    ?.find(({ id }) => id === target.id);
}

function focusPose(document, target) {
  if (!target) return null;
  if (target.type === 'vehicle') {
    const vehicle = document.vehicles.find(({ id }) => id === target.id);
    return vehicle ? getVehiclePose(vehicle, document) : null;
  }
  if (target.type === 'slot') {
    return document.rotaryLanes
      .find(({ id }) => !target.laneId || id === target.laneId)
      ?.slots.find(({ id }) => id === target.id) ?? null;
  }
  if (target.type === 'lane') {
    const lane = document.rotaryLanes.find(({ id }) => id === target.id);
    if (!lane?.slots.length) return null;
    return {
      x: lane.slots.reduce((sum, slot) => sum + slot.x, 0) / lane.slots.length,
      z: lane.slots.reduce((sum, slot) => sum + slot.z, 0) / lane.slots.length
    };
  }
  if (target.type === 'context') return contextTargetPose(document, target);
  return null;
}

function applyPropertyChange(source, field, rawValue) {
  const value = ['id', 'colorIndex', 'seats', 'x', 'z', 'yaw', 'stockOrder']
    .includes(field.key)
    ? Number(rawValue)
    : rawValue;
  const target = field.target;
  if (target.type === 'vehicle' && field.key === 'placement') {
    const vehicle = source.vehicles.find(({ id }) => id === target.id);
    if (!vehicle) throw new Error(`Unknown vehicle ${target.id}`);
    const pose = getVehiclePose(vehicle, source);
    const [kind, firstId, secondId] = String(rawValue).split('|');
    if (kind === 'field') {
      return documentCommands.assignVehicle(source, target.id, {
        kind: 'field',
        x: pose.x,
        z: pose.z,
        yaw: pose.yaw
      });
    }
    if (kind === 'garage') {
      const garage = source.context.garages.find(({ id }) => (
        String(id) === firstId
      ));
      if (!garage) throw new Error(`Unknown garage ${firstId}`);
      const stockOrder = source.vehicles.filter((candidate) => (
        candidate.id !== target.id
        && candidate.placement.kind === 'garage'
        && candidate.placement.garageId === garage.id
      )).length;
      return documentCommands.assignVehicle(source, target.id, {
        kind: 'garage',
        garageId: garage.id,
        stockOrder,
        storedPose: { x: pose.x, z: pose.z, yaw: pose.yaw }
      });
    }
    if (kind === 'rotary-slot') {
      const lane = source.rotaryLanes.find(({ id }) => String(id) === firstId);
      const slot = lane?.slots.find(({ id }) => String(id) === secondId);
      if (!lane || !slot) {
        throw new Error(`Unknown rotary slot ${firstId}/${secondId}`);
      }
      return documentCommands.assignVehicle(source, target.id, {
        kind: 'rotary-slot',
        laneId: lane.id,
        slotId: slot.id
      });
    }
    throw new Error(`Unknown vehicle placement ${rawValue}`);
  }
  if (target.type === 'vehicle'
    && ['id', 'colorIndex', 'seats'].includes(field.key)) {
    return documentCommands.updateVehicle(source, target.id, {
      [field.key]: value
    });
  }
  const document = structuredClone(source);
  if (target.type === 'vehicle') {
    const vehicle = document.vehicles.find(({ id }) => id === target.id);
    if (!vehicle) throw new Error(`Unknown vehicle ${target.id}`);
    if (vehicle.placement.kind === 'field'
      && ['x', 'z', 'yaw'].includes(field.key)) {
      vehicle.placement[field.key] = value;
    } else if (vehicle.placement.kind === 'garage'
      && field.key === 'stockOrder') {
      return documentCommands.assignVehicle(document, vehicle.id, {
        ...vehicle.placement,
        stockOrder: value
      });
    }
  } else if (target.type === 'vehicle-stored-pose') {
    const vehicle = document.vehicles.find(({ id }) => id === target.id);
    if (!vehicle || vehicle.placement.kind !== 'garage') {
      throw new Error(`Unknown garage vehicle ${target.id}`);
    }
    vehicle.placement.storedPose[field.key] = value;
  } else if (target.type === 'slot') {
    const lane = document.rotaryLanes.find(({ id }) => id === target.laneId);
    const slot = lane?.slots.find(({ id }) => id === target.id);
    if (!slot) throw new Error(`Unknown slot ${target.laneId}/${target.id}`);
    if (field.key === 'id') {
      const previousId = slot.id;
      slot.id = value;
      document.vehicles.forEach((vehicle) => {
        if (vehicle.placement.kind === 'rotary-slot'
          && vehicle.placement.laneId === target.laneId
          && vehicle.placement.slotId === previousId) {
          vehicle.placement.slotId = value;
        }
      });
    } else {
      slot[field.key] = value;
    }
  } else if (target.type === 'lane' && field.key === 'id') {
    const lane = document.rotaryLanes.find(({ id }) => id === target.id);
    if (!lane) throw new Error(`Unknown lane ${target.id}`);
    lane.id = value;
    document.vehicles.forEach((vehicle) => {
      if (vehicle.placement.kind === 'rotary-slot'
        && vehicle.placement.laneId === target.id) {
        vehicle.placement.laneId = value;
      }
    });
  }
  return document;
}

export async function createEditorApplication({
  root = globalThis.document,
  storage = globalThis.localStorage,
  loadTemplate,
  download = triggerDownload,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis)
    ?? ((callback) => setTimeout(callback, 16)),
  now = Date.now,
  windowRef = root?.defaultView ?? globalThis.window,
  subtle = globalThis.crypto?.subtle
}) {
  if (typeof loadTemplate !== 'function') {
    throw new Error('createEditorApplication requires loadTemplate');
  }
  if (!root || !storage || !windowRef) {
    throw new Error('Editor browser dependencies are unavailable');
  }

  const nodes = {
    toolbar: requiredNode(root, '#toolbar'),
    tree: requiredNode(root, '#object-tree-content'),
    canvas: requiredNode(root, '#editor-canvas'),
    properties: requiredNode(root, '#property-panel-content'),
    validationRows: requiredNode(root, '#validation-rows'),
    validationSummary: requiredNode(root, '#validation-summary'),
    importInput: requiredNode(root, '#import-input'),
    saveAsDialog: requiredNode(root, '#save-as-dialog'),
    saveAsInput: requiredNode(root, '#save-as-document-id'),
    recoveryDialog: requiredNode(root, '#recovery-dialog'),
    documentName: requiredNode(root, '#document-name'),
    draftStatus: requiredNode(root, '#draft-status'),
    canvasStatus: requiredNode(root, '#canvas-status'),
    toastRegion: requiredNode(root, '#toast-region')
  };
  const actions = new Map(
    [...root.querySelectorAll('[data-action]')]
      .map((node) => [node.dataset.action, node])
  );

  const template = await loadTemplate();
  const templateValidation = validateLevelDocument(template);
  if (templateValidation.errors.length > 0) {
    throw new Error(
      `Template has ${templateValidation.errors.length} blocking validation errors`
    );
  }
  const templateFingerprint = await computeContextFingerprint(template, subtle);
  if (templateFingerprint !== template.target.contextFingerprint) {
    throw new Error('Template context fingerprint mismatch');
  }

  const newDocument = documentCommands.createNewFromTemplate(
    template,
    'untitled-level18'
  );
  let baselineHash = await hashDocument(newDocument, subtle);
  let pendingRecovery = null;
  const loadedDraft = loadDraft(storage, newDocument.documentId);
  if (loadedDraft.ok && loadedDraft.envelope) {
    const draftHash = await hashDocument(loadedDraft.envelope.document, subtle);
    if (isRecoverableDraft(loadedDraft.envelope, draftHash)) {
      pendingRecovery = loadedDraft.envelope;
    }
  }

  const store = createEditorStore(newDocument);
  let validation = validateLevelDocument(newDocument);
  let draftState = loadedDraft.ok
    ? { ok: true, message: '草稿已保存' }
    : { ok: false, message: `自动草稿不可用：${loadedDraft.error}` };
  let latestEnvelope = createDraftEnvelope(
    store.snapshot(),
    baselineHash,
    now()
  );
  const canvasRect = nodes.canvas.getBoundingClientRect();
  let camera = createInitialCamera(
    newDocument,
    Math.max(1, canvasRect.width),
    Math.max(1, canvasRect.height)
  );
  let canvasContext = resizeCanvas(
    nodes.canvas,
    camera.width,
    camera.height,
    windowRef.devicePixelRatio ?? 1
  );
  let frameId = null;
  let controller = null;
  let disposed = false;
  const cleanup = [];

  function toast(message, severity = 'info') {
    const element = root.createElement('div');
    element.className = 'toast';
    element.classList.toggle('is-error', severity === 'error');
    element.textContent = message;
    nodes.toastRegion.replaceChildren(element);
  }

  function applicationSnapshot() {
    const snapshot = store.snapshot();
    return {
      ...snapshot,
      validation: structuredClone(validation),
      camera: { ...camera },
      mode: controller?.getMode() ?? 'select',
      draftStatus: { ...draftState },
      exportDisabled: validation.errors.length > 0
    };
  }

  function drawFrame() {
    frameId = null;
    if (disposed) return;
    const snapshot = store.snapshot();
    const model = buildCanvasModel(
      snapshot.document,
      validation,
      snapshot.selection,
      controller?.getDraftLane() ?? []
    );
    drawEditorCanvas(canvasContext, model, camera, { gridStep: 0.05 });
  }

  function queueFrame() {
    if (frameId !== null || disposed) return;
    frameId = requestFrame(drawFrame);
  }

  function setCamera(next) {
    camera = { ...next };
    queueFrame();
  }

  function frameTarget(target) {
    const pose = focusPose(store.snapshot().document, target);
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return;
    camera = { ...camera, centerX: pose.x, centerZ: pose.z };
    queueFrame();
  }

  function selectAndFrame(target) {
    if (!target) return;
    store.setSelection([target]);
    frameTarget(target);
  }

  function updateToolbar(snapshot) {
    nodes.documentName.textContent = snapshot.document.documentId;
    nodes.draftStatus.textContent = draftState.message;
    nodes.draftStatus.classList.toggle('is-error', !draftState.ok);
    const exportDisabled = validation.errors.length > 0;
    for (const action of ['export', 'save-as']) {
      const button = actions.get(action);
      if (!button) continue;
      button.disabled = exportDisabled;
      button.classList.toggle('export-disabled', exportDisabled);
    }
    if (actions.get('undo')) actions.get('undo').disabled = !store.canUndo();
    if (actions.get('redo')) actions.get('redo').disabled = !store.canRedo();
    for (const [action, targetMode] of [
      ['select', 'select'],
      ['add-vehicle', 'add-vehicle'],
      ['add-lane', 'lane']
    ]) {
      actions.get(action)?.setAttribute(
        'aria-pressed',
        String(controller?.getMode() === targetMode)
      );
    }
    const errors = validation.errors.length;
    const warnings = validation.warnings.length;
    nodes.validationSummary.classList.toggle('is-error', errors > 0);
    nodes.validationSummary.classList.toggle(
      'is-warning',
      errors === 0 && warnings > 0
    );
    nodes.validationSummary.textContent = errors > 0
      ? `${errors} 个错误 · ${warnings} 个警告`
      : warnings > 0
        ? `无错误 · ${warnings} 个警告`
        : '校验通过';
  }

  function commitProperty(field, value) {
    try {
      store.commit(`Edit ${field.key}`, (document) => (
        applyPropertyChange(document, field, value)
      ));
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function commitPropertyAction(action) {
    const selection = store.snapshot().selection;
    if (selection.length !== 1 || selection[0].type !== 'vehicle') return;
    const vehicleId = selection[0].id;
    if (action.id === 'duplicate') {
      const previousIds = new Set(
        store.snapshot().document.vehicles.map(({ id }) => id)
      );
      let duplicateId = null;
      store.commit('Duplicate vehicle', (document) => {
        const updated = documentCommands.duplicateVehicle(document, vehicleId);
        duplicateId = updated.vehicles.find(({ id }) => !previousIds.has(id))?.id;
        return updated;
      });
      if (duplicateId !== null) {
        store.setSelection([{ type: 'vehicle', id: duplicateId }]);
      }
      return;
    }
    if (action.id === 'delete') {
      store.commit('Delete vehicle', (document) => (
        documentCommands.deleteVehicle(document, vehicleId)
      ));
      store.setSelection([]);
    }
  }

  function renderPanels(snapshot) {
    renderObjectTree(
      nodes.tree,
      buildObjectTreeModel(snapshot.document, snapshot.selection, validation),
      { onSelect: selectAndFrame }
    );
    renderPropertyPanel(
      nodes.properties,
      buildPropertyModel(snapshot.document, snapshot.selection),
      { onCommit: commitProperty, onAction: commitPropertyAction }
    );
    renderValidationPanel(
      nodes.validationRows,
      buildValidationRows(validation),
      { onFocus: selectAndFrame }
    );
  }

  function persistEnvelope(envelope) {
    const saved = saveDraft(storage, envelope);
    draftState = saved.ok
      ? { ok: true, message: '草稿已保存' }
      : { ok: false, message: `自动草稿不可用：${saved.error}` };
    nodes.draftStatus.textContent = draftState.message;
    nodes.draftStatus.classList.toggle('is-error', !draftState.ok);
    return saved;
  }

  const scheduler = createDraftScheduler(persistEnvelope, 250);

  function handleStoreChange(snapshot) {
    validation = validateLevelDocument(snapshot.document);
    latestEnvelope = createDraftEnvelope(snapshot, baselineHash, now());
    scheduler.schedule(latestEnvelope);
    renderPanels(snapshot);
    updateToolbar(snapshot);
    queueFrame();
  }

  controller = createCanvasController({
    canvas: nodes.canvas,
    keyboardTarget: windowRef,
    getSnapshot: applicationSnapshot,
    getCamera: () => ({ ...camera }),
    setCamera,
    store,
    commands: documentCommands,
    requestRender: queueFrame,
    onModeChange: () => updateToolbar(store.snapshot()),
    gridSize: 0.05,
    angleStep: 15
  });

  const unsubscribe = store.subscribe(handleStoreChange);
  handleStoreChange(store.snapshot());

  function listen(target, type, handler, listenerOptions) {
    if (!target) return;
    target.addEventListener(type, handler, listenerOptions);
    cleanup.push(() => target.removeEventListener(type, handler, listenerOptions));
  }

  async function refreshBaseline() {
    baselineHash = await hashDocument(store.snapshot().document, subtle);
    latestEnvelope = createDraftEnvelope(store.snapshot(), baselineHash, now());
    scheduler.schedule(latestEnvelope);
  }

  async function newLevel() {
    const next = documentCommands.createNewFromTemplate(
      template,
      'untitled-level18'
    );
    baselineHash = await hashDocument(next, subtle);
    store.replaceDocument(next);
    controller.setMode('select');
  }

  async function exportCurrent() {
    if (validation.errors.length > 0) return;
    const descriptor = createCanonicalDownload(store.snapshot().document);
    download(descriptor);
    await refreshBaseline();
  }

  async function saveAs() {
    const documentId = nodes.saveAsInput.value.trim();
    if (!documentId || validation.errors.length > 0) return;
    store.commit('Rename document', (source) => ({
      ...structuredClone(source),
      documentId
    }));
    const descriptor = createCanonicalDownload(store.snapshot().document);
    download(descriptor);
    await refreshBaseline();
    nodes.saveAsDialog.close?.();
  }

  async function importSelectedFile() {
    const file = nodes.importInput.files?.[0];
    if (!file) return;
    const current = store.snapshot().document;
    const result = await importDocument(file, current, { subtle });
    nodes.importInput.value = '';
    if (!result.ok) {
      toast(result.errors[0]?.message ?? '导入失败', 'error');
      return;
    }
    baselineHash = await hashDocument(result.document, subtle);
    store.replaceDocument(result.document);
    controller.setMode('select');
    toast('关卡已导入');
  }

  const actionHandlers = {
    new: newLevel,
    import: () => nodes.importInput.click(),
    export: exportCurrent,
    'save-as': () => {
      nodes.saveAsInput.value = store.snapshot().document.documentId;
      nodes.saveAsDialog.showModal?.();
    },
    undo: () => store.undo(),
    redo: () => store.redo(),
    select: () => controller.setMode('select'),
    'add-vehicle': () => controller.setMode('add-vehicle'),
    'add-lane': () => controller.setMode('lane'),
    'confirm-save-as': saveAs,
    'download-recovery': () => {
      const document = pendingRecovery?.document ?? store.snapshot().document;
      download(createRecoveryDownload(document));
    },
    'discard-recovery': () => {
      pendingRecovery = null;
      removeDraft(storage, newDocument.documentId);
      nodes.recoveryDialog.close?.();
    },
    'restore-recovery': () => {
      if (!pendingRecovery) return;
      baselineHash = pendingRecovery.baselineHash;
      store.replaceDocument(pendingRecovery.document);
      store.restoreHistory(
        pendingRecovery.history,
        pendingRecovery.historyCursor
      );
      pendingRecovery = null;
      nodes.recoveryDialog.close?.();
    }
  };
  for (const [action, handler] of Object.entries(actionHandlers)) {
    const node = actions.get(action);
    if (node) listen(node, 'click', handler);
  }
  listen(nodes.importInput, 'change', importSelectedFile);

  function resize() {
    const rect = nodes.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera = { ...camera, width, height };
    canvasContext = resizeCanvas(
      nodes.canvas,
      width,
      height,
      windowRef.devicePixelRatio ?? 1
    );
    queueFrame();
  }

  let resizeObserver = null;
  if (typeof windowRef.ResizeObserver === 'function') {
    resizeObserver = new windowRef.ResizeObserver(resize);
    resizeObserver.observe(nodes.canvas);
  } else {
    listen(windowRef, 'resize', resize);
  }
  listen(windowRef, 'pagehide', () => {
    if (latestEnvelope) scheduler.flush(latestEnvelope);
  });

  if (pendingRecovery) nodes.recoveryDialog.showModal?.();

  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    controller.dispose();
    scheduler.cancel();
    resizeObserver?.disconnect();
    cleanup.splice(0).forEach((remove) => remove());
    if (frameId !== null) {
      windowRef.cancelAnimationFrame?.(frameId);
      clearTimeout(frameId);
      frameId = null;
    }
  }

  return { snapshot: applicationSnapshot, dispose };
}
