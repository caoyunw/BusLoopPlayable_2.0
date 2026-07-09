import './styles.css';
import { BusLoopGame } from './game-model.js';
import { LEVEL_1 } from './level-data.js';
import { SceneView } from './scene-view.js';
import { SCENE_TUNING } from './scene-tuning.js';
import { createGameAudioController } from './audio-controller.js';

const TUNING_STORAGE_KEY = 'bus-loop-scene-tuning-v3';
const LEGACY_TUNING_STORAGE_KEY = 'bus-loop-scene-tuning-v2';
const STORE_URL = {
  android: {
    web: 'https://play.google.com/store/apps/details?id=gridplus.busjam.carpuzzle',
    mraid: ['https://play.google.com/store/apps/details?id=gridplus.busjam.carpuzzle']
  },
  ios: {
    web: 'https://apps.apple.com/app/id6746743297',
    mraid: [
      'itms-apps://itunes.apple.com/app/id6746743297',
      'https://apps.apple.com/app/id6746743297'
    ]
  }
};
const STORE_OPEN_COOLDOWN_MS = 800;
const MAX_NUMBER_COUNT_BUS = 10;
const EDITOR_ENABLED = import.meta.env.DEV;
const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const stage = $('#stage');
const canvas = $('#game-canvas');
const loadingScreen = $('#loading-screen');
const loadingProgress = loadingScreen?.querySelector('.loading-progress');
const loadingProgressBar = $('#loading-progress-bar');
const loadingProgressValue = $('#loading-progress-value');
const ctaButton = $('#cta-button');
const sceneEditorRoot = EDITOR_ENABLED ? $('#scene-editor') : null;
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

function waitForMraidReady(onReady) {
  const mraid = window.mraid;
  if (!mraid?.getState || !mraid?.addEventListener) {
    onReady();
    return;
  }

  let started = false;
  const startOnce = () => {
    if (started) return;
    started = true;
    mraid.removeEventListener?.('ready', startOnce);
    onReady();
  };

  let state = 'default';
  try {
    state = mraid.getState();
  } catch (error) {
    console.warn('MRAID state could not be read; starting playable.', error);
    startOnce();
    return;
  }

  if (state === 'loading') {
    mraid.addEventListener('ready', startOnce);
    return;
  }

  if (state === 'default') {
    startOnce();
    return;
  }

  startOnce();
}

function applyPreviewFrame() {
  const preview = SCENE_TUNING.preview;
  app?.classList.toggle('is-phone-preview', EDITOR_ENABLED && Boolean(preview?.enabled));
  if (app) {
    app.style.setProperty('--preview-width', String(preview?.width ?? 1080));
    app.style.setProperty('--preview-height', String(preview?.height ?? 2160));
  }
}

function loadSavedTuning() {
  if (!EDITOR_ENABLED) return;
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
  if (!EDITOR_ENABLED) return;
  try {
    localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Scene tuning could not be saved.', error);
  }
}

function formatHexColor(value, fallback = 0xffffff) {
  const hex = Math.max(0, Math.min(0xffffff, Math.round(Number.isFinite(value) ? value : fallback)));
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function getStagePositionScale(stageWidth, designWidth) {
  return Math.max(0.01, Math.min(1, stageWidth / designWidth));
}

function cssPx(value) {
  return `${Math.max(0, value)}px`;
}

let audio = null;
let lastStoreOpenAt = 0;
let storeOpenAttempts = 0;

function applyCtaTuning(view = null) {
  if (!ctaButton) return;
  const cta = SCENE_TUNING.cta ?? {};
  const designWidth = Math.max(1, Number(SCENE_TUNING.preview?.width) || 1080);
  const designHeight = Math.max(1, Number(SCENE_TUNING.preview?.height) || 2160);
  const stageRect = stage?.getBoundingClientRect();
  const stageWidth = stageRect?.width || designWidth;
  const stageHeight = stageRect?.height || designHeight;
  const height = Math.max(1, Number(cta.height) || 68);
  const width = Math.max(1, height * (Number(cta.stretchX) || 2.75));
  const fontSize = Math.max(1, Number(cta.fontSize) || 28);
  const fontHeight = Math.max(1, Number(cta.fontHeight) || fontSize);
  const centerX = Number.isFinite(Number(cta.x)) ? Number(cta.x) : designWidth / 2;
  const centerY = Number.isFinite(Number(cta.y))
    ? Number(cta.y)
    : designHeight - Math.max(0, Number(cta.bottom) || 0) - height / 2;
  const pulseSpeed = Math.max(0.01, Number(cta.pulseSpeed) || 0.55);
  const positionScale = getStagePositionScale(stageWidth, designWidth);
  const worldX = Number(cta.worldX);
  const worldY = Number(cta.worldY);
  const worldZ = Number(cta.worldZ);
  const worldPosition = view && Number.isFinite(worldX) && Number.isFinite(worldZ)
    ? view.projectWorldToCanvas?.({
      x: worldX,
      y: Number.isFinite(worldY) ? worldY : 0,
      z: worldZ
    })
    : null;
  ctaButton.hidden = !Boolean(cta.enabled ?? 1);
  ctaButton.style.setProperty('--cta-width', cssPx(width));
  ctaButton.style.setProperty('--cta-height', cssPx(height));
  ctaButton.style.setProperty('--cta-padding-x', cssPx(24));
  ctaButton.style.setProperty('--cta-font-size', cssPx(fontSize));
  ctaButton.style.setProperty('--cta-font-height', cssPx(fontHeight));
  ctaButton.style.setProperty('--cta-stroke-color', formatHexColor(cta.strokeColor, 0x196b07));
  ctaButton.style.setProperty('--cta-stroke-width', cssPx(Math.max(0, Number(cta.strokeWidth) || 0)));
  ctaButton.style.setProperty('--cta-pulse-scale', String(Math.max(1, Number(cta.pulseScale) || 1.08)));
  ctaButton.style.setProperty('--cta-pulse-duration', `${1 / pulseSpeed}s`);
  ctaButton.style.left = `${worldPosition?.x ?? stageWidth / 2 + (centerX - designWidth / 2) * positionScale}px`;
  ctaButton.style.top = `${worldPosition?.y ?? stageHeight / 2 + (centerY - designHeight / 2) * positionScale}px`;
}

function isIOSDevice() {
  const userAgent = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(userAgent) ||
    ((navigator.platform === 'MacIntel' || /Macintosh/i.test(userAgent)) && navigator.maxTouchPoints > 1);
}

function getStoreTarget() {
  return isIOSDevice() ? STORE_URL.ios : STORE_URL.android;
}

function getMraidStoreUrl(target) {
  const urls = target.mraid ?? [target.web];
  return urls[Math.min(storeOpenAttempts, urls.length - 1)] ?? target.web;
}

function openStore() {
  const now = Date.now();
  if (now - lastStoreOpenAt < STORE_OPEN_COOLDOWN_MS) return;
  lastStoreOpenAt = now;
  const target = getStoreTarget();
  if (window.mraid?.open) {
    const url = getMraidStoreUrl(target);
    storeOpenAttempts += 1;
    try {
      window.mraid.open(url);
      return;
    } catch (error) {
      console.warn('MRAID store open failed; falling back to window.open.', error);
    }
  }
  try {
    window.open(target.web, '_blank', 'noopener');
  } catch (error) {
    lastStoreOpenAt = 0;
    console.warn('Store URL could not be opened.', error);
  }
}

function InstallFullGame() {
  audio?.unlock();
  openStore();
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
  if (!EDITOR_ENABLED) return;
  pendingTuningSave = null;
  clearTimeout(tuningSaveTimer);
  tuningSaveTimer = 0;
  localStorage.removeItem(TUNING_STORAGE_KEY);
}

function startRuntime() {
  loadSavedTuning();
  applyPreviewFrame();

  const game = new BusLoopGame();
  audio = createGameAudioController(LEVEL_1.assets.audio);
  const endPanel = $('#end-panel');
  let pressTimer = 0;
  let pressed = false;
  let numberCountBus = 0;
  let isFinish = false;
  const countedInstallVehicles = new Set();
  const INSTALL_GATE_VEHICLE_STATES = new Set(['at-spot', 'boarding-final', 'departing', 'done']);

  function updateLoadingProgress(progress) {
    const percent = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
    if (loadingProgressBar) loadingProgressBar.style.width = `${percent}%`;
    if (loadingProgressValue) loadingProgressValue.textContent = `${percent}%`;
    loadingProgress?.setAttribute('aria-valuenow', String(percent));
  }

  updateLoadingProgress(0);
  const markInstallVehicle = (vehicleId) => {
    if (countedInstallVehicles.has(vehicleId)) return false;
    countedInstallVehicles.add(vehicleId);
    numberCountBus += 1;
    if (numberCountBus >= MAX_NUMBER_COUNT_BUS) isFinish = true;
    return isFinish;
  };

  const handleVehicleClick = (vehicleId) => {
    const result = game.clickVehicle(vehicleId);
    if (result?.ok && markInstallVehicle(vehicleId)) {
      InstallFullGame();
    }
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
  const updateCtaPosition = () => {
    view.resize();
    applyCtaTuning(view);
  };
  updateCtaPosition();
  if ('ResizeObserver' in window && stage) {
    new ResizeObserver(updateCtaPosition).observe(stage);
  } else {
    window.addEventListener('resize', updateCtaPosition);
  }
  view.ready?.finally(() => {
    updateLoadingProgress(1);
    loadingScreen?.classList.add('is-hidden');
    window.setTimeout(() => loadingScreen?.remove(), 360);
  });
  game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
  let editor = { sync: () => {} };

  function applyTuningPatch(next, { path, syncEditor = false } = {}) {
    const materialOnly = isPassengerMaterialTuningPath(path);
    const colorIndex = getPassengerMaterialColorIndex(path);
    const tuning = view.setTuning(next, { mode: materialOnly ? 'passengerMaterial' : 'full', colorIndex });
    if (!materialOnly) {
      game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
      applyPreviewFrame();
      updateCtaPosition();
    }
    saveTuning(tuning);
    if (syncEditor) editor.sync();
    return tuning;
  }

  if (EDITOR_ENABLED && sceneEditorRoot) {
    import('./scene-editor.js').then(({ createSceneEditor }) => {
      editor = createSceneEditor(sceneEditorRoot, {
        getTuning: () => SCENE_TUNING,
        setTuning: applyTuningPatch,
        clearSavedTuning
      });
    }).catch((error) => {
      console.warn('Scene editor could not be loaded.', error);
    });
  } else {
    sceneEditorRoot?.remove();
  }

  function syncHud(state) {
    audio.handleGameEvent(state.lastEvent, state.time);
    updateInstallGate(state);
    if (state.status !== 'playing') {
      endPanel.hidden = false;
      const won = state.status === 'won';
      $('#end-kicker').textContent = won ? 'LEVEL COMPLETE' : 'NO MORE MOVES';
      $('#end-title').textContent = won ? 'All buses departed' : 'Parking spots are blocked';
    }
  }

  function updateInstallGate(state) {
    for (const vehicle of state.vehicles ?? []) {
      if (
        vehicle.spotIndex == null ||
        !INSTALL_GATE_VEHICLE_STATES.has(vehicle.state) ||
        countedInstallVehicles.has(vehicle.id)
      ) {
        continue;
      }
      markInstallVehicle(vehicle.id);
    }
  }

  game.subscribe(syncHud);
  function reset() {
    endPanel.hidden = true;
    numberCountBus = 0;
    isFinish = false;
    countedInstallVehicles.clear();
    game.reset();
    game.initializeQueues(view.getQueueCapacities(), view.getQueueSpacing(), view.getQueueLengths(), view.getConveyorPathLength());
  }
  $('#reset-button')?.addEventListener('click', reset);
  $('#end-reset-button').addEventListener('click', reset);
  ctaButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    InstallFullGame();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (isFinish) {
      event.stopImmediatePropagation();
      InstallFullGame();
      return;
    }
  }, { capture: true });
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
  window.addEventListener('beforeunload', flushTuningSave);

  let previous = performance.now();
  function frame(now) {
    const delta = (now - previous) / 1000;
    previous = now;
    game.update(delta);
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
    InstallFullGame,
    openStore,
    installState: () => ({ numberCountBus, maxNumberCountBus: MAX_NUMBER_COUNT_BUS, isFinish }),
    step: (seconds, increment = .05) => {
      for (let time = 0; time < seconds; time += increment) game.update(increment);
      return game.snapshot();
    },
    reset
  };
}

waitForMraidReady(startRuntime);


