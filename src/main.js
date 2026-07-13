import './styles.css';
import { BusLoopGame } from './game-model.js';
import { LEVEL_1 } from './level-data.js';
import { SceneView } from './scene-view.js';
import { SCENE_TUNING } from './scene-tuning.js';
import { createGameAudioController } from './audio-controller.js';
import { MECHANICS, getMechanicById, resolveMechanicId } from './mechanic-registry.js';
import { createMechanicLibrary } from './mechanic-library.js';
import { createMechanicDetailView } from './mechanics/index.js';
import { createMechanicUiControllers } from './mechanics/ui.js';
import {
  getMechanicIdFromSearch,
  safeRemoveStorageItem,
  syncMechanicQuery
} from './mechanic-lab.js';

const AUTHORED_SCENE_TUNING = structuredClone(SCENE_TUNING);
const TUNING_STORAGE_KEY = 'bus-loop-scene-tuning-v3';
const LEGACY_TUNING_STORAGE_KEY = 'bus-loop-scene-tuning-v2';
const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const stage = $('#stage');
const canvas = $('#game-canvas');
const loadingScreen = $('#loading-screen');
const loadingProgress = loadingScreen?.querySelector('.loading-progress');
const loadingProgressBar = $('#loading-progress-bar');
const loadingProgressValue = $('#loading-progress-value');
const sceneEditorRoot = $('#scene-editor');
const mechanicLibraryRoot = $('#mechanic-library');
const mechanicOverlay = $('#mechanic-overlay');
const mechanicOverlayTitle = $('#mechanic-overlay-title');
const mechanicOverlaySummary = $('#mechanic-overlay-summary');
const mechanicBackButton = $('#mechanic-back-button');
const PASSENGER_MATERIAL_TUNING_PREFIX = 'passengerMaterial.';
const PASSENGER_MATERIAL_COLOR_INDEX_PATTERN = /^passengerMaterial\.(?:solidColors|colors)\.(\d+)(?:\.|$)/;
const isPassengerMaterialTuningPath = (path) => path?.startsWith(PASSENGER_MATERIAL_TUNING_PREFIX);
const getPassengerMaterialColorIndex = (path) => {
  const match = path?.match(PASSENGER_MATERIAL_COLOR_INDEX_PATTERN);
  if (!match) return null;
  const colorIndex = Number(match[1]);
  return Number.isInteger(colorIndex) ? colorIndex : null;
};

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] ??= {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function applyPreviewFrame() {
  const preview = SCENE_TUNING.preview;
  app?.classList.toggle('is-phone-preview', Boolean(preview?.enabled));
  if (app) {
    app.style.setProperty('--preview-width', String(preview?.width ?? 1080));
    app.style.setProperty('--preview-height', String(preview?.height ?? 2160));
  }
}

function loadSavedTuning() {
  try {
    const saved = localStorage.getItem(TUNING_STORAGE_KEY);
    if (saved) {
      deepMerge(SCENE_TUNING, JSON.parse(saved));
      return;
    }
    const legacySaved = localStorage.getItem(LEGACY_TUNING_STORAGE_KEY);
    if (!legacySaved) return;
    const legacy = JSON.parse(legacySaved);
    const legacyModelScale = legacy.vehicleArea?.modelScale;
    delete legacy.vehicleArea;
    deepMerge(SCENE_TUNING, legacy);
    if (Number.isFinite(legacyModelScale)) {
      SCENE_TUNING.vehicleArea.modelScale = legacyModelScale;
    }
  } catch (error) {
    console.warn('Saved scene tuning could not be loaded.', error);
  }
}

let pendingTuningSave = null;
let tuningSaveTimer = 0;

function writeTuning(value) {
  try {
    localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Scene tuning could not be saved.', error);
  }
}

function flushTuningSave() {
  if (tuningSaveTimer) {
    clearTimeout(tuningSaveTimer);
    tuningSaveTimer = 0;
  }
  if (!pendingTuningSave) return;
  writeTuning(pendingTuningSave);
  pendingTuningSave = null;
}

function saveTuning(value, { immediate = false } = {}) {
  pendingTuningSave = value;
  if (immediate) {
    flushTuningSave();
    return;
  }
  clearTimeout(tuningSaveTimer);
  tuningSaveTimer = setTimeout(flushTuningSave, 150);
}

function clearSavedTuning() {
  pendingTuningSave = null;
  clearTimeout(tuningSaveTimer);
  tuningSaveTimer = 0;
  safeRemoveStorageItem(localStorage, TUNING_STORAGE_KEY, (error) => {
    console.warn('Saved scene tuning could not be cleared.', error);
  });
}

function startRuntime() {
  loadSavedTuning();
  applyPreviewFrame();

  const initialMechanicId = getMechanicIdFromSearch(location.search);
  const mechanicSessionOptions = {
    'question-passenger': { mode: 'chance', chance: 0.3 }
  };
  const game = new BusLoopGame(LEVEL_1, {
    mechanicId: initialMechanicId,
    mechanics: mechanicSessionOptions
  });
  const audio = createGameAudioController(LEVEL_1.assets.audio);
  const endPanel = $('#end-panel');
  let pressTimer = 0;
  let pressed = false;
  let editor = { sync: () => {}, setCollapsed: () => {} };
  let activeMechanic = getMechanicById(resolveMechanicId(initialMechanicId));
  let paused = activeMechanic.status !== 'playable';
  let mechanicLibrary = { setActive: () => {}, destroy: () => {} };
  const mechanicUiControllers = createMechanicUiControllers({ stage });

  function updateLoadingProgress(progress) {
    const percent = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
    if (loadingProgressBar) loadingProgressBar.style.width = `${percent}%`;
    if (loadingProgressValue) loadingProgressValue.textContent = `${percent}%`;
    loadingProgress?.setAttribute('aria-valuenow', String(percent));
  }

  updateLoadingProgress(0);

  const handleVehicleClick = (vehicleId) => {
    if (paused) return { ok: false, reason: 'mechanic-preview-paused' };
    const result = game.clickVehicle(vehicleId);
    return result;
  };

  const view = new SceneView(
    canvas,
    handleVehicleClick,
    {
      onPassengerAboard: () => audio.playPassengerUp(),
      onLoadingProgress: updateLoadingProgress
    }
  );

  view.ready?.finally(() => {
    updateLoadingProgress(1);
    loadingScreen?.classList.add('is-hidden');
    window.setTimeout(() => loadingScreen?.remove(), 360);
  });
  game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());

  function applyTuningPatch(next, { path, syncEditor = false } = {}) {
    const materialOnly = isPassengerMaterialTuningPath(path);
    const colorIndex = getPassengerMaterialColorIndex(path);
    const tuning = view.setTuning(next, { mode: materialOnly ? 'passengerMaterial' : 'full', colorIndex });
    if (!materialOnly) {
      game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
      applyPreviewFrame();
    }
    saveTuning(tuning);
    if (syncEditor) editor.sync();
    return tuning;
  }

  import('./scene-editor.js').then(({ createSceneEditor }) => {
    editor = createSceneEditor(sceneEditorRoot, {
      getTuning: () => SCENE_TUNING,
      getDefaults: () => AUTHORED_SCENE_TUNING,
      setTuning: applyTuningPatch,
      clearSavedTuning
    });
    editor.setCollapsed(true);
  }).catch((error) => {
    console.warn('Scene editor could not be loaded.', error);
  });

  function resetMechanicUi() {
    for (const controller of mechanicUiControllers) controller.reset?.();
  }

  function syncMechanicUi(state) {
    for (const controller of mechanicUiControllers) {
      controller.sync?.({ state, mechanic: activeMechanic });
    }
  }

  function syncHud(state) {
    audio.handleGameEvent(state.lastEvent, state.time);
    syncMechanicUi(state);
    if (paused || state.status === 'playing') {
      endPanel.hidden = true;
      return;
    }
    endPanel.hidden = false;
    const won = state.status === 'won';
    $('#end-kicker').textContent = won ? 'LEVEL COMPLETE' : 'NO MORE MOVES';
    $('#end-title').textContent = won ? 'All buses departed' : 'Parking spots are blocked';
  }

  game.subscribe(syncHud);

  function applyMechanicOptions(id, options = {}) {
    mechanicSessionOptions[id] = {
      ...(mechanicSessionOptions[id] ?? {}),
      ...options
    };
    resetMechanicUi();
    if (game.setMechanicOptions(id, mechanicSessionOptions[id])) {
      game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
    }
    syncHud(game.snapshot());
  }

  function renderDetailExtension({ mechanic, document }) {
    return createMechanicDetailView(mechanic.id, {
      document,
      options: mechanicSessionOptions[mechanic.id],
      state: game.snapshot(),
      onCommit: (options) => applyMechanicOptions(mechanic.id, options)
    });
  }

  function selectMechanic(id, { syncUrl = true } = {}) {
    const resolvedId = resolveMechanicId(id);
    activeMechanic = getMechanicById(resolvedId);
    paused = activeMechanic.status !== 'playable';
    const gameMechanicId = activeMechanic.status === 'playable' ? resolvedId : 'base';
    if (game.setMechanic(gameMechanicId)) {
      resetMechanicUi();
      game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
    }
    mechanicLibrary.setActive(resolvedId);
    mechanicOverlay.hidden = !paused;
    mechanicOverlayTitle.textContent = activeMechanic.name;
    mechanicOverlaySummary.textContent = activeMechanic.summary;
    canvas.inert = paused;
    stage?.classList.toggle('is-mechanic-paused', paused);
    if (paused) {
      syncMechanicUi(game.snapshot());
      endPanel.hidden = true;
    } else {
      syncHud(game.snapshot());
    }
    if (syncUrl) syncMechanicQuery(resolvedId);
    return activeMechanic;
  }

  mechanicLibrary = createMechanicLibrary(mechanicLibraryRoot, {
    mechanics: MECHANICS,
    activeId: initialMechanicId,
    onSelect: selectMechanic,
    renderDetailExtension
  });
  selectMechanic(initialMechanicId, { syncUrl: false });

  function reset() {
    endPanel.hidden = true;
    resetMechanicUi();
    game.reset();
    game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
  }

  $('#reset-button')?.addEventListener('click', reset);
  $('#end-reset-button').addEventListener('click', reset);
  mechanicBackButton?.addEventListener('click', () => selectMechanic('base'));
  canvas.addEventListener('pointerdown', () => {
    audio.unlock();
    pressed = true;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (pressed) game.setSpeedMultiplier(LEVEL_1.longPressMultiplier);
    }, LEVEL_1.longPressThreshold * 1000);
  });
  const release = () => {
    pressed = false;
    clearTimeout(pressTimer);
    game.setSpeedMultiplier(1);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);

  function handleBeforeUnload() {
    flushTuningSave();
    mechanicLibrary.destroy();
  }
  window.addEventListener('beforeunload', handleBeforeUnload);

  let previous = performance.now();
  function frame(now) {
    const delta = (now - previous) / 1000;
    previous = now;
    if (!paused) game.update(delta);
    view.update(game.snapshot(), game);
    view.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__busLoop = {
    game,
    view,
    tuning: SCENE_TUNING,
    setTuning: (patch, { path } = {}) => {
      return applyTuningPatch(patch, { path, syncEditor: true });
    },
    exportTuning: () => JSON.stringify(SCENE_TUNING, null, 2),
    saveTuning: () => saveTuning(SCENE_TUNING, { immediate: true }),
    clearSavedTuning,
    snapshot: () => game.snapshot(),
    clickVehicle: (id) => handleVehicleClick(Number(id)),
    step: (seconds, increment = .05) => {
      if (!paused) {
        for (let time = 0; time < seconds; time += increment) game.update(increment);
      }
      return game.snapshot();
    },
    reset,
    currentMechanic: () => activeMechanic,
    selectMechanic,
    isPaused: () => paused
  };
}

startRuntime();
