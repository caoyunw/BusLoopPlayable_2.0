import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVEL_1 } from '../src/level-data.js';
import { SceneView } from '../src/scene-view.js';
import { UNITY_EFFECTS, VehicleEffects } from '../src/vehicle-effects.js';

function makeLinkedBoardingView({ reducedMotion = false } = {}) {
  const view = Object.create(SceneView.prototype);
  const removed = [];
  const disposed = [];
  const pulses = [];
  const smoke = [];
  const aboard = [];
  const connectorRoot = new THREE.Group();
  const connectorMaterial = {
    opacity: 1,
    emissiveIntensity: 0.35,
    dispose: () => disposed.push('connector-material')
  };
  const badgeMaterial = {
    opacity: 1,
    dispose: () => disposed.push('badge-material')
  };
  const makeEntry = (x) => {
    const root = new THREE.Group();
    root.position.set(x, 0, 0);
    return {
      root,
      material: {
        transparent: false,
        opacity: 1,
        dispose: () => disposed.push(`passenger-${x}`)
      },
      vehicleId: 84,
      start: new THREE.Vector3(x, 0, 0),
      target: new THREE.Vector3(10, 0, 0),
      startedAt: 0,
      delay: 0,
      duration: 0.25,
      linkedBatchId: 17
    };
  };
  const entries = [makeEntry(1), makeEntry(2)];
  view.scene = { remove: (root) => removed.push(root) };
  view.boardingViews = entries;
  view.linkedBoardingBatches = new Map([[
    17,
    {
      remaining: entries.length,
      vehicleId: 84,
      connectorRoot,
      connectorSegments: [{ geometry: { dispose: () => disposed.push('connector-geometry') } }],
      connectorMaterials: [connectorMaterial],
      badgeMaterial,
      startedAt: 0,
      duration: 0.25
    }
  ]]);
  view.reducedMotionQuery = { matches: reducedMotion };
  view.triggerVehicleBoardingPulse = (vehicleId, time) => pulses.push([vehicleId, time]);
  view.vehicleEffects = { spawnAboardSmoke: (vehicleId) => smoke.push(vehicleId) };
  view.hooks = { onPassengerAboard: (vehicleId) => aboard.push(vehicleId) };
  return { view, entries, connectorRoot, removed, disposed, pulses, smoke, aboard };
}

test('Unity vehicle effect assets and prefab parameters stay explicit', () => {
  assert.deepEqual(LEVEL_1.assets.textures.effects, {
    aboardSmoke: '/assets/unity/effects/Round_01.png',
    ribbon: '/assets/unity/effects/Ribbon_01.png',
    ribbonSmoke: '/assets/runtime/effects/Smoke_08_q80.webp',
    hitCircle: '/assets/unity/effects/Circle_01.png',
    hitRound2: '/assets/runtime/effects/Round_02_q80.webp',
    hitRound1: '/assets/unity/effects/Round_01.png',
    smokeTrail: '/assets/unity/effects/Round_01.png'
  });
  assert.deepEqual(UNITY_EFFECTS.aboardSmoke.localPosition, [0, 0.05, -0.25]);
  assert.equal(UNITY_EFFECTS.aboardSmoke.burst, 20);
  assert.equal(UNITY_EFFECTS.ribbon.burst, 50);
  assert.deepEqual(UNITY_EFFECTS.ribbon.speedOverLifetime, [[0, 1], [0.38, 0.85], [1, 0.18]]);
  assert.equal(UNITY_EFFECTS.ribbon.moveRange, 2.15);
  assert.deepEqual(UNITY_EFFECTS.ribbonSmoke.burst, [6, 8]);
  assert.deepEqual(UNITY_EFFECTS.ribbonSmoke.speedOverLifetime, [[0, 1], [0.22, 0.55], [1, 0.08]]);
  assert.equal(UNITY_EFFECTS.ribbonSmoke.moveRange, 1.35);
  assert.equal(UNITY_EFFECTS.hit.emitters.length, 3);
  assert.deepEqual(UNITY_EFFECTS.hit.emitters.map((emitter) => emitter.name), ['ParticleHit_2', 'ParticleHit_1', 'ParticleHit']);
  assert.equal(UNITY_EFFECTS.hit.emitters[0].material, 'Circle_01_Add');
  assert.equal(UNITY_EFFECTS.hit.emitters[1].material, 'Round_02_Add');
  assert.equal(UNITY_EFFECTS.hit.emitters[2].material, 'Round_01_Add');
  assert.equal(UNITY_EFFECTS.hit.emitters[2].coneDegrees, 50);
  assert.equal(UNITY_EFFECTS.smokeTrail.material, 'Round_01_Alp');
  assert.equal(UNITY_EFFECTS.smokeTrail.rateOverTime, 25);
  assert.deepEqual(UNITY_EFFECTS.smokeTrail.lifetime, [0.2, 0.3]);
});
test('ribbon fires once when an occupied parking spot becomes empty', () => {
  const effects = new VehicleEffects({
    scene: new THREE.Group(),
    vehicleViews: new Map(),
    spotRoots: [],
    textures: {}
  });
  const calls = [];
  effects.spawnRibbon = (index) => calls.push(index);
  effects.update({ time: 0, spots: [{ vehicleId: 84 }, { vehicleId: null }] });
  effects.update({ time: 0.1, spots: [{ vehicleId: null }, { vehicleId: null }] });
  effects.update({ time: 0.2, spots: [{ vehicleId: null }, { vehicleId: null }] });
  assert.deepEqual(calls, [0]);
});

test('each passenger arrival creates the prefab smoke burst on the vehicle', () => {
  const vehicle = new THREE.Group();
  const effects = new VehicleEffects({
    scene: new THREE.Group(),
    vehicleViews: new Map([[84, vehicle]]),
    spotRoots: [],
    textures: { aboardSmoke: new THREE.Texture() }
  });
  effects.spawnAboardSmoke(84);
  assert.equal(effects.particles.length, 20);
  assert.equal(vehicle.children.length, 20);
  effects.clear();
  assert.equal(vehicle.children.length, 0);
});

test('linked boarding completion fires one aggregate pulse smoke and aboard hook', () => {
  const fixture = makeLinkedBoardingView();

  fixture.view.updateBoardingViews(0.25);
  fixture.view.updateBoardingViews(0.5);

  assert.deepEqual(fixture.pulses, [[84, 0.25]]);
  assert.deepEqual(fixture.smoke, [84]);
  assert.deepEqual(fixture.aboard, [84]);
  assert.equal(fixture.view.boardingViews.length, 0);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
  assert.ok(fixture.entries.every(({ root }) => fixture.removed.includes(root)));
  assert.ok(fixture.disposed.includes('passenger-1'));
  assert.ok(fixture.disposed.includes('passenger-2'));
  assert.ok(fixture.removed.includes(fixture.connectorRoot));
  assert.deepEqual(
    fixture.disposed.filter((name) => name.startsWith('connector') || name.startsWith('badge')),
    ['connector-geometry', 'connector-material', 'badge-material']
  );
});

test('linked boarding waits for cross-frame entries and still completes exactly once', () => {
  const fixture = makeLinkedBoardingView();
  fixture.entries[1].startedAt = 0.1;

  fixture.view.updateBoardingViews(0.25);

  assert.equal(fixture.view.boardingViews.length, 1);
  assert.equal(fixture.view.linkedBoardingBatches.get(17).remaining, 1);
  assert.deepEqual(fixture.pulses, []);
  assert.deepEqual(fixture.smoke, []);
  assert.deepEqual(fixture.aboard, []);

  fixture.view.updateBoardingViews(0.36);
  fixture.view.updateBoardingViews(0.5);

  assert.deepEqual(fixture.pulses, [[84, 0.36]]);
  assert.deepEqual(fixture.smoke, [84]);
  assert.deepEqual(fixture.aboard, [84]);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
});

test('linked boarding reduced motion keeps start positions and fades before one aggregate completion', () => {
  const fixture = makeLinkedBoardingView({ reducedMotion: true });
  const starts = fixture.entries.map(({ start }) => start.clone());

  fixture.view.updateBoardingViews(0.125);

  fixture.entries.forEach((entry, index) => {
    assert.deepEqual(entry.root.position.toArray(), starts[index].toArray());
    assert.equal(entry.material.transparent, true);
    assert.equal(entry.material.opacity, 0.5);
  });
  assert.deepEqual(fixture.pulses, []);
  assert.deepEqual(fixture.smoke, []);
  assert.deepEqual(fixture.aboard, []);

  fixture.view.updateBoardingViews(0.25);

  assert.deepEqual(fixture.pulses, [[84, 0.25]]);
  assert.deepEqual(fixture.smoke, [84]);
  assert.deepEqual(fixture.aboard, [84]);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
});

test('clearing boarding views disposes in-flight linked passengers and batch feedback', () => {
  const fixture = makeLinkedBoardingView();
  fixture.view.clearLinkedPassengerConnectors = () => {};
  fixture.view.vehicleBoardingPulses = new Map([[84, [0]]]);
  fixture.view.initialEntryPathStates = new Map([['initial', {}]]);
  fixture.view.queueEntryPathStates = new Map([['queue', {}]]);
  fixture.view.lastBoardingEventId = 17;

  fixture.view.clearBoardingViews();

  assert.equal(fixture.view.boardingViews.length, 0);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
  assert.equal(fixture.view.vehicleBoardingPulses.size, 0);
  assert.equal(fixture.view.initialEntryPathStates.size, 0);
  assert.equal(fixture.view.queueEntryPathStates.size, 0);
  assert.equal(fixture.view.lastBoardingEventId, 0);
  assert.ok(fixture.removed.includes(fixture.connectorRoot));
  assert.ok(fixture.entries.every(({ root }) => fixture.removed.includes(root)));
});

test('a reset-version change clears stale boarding ids before a new generation event plays', () => {
  const fixture = makeLinkedBoardingView();
  const played = [];
  fixture.view.lastSeenResetVersion = 4;
  fixture.view.lastSnapshot = { time: 0 };
  fixture.view.lastGame = null;
  fixture.view.vatTimeUniform = { value: 0 };
  fixture.view.passengerViews = [];
  fixture.view.linkedPassengerConnectors = new Map();
  fixture.view.vehicleBoardingPulses = new Map([[84, [0]]]);
  fixture.view.initialEntryPathStates = new Map([['initial', {}]]);
  fixture.view.queueEntryPathStates = new Map([['queue', {}]]);
  fixture.view.lastBoardingEventId = 9;
  fixture.view.personTemplate = {};
  fixture.view.spawnLinkedBoardingBatch = (event) => played.push(event.id);
  fixture.view.seatCountBoards = [];
  fixture.view.updateGarages = () => {};
  fixture.view.maglevSpotViews = new Map();
  fixture.view.capacitySpotMarkers = [];
  fixture.view.vehicleViews = new Map();
  fixture.view.spotPositions = [];
  fixture.view.pruneInitialEntryPathStates = () => {};
  fixture.view.queuePassengerViews = [];
  fixture.view.queueCurves = [];
  fixture.view.pruneQueueEntryPathStates = () => {};
  fixture.view.syncLinkedPassengerConnectors = () => {};
  fixture.view.vehicleEffects = null;
  fixture.view.updateVehiclePathPreview = () => {};
  fixture.view.updateGuideHand = () => {};
  const snapshot = {
    resetVersion: 5,
    time: 0,
    lastEvent: { type: 'queues-initialized' },
    boardingEvents: [{
      id: 1,
      groupCount: 2,
      linkedPassenger: { chainId: 'linked-0-0', length: 2 }
    }],
    vehicles: [],
    spots: [],
    slots: [],
    queueItems: [],
    speedMultiplier: 1
  };

  fixture.view.update(snapshot, {});

  assert.deepEqual(played, [1]);
  assert.equal(fixture.view.lastBoardingEventId, 1);
  assert.equal(fixture.view.boardingViews.length, 0);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
  assert.ok(fixture.removed.includes(fixture.connectorRoot));
});

test('destroy is idempotent and detaches observers listeners and boarding resources', () => {
  const fixture = makeLinkedBoardingView();
  const disconnected = [];
  const removedCanvasListeners = [];
  const removedWindowListeners = [];
  const resizeHandler = () => {};
  const pointerHandler = () => {};
  fixture.view.canvas = {
    removeEventListener: (type, handler) => removedCanvasListeners.push([type, handler])
  };
  fixture.view.handleResize = resizeHandler;
  fixture.view.handlePointerUp = pointerHandler;
  fixture.view.resizeObserver = { disconnect: () => disconnected.push(true) };
  fixture.view.linkedPassengerConnectors = new Map();
  fixture.view.vehicleBoardingPulses = new Map();
  fixture.view.initialEntryPathStates = new Map();
  fixture.view.queueEntryPathStates = new Map();
  fixture.view.lastBoardingEventId = 17;
  const previousWindow = globalThis.window;
  globalThis.window = {
    removeEventListener: (type, handler) => removedWindowListeners.push([type, handler])
  };

  try {
    fixture.view.destroy();
    fixture.view.destroy();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }

  assert.equal(fixture.view.boardingViews.length, 0);
  assert.equal(fixture.view.linkedBoardingBatches.size, 0);
  assert.deepEqual(disconnected, [true]);
  assert.deepEqual(removedWindowListeners, [['resize', resizeHandler]]);
  assert.deepEqual(removedCanvasListeners, [['pointerup', pointerHandler]]);
});

test('ParticleRibbon splits Ribbon_01 into the 3x3 sprite atlas frames', () => {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  const baseTexture = new THREE.Texture();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map(),
    spotRoots: [root],
    textures: {
      ribbon: baseTexture,
      ribbonSmoke: new THREE.Texture()
    }
  });
  effects.spawnSpotBurst(root, UNITY_EFFECTS.ribbon, baseTexture, true, 9);
  assert.equal(effects.particles.length, 9);
  const frames = effects.particles.map((particle) => ({
    x: Number(particle.material.map.offset.x.toFixed(6)),
    y: Number(particle.material.map.offset.y.toFixed(6)),
    w: Number(particle.material.map.repeat.x.toFixed(6)),
    h: Number(particle.material.map.repeat.y.toFixed(6))
  }));
  assert.deepEqual(frames, [
    { x: 0, y: 0.666667, w: 0.333333, h: 0.333333 },
    { x: 0.333333, y: 0.666667, w: 0.333333, h: 0.333333 },
    { x: 0.666667, y: 0.666667, w: 0.333333, h: 0.333333 },
    { x: 0, y: 0.333333, w: 0.333333, h: 0.333333 },
    { x: 0.333333, y: 0.333333, w: 0.333333, h: 0.333333 },
    { x: 0.666667, y: 0.333333, w: 0.333333, h: 0.333333 },
    { x: 0, y: 0, w: 0.333333, h: 0.333333 },
    { x: 0.333333, y: 0, w: 0.333333, h: 0.333333 },
    { x: 0.666667, y: 0, w: 0.333333, h: 0.333333 }
  ]);
});

test('ParticleRibbon keeps its cyclic colors at full opacity during updates', () => {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  const texture = new THREE.Texture();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map(),
    spotRoots: [root],
    textures: { ribbon: texture }
  });
  effects.spawnSpotBurst(root, UNITY_EFFECTS.ribbon, texture, true, 6);
  const createdColors = effects.particles.map((particle) => particle.material.color.getHexString());
  assert.ok(new Set(createdColors).size > 1);

  effects.update({ time: 0, spots: [] });
  effects.update({ time: 0.3, spots: [] });

  assert.deepEqual(effects.particles.map((particle) => particle.material.color.getHexString()), createdColors);
  assert.ok(effects.particles.every((particle) => particle.opacity === 1));
  assert.ok(effects.particles.every((particle) => particle.material.opacity === 1));
});

test('Effect_Ribbon particles use speed-over-lifetime and movement range limits', () => {
  const scene = new THREE.Group();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map(),
    spotRoots: [],
    textures: {}
  });
  effects.addParticle({
    parent: scene,
    texture: new THREE.Texture(),
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(10, 0, 0),
    lifetime: 1,
    initialSize: 1,
    sizeOverLifetime: [1, 1],
    fadeOutSpeed: 0.5,
    speedOverLifetime: [[0, 1], [1, 0]],
    moveRange: 0.75,
    opacity: 1,
    gravity: 0,
    color: 0xffffff
  });
  effects.update({ time: 0, spots: [] });
  effects.update({ time: 0.5, spots: [] });
  assert.equal(Number(effects.particles[0].velocity.x.toFixed(3)), 5);
  assert.equal(Number(effects.particles[0].sprite.position.x.toFixed(3)), 0.75);
});
test('Effect_Ribbon reads movement tuning from the scene editor settings', () => {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map(),
    spotRoots: [root],
    textures: {},
    effectsTuning: {
      ribbon: {
        moveRange: 0.42,
        speedStart: 0.7,
        speedMidTime: 0.25,
        speedMid: 0.3,
        speedEnd: 0.1
      }
    }
  });
  effects.spawnSpotBurst(root, UNITY_EFFECTS.ribbon, new THREE.Texture(), true, 1, effects.effectsTuning.ribbon);
  assert.deepEqual(effects.particles[0].speedOverLifetime, [[0, 0.7], [0.25, 0.3], [1, 0.1]]);
  assert.equal(effects.particles[0].moveRange, 0.42);
});
test('Effect_Hit spawns the three Unity-authored child particle systems once per contact', () => {
  const scene = new THREE.Group();
  const attacker = new THREE.Group();
  const target = new THREE.Group();
  target.position.set(1, 0, 0);
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map([[89, attacker], [84, target]]),
    spotRoots: [],
    textures: {
      hitCircle: new THREE.Texture(),
      hitRound2: new THREE.Texture(),
      hitRound1: new THREE.Texture()
    }
  });
  const snapshot = {
    time: 1,
    spots: [],
    vehicles: [],
    lastEvent: { type: 'vehicle-collision-contact', vehicleId: 89, targetId: 84 }
  };
  effects.update(snapshot);
  effects.update(snapshot);
  assert.ok(effects.particles.length >= 13 && effects.particles.length <= 14);
  assert.equal(scene.children.length, effects.particles.length);
  assert.ok(effects.particles.some((particle) => particle.delay === 0.03));
  assert.ok(effects.particles.some((particle) => particle.material.blending === THREE.AdditiveBlending));
});

test('Effect_Hit particle size reads scene editor tuning', () => {
  const scene = new THREE.Group();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map(),
    spotRoots: [],
    textures: { hitCircle: new THREE.Texture() },
    effectsTuning: {
      hit: {
        sizeScale: 2,
        particleHit2SizeScale: 1.5
      }
    }
  });
  effects.spawnHitEmitter(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    UNITY_EFFECTS.hit.emitters[0]
  );
  assert.equal(effects.particles.length, 2);
  assert.ok(effects.particles.every((particle) => Number(particle.initialSize.toFixed(3)) === 1.2));
});

test('Effect_SmokeTrail emits while vehicles move and stops when they park', () => {
  const scene = new THREE.Group();
  const vehicle = new THREE.Group();
  const effects = new VehicleEffects({
    scene,
    vehicleViews: new Map([[84, vehicle]]),
    spotRoots: [],
    textures: { smokeTrail: new THREE.Texture() }
  });
  effects.update({ time: 0, spots: [], vehicles: [{ id: 84, state: 'moving-to-spot' }], lastEvent: { type: 'reset' } });
  effects.update({ time: 0.1, spots: [], vehicles: [{ id: 84, state: 'moving-to-spot' }], lastEvent: { type: 'reset' } });
  assert.equal(effects.particles.length, 2);
  assert.ok(effects.particles.every((particle) => particle.gravity === UNITY_EFFECTS.smokeTrail.gravity));
  effects.update({ time: 0.2, spots: [], vehicles: [{ id: 84, state: 'parked' }], lastEvent: { type: 'reset' } });
  const countAfterPark = effects.particles.length;
  effects.update({ time: 0.3, spots: [], vehicles: [{ id: 84, state: 'parked' }], lastEvent: { type: 'reset' } });
  assert.ok(effects.particles.length <= countAfterPark);
});
