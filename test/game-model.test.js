import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BusLoopGame } from '../src/game-model.js';
import { COLORS, LEVEL_1 } from '../src/level-data.js';
import { SCENE_TUNING } from '../src/scene-tuning.js';
import {
  buildOutStationPoints,
  buildRoundedPath,
  buildToStationPoints,
  chooseHitClip,
  evaluatePath,
  evaluateUnityCurve,
  sampleHitClip,
  UNITY_VEHICLE_MOTION
} from '../src/vehicle-motion.js';

const advance = (game, seconds, step = .05) => {
  for (let time = 0; time < seconds; time += step) game.update(step);
};

const publicAssetExists = (url) => existsSync(join('public', url.replace(/^\//, '')));

const LEVEL12_TOTAL_PASSENGERS = 438;
const LEVEL12_COLOR_TOTALS = { 0: 68, 1: 34, 2: 18, 3: 22, 4: 12, 5: 198, 6: 20, 7: 52, 8: 14 };
const LEVEL12_INITIAL_MOVABLE_IDS = [1, 4, 34, 51];
const LEVEL12_DISPATCH_ID = 1;
const LEVEL12_BLOCKED_ID = 2;

const countSeatsByColor = () => {
  const counts = {};
  for (const vehicle of LEVEL_1.vehicles) {
    counts[vehicle.colorIndex] = (counts[vehicle.colorIndex] ?? 0) + vehicle.seats;
  }
  return counts;
};

const mapVehicleAreaPoint = (point) => {
  const area = SCENE_TUNING.vehicleArea;
  const unitScale = area.positionUnitScale ?? LEVEL_1.mapScale;
  const scaledX = (point.x - area.positionPivotX) * unitScale + area.positionPivotX;
  const scaledZ = (point.z - area.positionPivotZ) * unitScale + area.positionPivotZ;
  const rotation = (area.rotationDegrees || 0) * Math.PI / 180;
  const x = (area.sourceRootX + scaledX) * area.unityToWorldScale + area.offsetX;
  const z = (
    (area.sourceRootZ + scaledZ)
    * area.unityToWorldScale
    * (area.mirrorZ ? -1 : 1)
  ) + area.offsetZ;
  const dx = x - area.pivotX;
  const dz = z - area.pivotZ;
  return {
    x: area.pivotX + dx * Math.cos(rotation) - dz * Math.sin(rotation),
    z: area.pivotZ + dx * Math.sin(rotation) + dz * Math.cos(rotation)
  };
};

test('level12 initializes Unity-authored layout and counts', () => {
  const state = new BusLoopGame().snapshot();
  assert.equal(LEVEL_1.id, 0);
  assert.equal(LEVEL_1.sceneName, 'GameSceneDualQueue2');
  assert.equal(LEVEL_1.mapScale, 1.0012542);
  assert.equal(state.vehicles.length, 94);
  assert.equal(state.spots.length, 6);
  assert.equal(state.slots.length, 32);
  assert.equal(LEVEL_1.passengerQueues.length, 2);
  assert.deepEqual(LEVEL_1.passengerQueues.map((queue) => queue.length), [219, 219]);
  assert.equal(LEVEL_1.passengerSequence.length, LEVEL12_TOTAL_PASSENGERS);
  assert.deepEqual(countSeatsByColor(), LEVEL12_COLOR_TOTALS);
  assert.equal(state.sourceRemaining, LEVEL12_TOTAL_PASSENGERS - LEVEL_1.queueCapacity * 2);
  assert.deepEqual(state.queueRemaining, [24, 24]);
  assert.equal(state.remainingGroups, LEVEL12_TOTAL_PASSENGERS);
  assert.deepEqual(state.remainingByColor, LEVEL12_COLOR_TOTALS);
  assert.deepEqual(LEVEL_1.vehicles[0], { id: 1, seats: 4, colorIndex: 5, x: 1.8599999, z: 1.6299994, yaw: 90 });
  assert.deepEqual(LEVEL_1.vehicles.at(-1), { id: 118, seats: 10, colorIndex: 3, x: 1.4415802, z: 0.41113225, yaw: 0 });
  assert.deepEqual(LEVEL_1.passengerQueues[0].slice(0, 24), [
    5, 5, 3, 3, 0, 0, 0, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 8, 8
  ]);
  assert.deepEqual(LEVEL_1.passengerQueues[1].slice(0, 24), [
    5, 5, 3, 3, 0, 0, 0, 5, 5, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 7
  ]);
});

test('queue initialization can use adapted Unity visible capacities without losing passengers', () => {
  const game = new BusLoopGame();
  game.initializeQueues([17, 18], 0.25, [4, 4.25]);
  const state = game.snapshot();
  assert.deepEqual(state.queueRemaining, [17, 18]);
  assert.equal(state.sourceRemaining, LEVEL12_TOTAL_PASSENGERS - 17 - 18);
  assert.equal(state.remainingGroups, LEVEL12_TOTAL_PASSENGERS);
  assert.equal(state.queueItems[0][0].distanceFromHead, 0);
  assert.equal(state.queueItems[0][1].distanceFromHead, 0.25);
  assert.equal(state.queueItems[1][17].distanceFromHead, 4.25);
});

test('queue passengers keep Unity-style logic distance and advance after dequeue', () => {
  const game = new BusLoopGame();
  game.initializeQueues([4, 4], 0.5, [3, 3]);
  assert.deepEqual(
    game.snapshot().queueItems[0].map((item) => item.distanceFromHead),
    [0, 0.5, 1, 1.5]
  );
  assert.equal(game.dequeuePassenger(0), 5);
  assert.deepEqual(
    game.snapshot().queueItems[0].map((item) => item.distanceFromHead),
    [0.5, 1, 1.5, 2]
  );
  game.update(0.1);
  assert.deepEqual(
    game.snapshot().queueItems[0].map((item) => Number(item.distanceFromHead.toFixed(3))),
    [0.3, 0.8, 1.3, 1.8]
  );
  assert.equal(game.dequeuePassenger(0), null);
  game.updateQueues(0.2);
  assert.equal(game.dequeuePassenger(0), 5);
});

test('both DualQueue2 entrances feed the shared conveyor', () => {
  const game = new BusLoopGame();
  advance(game, 1);
  const entryIndices = new Set(
    game.snapshot().slots
      .filter((slot) => slot.colorIndex !== null)
      .map((slot) => slot.entryIndex)
  );
  assert.deepEqual([...entryIndices].sort(), [0, 1]);
});

test('side queue passengers keep Unity entering-belt motion metadata', () => {
  assert.deepEqual(LEVEL_1.passengerEntryMotion, {
    passengerSpeed: 2,
    conveyorSpeed: 0.5,
    initialFillCatchUpDuration: 0.2,
    catchUpExtraSpeed: 1,
    snapDistance: 0.02
  });

  const game = new BusLoopGame();
  assert.equal(game.snapshot().initialFillActive, true);
  advance(game, 1);
  assert.ok(game.initialFilledSlotIndices.size >= 6);
  const enteringSlots = game.snapshot().slots.filter((slot) => slot.entryMotion);
  assert.ok(enteringSlots.length >= 2);
  const entryIndices = new Set(enteringSlots.map((slot) => slot.entryMotion.entryIndex));
  assert.deepEqual([...entryIndices].sort(), [0, 1]);

  for (const slot of enteringSlots) {
    assert.equal(slot.entryMotion.entryIndex, slot.entryIndex);
    assert.equal(slot.entryMotion.fromQueueProgress, 0);
    assert.equal(slot.entryMotion.startedAt <= game.time, true);
    assert.equal(slot.entryMotion.initialFill, true);
  }
});

test('post-initial-fill passengers still carry entrance motion metadata', () => {
  const game = new BusLoopGame();
  advance(game, 8);
  assert.equal(game.snapshot().initialFillActive, false);

  const slot = game.slots[0];
  slot.colorIndex = null;
  slot.entryIndex = null;
  slot.entryMotion = null;
  slot.progress = 0.999;
  slot.previousProgress = 0.999;

  game.update(0.1);
  const updated = game.snapshot().slots[0];
  assert.notEqual(updated.colorIndex, null);
  assert.equal(updated.entryIndex, 0);
  assert.equal(updated.entryMotion.entryIndex, 0);
  assert.equal(updated.entryMotion.passengerId, 19);
  assert.equal(updated.entryMotion.fromQueueDistance, 0);
  assert.equal(updated.entryMotion.fromQueueProgress, 0);
  assert.equal(updated.entryMotion.startedAt, game.time);
  assert.equal(updated.entryMotion.initialFill, false);
});

test('Unity visual assets and tunable camera configuration are complete', () => {
  assert.equal(SCENE_TUNING.camera.elevationDegrees, 55);
  assert.equal(SCENE_TUNING.lighting.directional.enabled, 1);
  assert.equal(SCENE_TUNING.lighting.directional.color, 0xffffff);
  assert.equal(SCENE_TUNING.lighting.directional.intensity, 1);
  assert.deepEqual(SCENE_TUNING.lighting.directional.position, { x: 0, y: 3, z: 0 });
  assert.deepEqual(SCENE_TUNING.lighting.directional.eulerDegrees, { x: 62.5, y: -34, z: -4.5 });
  assert.equal('shadowType' in SCENE_TUNING.lighting.directional, false);
  assert.equal('shadowStrength' in SCENE_TUNING.lighting.directional, false);
  assert.equal('realtimeShadows' in SCENE_TUNING.lighting, false);
  assert.equal(SCENE_TUNING.facing.passengerYawDegrees, 180);
  assert.equal(SCENE_TUNING.facing.passengerModelYawDegrees, -90);
  assert.equal(SCENE_TUNING.vehicleArea.rotationDegrees, 0);
  assert.equal(SCENE_TUNING.vehicleArea.mirrorZ, true);
  assert.equal(SCENE_TUNING.vehicleArea.positionUnitScale, LEVEL_1.mapScale);
  assert.equal(SCENE_TUNING.facing.arrowYawDegrees, 180);
  assert.match(LEVEL_1.assets.background, /BG01_split01_q60\.jpg$/);
  assert.match(LEVEL_1.assets.textures.parkingSpot, /Car_P2\.png$/);
  assert.equal(LEVEL_1.assets.colorTextures.length, 11);
  assert.deepEqual(Object.keys(LEVEL_1.assets.models.vehicleBySeats).map(Number), [4, 6, 10]);
  assert.match(LEVEL_1.assets.models.vehicleShadowBySeats[10], /Bus_FakeShadow\.fbx$/);
  assert.match(LEVEL_1.assets.textures.vehicleShadowBySeats[10], /Bus_FakeShadow\.png$/);
  const urls = [
    LEVEL_1.assets.background,
    LEVEL_1.assets.loopScene,
    LEVEL_1.assets.models.passengerVatMesh,
    LEVEL_1.assets.models.passengerVatTexture,
    LEVEL_1.assets.models.shadow,
    LEVEL_1.assets.models.arrow,
    LEVEL_1.assets.models.parkingSpot,
    ...Object.values(LEVEL_1.assets.audio).flatMap((data) => data.clips),
    ...Object.values(LEVEL_1.assets.models.vehicleBySeats),
    ...Object.values(LEVEL_1.assets.models.vehicleShadowBySeats),
    ...LEVEL_1.assets.colorTextures,
    LEVEL_1.assets.textures.shadow,
    LEVEL_1.assets.textures.parkingSpot,
    ...Object.values(LEVEL_1.assets.textures.effects),
    ...Object.values(LEVEL_1.assets.textures.vehicleShadowBySeats)
  ];
  assert.ok(urls.every(publicAssetExists));
  assert.deepEqual(LEVEL_1.assets.audio.bus_hit, {
    clips: ['/assets/unity/audio/bus_hit_V5.mp3'],
    volume: 0.503268
  });
  assert.deepEqual(LEVEL_1.assets.audio.passenger_up, {
    clips: [
      '/assets/unity/audio/passenger_up_01.mp3',
      '/assets/unity/audio/passenger_up_02.mp3',
      '/assets/unity/audio/passenger_up_03.mp3'
    ],
    volume: 0.825528
  });
  assert.deepEqual(LEVEL_1.assets.audio.bus_full, {
    clips: ['/assets/unity/audio/bus_full.mp3'],
    volume: 0.50023913
  });
  assert.equal(LEVEL_1.assets.passengerAnimations.move.duration, 0.60000014);
});

test('vehicle generation region matches GameSceneDualQueue2 VehicleRoot Cube', () => {
  const area = SCENE_TUNING.vehicleArea;
  assert.deepEqual(area.sourceCube, {
    centerX: 0,
    centerZ: -0.5,
    width: 4,
    depth: 4.36
  });
  assert.equal(area.sourceRootZ, -2.92);
  assert.equal(area.unityToWorldScale, 2);
  assert.deepEqual({
    centerX: (area.sourceRootX + area.sourceCube.centerX) * area.unityToWorldScale,
    centerZ: (
      (area.sourceRootZ + area.sourceCube.centerZ)
      * area.unityToWorldScale
      * (area.mirrorZ ? -1 : 1)
    ),
    width: area.sourceCube.width * area.unityToWorldScale,
    depth: area.sourceCube.depth * area.unityToWorldScale
  }, {
    centerX: 0,
    centerZ: 6.84,
    width: 8,
    depth: 8.72
  });
  const halfWidth = area.sourceCube.width * area.unityToWorldScale * 0.5;
  const halfDepth = area.sourceCube.depth * area.unityToWorldScale * 0.5;
  for (const vehicle of LEVEL_1.vehicles) {
    const point = mapVehicleAreaPoint(vehicle);
    assert.ok(point.x >= -halfWidth && point.x <= halfWidth);
    assert.ok(point.z >= 6.84 - halfDepth && point.z <= 6.84 + halfDepth);
  }
});

test('editor sizing, source background ratio, and passenger shadow anchor stay wired', () => {
  const indexSource = readFileSync(join('index.html'), 'utf8');
  const stylesSource = readFileSync(join('src', 'styles.css'), 'utf8');
  const background = readFileSync(join('public', LEVEL_1.assets.background.replace(/^\//, '')));
  const sourceWidth = background.readUInt32BE(16);
  const sourceHeight = background.readUInt32BE(20);
  assert.equal(sourceWidth, 2100);
  assert.equal(sourceHeight, 3382);
  assert.equal(SCENE_TUNING.background.sourceWidth, sourceWidth);
  assert.equal(SCENE_TUNING.background.sourceHeight, sourceHeight);
  assert.deepEqual(SCENE_TUNING.preview, { enabled: 1, width: 1080, height: 2160 });
  assert.deepEqual(SCENE_TUNING.sourceCrop, { enabled: 1, width: 1080, height: 2160, offsetX: 0, offsetY: 211 });
  assert.equal(SCENE_TUNING.parkingSpots.count, 6);
  assert.equal(SCENE_TUNING.parkingSpots.startX, -2.75);
  assert.equal(SCENE_TUNING.parkingSpots.scaleX, 1);
  assert.equal(SCENE_TUNING.parkingSpots.scaleZ, 1);
  assert.equal(SCENE_TUNING.seatCountBoard.z, 0.92);
  assert.equal(SCENE_TUNING.seatCountBoard.width, 0.58);
  assert.equal(SCENE_TUNING.seatCountBoard.depth, 0.34);
  assert.equal(SCENE_TUNING.seatCountBoard.textScale, 1);
  assert.equal(SCENE_TUNING.vehicleArrow.offsetY, 0.16);
  assert.equal(SCENE_TUNING.vehicleArrow.outlineColor, 0x171717);
  assert.equal(SCENE_TUNING.vehicleArrow.outlineScale, 1.28);
  assert.equal(SCENE_TUNING.vehicleArrow.outlineDepthTest, 0);
  assert.equal(SCENE_TUNING.vehicleShadows.depthBySeats[10], 2.05);
  assert.deepEqual(SCENE_TUNING.vehicleShadows.scaleBySeats[10], { x: 1.28, z: 1.18 });
  assert.equal(SCENE_TUNING.camera.fovDegrees, 2.2);
  assert.equal(SCENE_TUNING.background.distanceOffset, 7);
  assert.equal(SCENE_TUNING.background.width, 14.1);
  assert.equal(SCENE_TUNING.background.height, 22.708);
  assert.equal(SCENE_TUNING.facing.passengerShadowYawDegrees, 90);
  assert.equal(SCENE_TUNING.passengers.modelScale, 0.92);
  assert.equal(SCENE_TUNING.passengers.groupSpacing, 0.13);
  assert.equal(SCENE_TUNING.passengerMaterial.baseColorStrength, 1);
  assert.equal(SCENE_TUNING.passengerMaterial.emissionStrength, 1);
  assert.equal(SCENE_TUNING.passengerMaterial.brightness, 1);
  assert.equal(SCENE_TUNING.passengerMaterial.roughness, 0.58);
  assert.equal(SCENE_TUNING.passengerMaterial.mode, 'unityTexture');
  assert.equal(SCENE_TUNING.passengerMaterial.solidColors.length, 11);
  assert.equal(SCENE_TUNING.passengerMaterial.solidColors[0], 0x36a6ff);
  assert.equal(SCENE_TUNING.passengerMaterial.colors.length, 11);
  assert.deepEqual(SCENE_TUNING.passengerMaterial.colors[0], { emissionColor: 0x36a6ff, baseColor: 0xffffff });
  assert.deepEqual(SCENE_TUNING.cta, {
    enabled: 1,
    x: 540,
    y: 1981,
    worldX: 0,
    worldY: 0.99,
    worldZ: 11.57,
    height: 73,
    stretchX: 2.83,
    fontSize: 32,
    fontHeight: 64,
    strokeColor: 0x196b07,
    strokeWidth: 2.9,
    pulseScale: 1.15,
    pulseSpeed: 0.21
  });
  assert.deepEqual(LEVEL_1.passengerQueue, { spacing: 0.4, screenEdgeOffsetSpacing: 4 });
  assert.equal(LEVEL_1.conveyorPathLength, 4.591284809513923);
  assert.deepEqual(SCENE_TUNING.vehicleBoardingPulse, { scale: 1.14, speed: 5 });
  assert.equal(SCENE_TUNING.vehicleGuideHand.enabled, 1);
  assert.equal(SCENE_TUNING.vehicleGuideHand.vehicleId, 1);
  assert.equal(SCENE_TUNING.vehicleGuideHand.size, 1);
  assert.equal(SCENE_TUNING.vehicleGuideHand.speed, 1.15);
  assert.equal(SCENE_TUNING.vehicleGuideHand.nearScale, 0.78);
  assert.equal(SCENE_TUNING.vehicleGuideHand.farScale, 1.14);
  assert.equal('conveyorScale' in SCENE_TUNING.passengers, false);
  assert.equal('queueScale' in SCENE_TUNING.passengers, false);
  assert.deepEqual(Object.keys(SCENE_TUNING.passengerShadows), ['conveyor', 'leftQueue', 'rightQueue']);
  assert.ok(publicAssetExists('/assets/icon.png'));
  assert.ok(publicAssetExists('/assets/main-guide-hand.png'));
  assert.ok(publicAssetExists('/assets/unity/ui/Main_Prop_GreenBtn.png'));
  assert.match(indexSource, /id="loading-screen"/);
  assert.match(indexSource, /id="cta-button"/);
  assert.match(indexSource, /Play Now/);
  assert.match(indexSource, /Bus Fever - Car Jam Escape/);
  assert.match(indexSource, /\/assets\/icon\.png/);
  assert.match(indexSource, /role="progressbar"/);
  assert.match(indexSource, /id="loading-progress-bar"/);
  assert.match(indexSource, /id="loading-progress-value"/);
  assert.match(stylesSource, /\.loading-screen/);
  assert.match(stylesSource, /\.loading-screen\.is-hidden/);
  assert.match(stylesSource, /\.loading-progress/);
  assert.match(stylesSource, /\.loading-progress-bar/);
  assert.match(stylesSource, /Main_Prop_GreenBtn\.png/);
  assert.match(stylesSource, /@keyframes cta-pulse/);
  assert.match(stylesSource, /--cta-stroke-color/);
  assert.match(stylesSource, /\.cta-button:hover \{/);
  assert.match(stylesSource, /background: transparent url\('\/assets\/unity\/ui\/Main_Prop_GreenBtn\.png'\) center \/ 100% 100% no-repeat/);

  const editorSource = readFileSync(join('src', 'scene-editor.js'), 'utf8');
  assert.match(editorSource, /preview\.width/);
  assert.match(editorSource, /preview\.height/);
  assert.match(editorSource, /lighting\.directional\.enabled/);
  assert.match(editorSource, /cta\.x/);
  assert.match(editorSource, /cta\.y/);
  assert.match(editorSource, /cta\.worldX/);
  assert.match(editorSource, /cta\.worldY/);
  assert.match(editorSource, /cta\.worldZ/);
  assert.match(editorSource, /cta\.stretchX/);
  assert.match(editorSource, /cta\.fontSize/);
  assert.match(editorSource, /cta\.fontHeight/);
  assert.match(editorSource, /cta\.strokeColor/);
  assert.match(editorSource, /cta\.pulseScale/);
  assert.match(editorSource, /lighting\.directional\.color/);
  assert.match(editorSource, /lighting\.directional\.intensity/);
  assert.match(editorSource, /lighting\.directional\.position\.x/);
  assert.match(editorSource, /lighting\.directional\.eulerDegrees\.x/);
  assert.doesNotMatch(editorSource, /lighting\.directional\.shadowType/);
  assert.doesNotMatch(editorSource, /lighting\.directional\.shadowStrength/);
  assert.doesNotMatch(editorSource, /lighting\.realtimeShadows/);
  assert.match(editorSource, /effects\.hit\.sizeScale/);
  assert.match(editorSource, /effects\.hit\.particleHit2SizeScale/);
  assert.match(editorSource, /sourceCrop\.offsetX/);
  assert.match(editorSource, /sourceCrop\.offsetY/);
  assert.match(editorSource, /passengers\.modelScale/);
  assert.match(editorSource, /passengers\.groupSpacing/);
  assert.match(editorSource, /Passenger Material/);
  assert.match(editorSource, /passengerMaterial\.mode/);
  assert.match(editorSource, /solidColor/);
  assert.match(editorSource, /passengerMaterial\.baseColorStrength/);
  assert.match(editorSource, /passengerMaterial\.emissionStrength/);
  assert.match(editorSource, /passengerMaterial\.brightness/);
  assert.match(editorSource, /passengerMaterial\.roughness/);
  assert.match(editorSource, /passengerMaterial\.solidColors\.0/);
  assert.match(editorSource, /passengerMaterial\.solidColors\.10/);
  assert.match(editorSource, /passengerMaterial\.colors\.0\.baseColor/);
  assert.match(editorSource, /passengerMaterial\.colors\.10\.emissionColor/);
  assert.match(editorSource, /editor-select/);
  assert.match(editorSource, /updatePassengerMaterialVisibility/);
  assert.match(editorSource, /path\.startsWith\('passengerMaterial\.solidColors\.'/);
  assert.match(editorSource, /\^passengerMaterial\\\.solidColors\\\.\\d\+\$/);
  assert.match(editorSource, /rangeMarkup = isColor/);
  assert.match(editorSource, /setTuning\(next, \{ path \}\)/);
  assert.match(editorSource, /color\?\.addEventListener\('change'/);
  assert.match(editorSource, /conveyorArt\.width/);
  assert.match(editorSource, /conveyorArt\.depth/);
  assert.match(editorSource, /passengerShadows\.conveyor\.scaleX/);
  assert.match(editorSource, /passengerShadows\.leftQueue\.offsetX/);
  assert.match(editorSource, /passengerShadows\.rightQueue\.offsetZ/);
  assert.match(editorSource, /parkingSpots\.scaleX/);
  assert.match(editorSource, /parkingSpots\.scaleZ/);
  assert.match(editorSource, /seatCountBoard\.z/);
  assert.match(editorSource, /seatCountBoard\.width/);
  assert.match(editorSource, /seatCountBoard\.depth/);
  assert.match(editorSource, /seatCountBoard\.textScale/);
  assert.match(editorSource, /vehicleArrow\.offsetY/);
  assert.match(editorSource, /vehicleArrow\.outlineColor/);
  assert.match(editorSource, /vehicleArrow\.outlineScale/);
  assert.match(editorSource, /vehicleArrow\.outlineDepthTest/);
  assert.match(editorSource, /vehicleArea\.positionUnitScale/);
  assert.match(editorSource, /Map Scale/);
  assert.match(editorSource, /vehicleBoardingPulse\.scale/);
  assert.match(editorSource, /vehicleBoardingPulse\.speed/);
  assert.match(editorSource, /vehicleGuideHand\.enabled/);
  assert.match(editorSource, /vehicleGuideHand\.vehicleId/);
  assert.match(editorSource, /vehicleGuideHand\.offsetX/);
  assert.match(editorSource, /vehicleGuideHand\.approachOffsetX/);
  assert.match(editorSource, /vehicleGuideHand\.size/);
  assert.match(editorSource, /vehicleGuideHand\.nearScale/);
  assert.match(editorSource, /vehicleGuideHand\.farScale/);
  assert.match(editorSource, /vehicleGuideHand\.speed/);

  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  assert.match(viewSource, /new THREE\.PerspectiveCamera/);
  assert.doesNotMatch(viewSource, /new THREE\.OrthographicCamera/);
  assert.match(viewSource, /directionalLightDirection/);
  assert.match(viewSource, /SCENE_TUNING\.lighting\?\.directional/);
  assert.match(viewSource, /directionalLight\.visible = Boolean\(directional\.enabled/);
  assert.doesNotMatch(viewSource, /renderer\.shadowMap/);
  assert.doesNotMatch(viewSource, /new THREE\.ShadowMaterial/);
  assert.doesNotMatch(viewSource, /Realtime Shadow/);
  assert.doesNotMatch(viewSource, /shadowFocus/);
  assert.doesNotMatch(viewSource, /shadowLightDistance/);
  assert.doesNotMatch(viewSource, /realtimeShadowMaterial/);
  assert.doesNotMatch(viewSource, /receiverDebugEnabled/);
  assert.doesNotMatch(viewSource, /applyRealtimeShadowFlags/);
  assert.doesNotMatch(viewSource, /configureVehicleRealtimeShadow/);
  assert.doesNotMatch(viewSource, /configurePassengerRealtimeShadow/);
  assert.doesNotMatch(viewSource, /unityShadowStrength/);
  assert.doesNotMatch(viewSource, /new THREE\.DirectionalLight\(0xfff7ea, 2\.7\)/);
  assert.doesNotMatch(viewSource, /sun\.position\.set\(-5, 12, 7\)/);
  assert.match(viewSource, /this\.camera\.add\(this\.backgroundPlane\)/);
  assert.match(viewSource, /backgroundDistance = distance \+ background\.distanceOffset/);
  assert.doesNotMatch(viewSource, /coverScale/);
  assert.match(viewSource, /backgroundWidth = background\.width/);
  assert.match(viewSource, /resolveResponsiveCropFit/);
  assert.match(viewSource, /resolveCameraFit/);
  assert.match(viewSource, /padding: cropEnabled \? 0 : camera\.padding/);
  assert.match(viewSource, /responsiveCrop\.cropOffsetX/);
  assert.match(viewSource, /responsiveCrop\.cropOffsetY/);
  assert.match(viewSource, /parkingSpotYawDegrees \+ 180/);
  assert.match(viewSource, /makeVehicleShadow\(vehicle\.seats\)/);
  assert.match(viewSource, /prepareVehicleShadowTemplate\(vanShadowFbx, 6\)/);
  assert.match(viewSource, /prepareVehicleShadowTemplate\(busShadowFbx, 10\)/);
  assert.match(viewSource, /SCENE_TUNING\.vehicleShadows\.depthBySeats\?\.\[seats\]/);
  assert.match(viewSource, /SCENE_TUNING\.vehicleShadows\.scaleBySeats\?\.\[seats\]/);
  assert.match(viewSource, /seats === '10' \? 0\.8/);
  assert.match(viewSource, /this\.vehicleColorTextures = colorTextures\.map\(configureColorTexture\)/);
  assert.match(viewSource, /this\.passengerColorTextures = this\.vehicleColorTextures/);
  assert.match(viewSource, /PASSENGER_DEFAULT_MATERIAL_COLORS/);
  assert.match(viewSource, /setPassengerMaterialMaps/);
  assert.match(viewSource, /if \(mapChanged\) material\.needsUpdate = true/);
  assert.match(viewSource, /applyPassengerUnityMaterial/);
  assert.match(viewSource, /applyPassengerSolidMaterial/);
  assert.match(viewSource, /applyPassengerMaterial/);
  assert.match(viewSource, /mode === 'solidColor'/);
  assert.match(viewSource, /SCENE_TUNING\.passengerMaterial/);
  assert.match(viewSource, /material\.color\.setRGB/);
  assert.match(viewSource, /setPassengerMaterialMaps\(material, map, map\)/);
  assert.match(viewSource, /setPassengerMaterialMaps\(material, null, null\)/);
  assert.match(viewSource, /material\.emissiveIntensity = emissionStrength/);
  assert.match(viewSource, /updatePassengerMaterialTuning\(\{ colorIndex: changedColorIndex = null \} = \{\}\)/);
  assert.match(viewSource, /shouldUpdateColor/);
  assert.match(viewSource, /mode === 'passengerMaterial'/);
  assert.match(viewSource, /const material = this\.vehicleMaterials\[vehicle\.colorIndex\]\.clone\(\)/);
  assert.match(viewSource, /applyArrowOutlineTuning/);
  assert.match(viewSource, /outlineBaseScale/);
  assert.match(viewSource, /new THREE\.EdgesGeometry/);
  assert.match(viewSource, /addArrowOutline\(this\.arrowTemplate, \{/);
  assert.match(viewSource, /const hitRoot = new THREE\.Group\(\)/);
  assert.match(viewSource, /view\.userData\.hitMeshes = \[hitRoot\]/);
  assert.match(viewSource, /hitRoot\.add\(model, arrow\)/);
  assert.match(viewSource, /triggerVehicleBoardingPulse/);
  assert.match(viewSource, /getVehicleBoardingPulseScale/);
  assert.match(viewSource, /GUIDE_HAND_TEXTURE_URL/);
  assert.match(viewSource, /new THREE\.SpriteMaterial/);
  assert.match(viewSource, /buildGuideHand/);
  assert.match(viewSource, /updateGuideHandTuning/);
  assert.match(viewSource, /updateGuideHand\(snapshot\.time, snapshot\)/);
  assert.match(viewSource, /targetState !== 'parked'/);
  assert.match(viewSource, /\(tuning\.size \?\? 1\) \* THREE\.MathUtils\.lerp/);
  assert.match(viewSource, /initialEntryPathStates/);
  assert.match(viewSource, /getInitialEntryPathVisual/);
  assert.match(viewSource, /fullQueueCurves/);
  assert.match(viewSource, /updateQueueCurvesForCamera/);
  assert.match(viewSource, /makeVisibleQueueCurve/);
  assert.match(viewSource, /getQueueProgressAtDistance/);
  assert.match(viewSource, /getQueueCapacities/);
  assert.match(viewSource, /getConveyorSlotSpacing/);
  assert.match(viewSource, /getQueueLengths/);
  assert.match(viewSource, /this\.ready = this\.loadUnityAssets\(\)/);
  assert.match(viewSource, /new THREE\.LoadingManager\(\)/);
  assert.match(viewSource, /onLoadingProgress/);
  assert.match(viewSource, /loadVatGeometry\(modelPaths\.passengerVatMesh, this\.loadingManager\)/);
  assert.match(viewSource, /getConveyorPathLength/);
  assert.match(viewSource, /item\.distanceFromHead/);
  assert.doesNotMatch(viewSource, /i \* this\.getQueueSpacing\(\)/);
  assert.doesNotMatch(viewSource, /getVisibleQueueCapacity/);
  assert.doesNotMatch(viewSource, /visibleCapacity/);
  assert.match(viewSource, /this\.camera\.updateMatrixWorld\(true\)/);
  assert.match(viewSource, /queueProgress = \(fromQueueDistance - state\.distance\) \/ queueLength/);
  assert.match(viewSource, /conveyorProgress = \(entryPercent \+ \(state\.distance - fromQueueDistance\) \/ conveyorLength\) % 1/);
  assert.doesNotMatch(viewSource, /slot\.entryMotion\.initialFill\) \{/);
  assert.doesNotMatch(viewSource, /view\.visible = !snapshot\.initialFillActive/);
  assert.doesNotMatch(viewSource, /view\.visible = .*hasActiveInitialEntryVisual/);
  assert.match(viewSource, /colorIndex !== undefined/);
  assert.match(viewSource, /hooks = \{\}/);
  assert.match(viewSource, /onPassengerAboard/);
  assert.match(viewSource, /passengers\.modelScale/);
  assert.match(viewSource, /passengers\.groupSpacing/);
  assert.match(viewSource, /slot\.position\.x = \(index - 1\.5\) \* spacing/);
  assert.doesNotMatch(viewSource, /conveyorScale/);
  assert.doesNotMatch(viewSource, /queueScale/);
  assert.match(viewSource, /passengerShadowYawDegrees/);
  assert.match(viewSource, /personPivot\.add\(person\)/);
  assert.match(viewSource, /root\.add\(shadow, personPivot\)/);
  assert.match(viewSource, /slot\.add\(visual\)/);
  assert.doesNotMatch(viewSource, /person\.position\.y = SCENE_TUNING\.shadows\.y/);
});

test('fallback colors remain available before Unity color textures finish loading', () => {
  assert.equal(COLORS[0].hex, 0x0061e8);
  assert.equal(COLORS[1].hex, 0x118024);
  assert.equal(COLORS[2].hex, 0xf338af);
  assert.equal(COLORS[3].hex, 0x9725cd);
  assert.equal(COLORS[4].hex, 0xb10f11);
  assert.equal(COLORS[5].hex, 0xc68000);
  assert.equal(COLORS[6].hex, 0xc24300);
  assert.equal(COLORS[7].hex, 0x014853);
  assert.equal(COLORS[8].hex, 0x542c16);
  assert.equal(COLORS[9].hex, 0x206d53);
  assert.equal(COLORS[10].hex, 0x15209e);
});

test('Unity VAT mesh matches the authored animation texture layout', () => {
  const mesh = readFileSync(join('public', LEVEL_1.assets.models.passengerVatMesh.replace(/^\//, '')));
  assert.equal(mesh.subarray(0, 4).toString('ascii'), 'VATM');
  assert.equal(mesh.readUInt32LE(8), 471);
  assert.equal(mesh.readUInt32LE(12), 2007);
  const texture = readFileSync(join('public', LEVEL_1.assets.models.passengerVatTexture.replace(/^\//, '')));
  assert.equal(texture.length, 512 * 128 * 4 * 2);
});

test('initial blocker graph uses level12 Unity vehicleDepthes', () => {
  const game = new BusLoopGame();
  const movable = LEVEL_1.vehicles
    .filter((vehicle) => game.getBlockers(vehicle.id).length === 0)
    .map((vehicle) => vehicle.id);
  assert.deepEqual(movable, LEVEL12_INITIAL_MOVABLE_IDS);
  assert.equal(Object.keys(LEVEL_1.vehicleDepthes).length, 90);
  assert.deepEqual(LEVEL_1.vehicleDepthes[2], [1, 3]);
  assert.deepEqual(game.getBlockers(2), [1, 3]);
  assert.deepEqual(game.getBlockers(3), [1]);
  assert.deepEqual(game.getBlockers(5), [1, 2, 3]);
  assert.deepEqual(game.getBlockers(85).slice(-10), [86, 87, 88, 89, 74, 90, 91, 92, 96, 93]);
});

test('vehicleDepthes unlock blocked cars as authored blockers leave', () => {
  const game = new BusLoopGame();
  assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), [1, 3]);
  assert.deepEqual(game.clickVehicle(1), { ok: true, spotIndex: 0 });
  assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), [3]);
  assert.deepEqual(game.clickVehicle(3), { ok: true, spotIndex: 1 });
  assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), []);
  assert.deepEqual(game.clickVehicle(LEVEL12_BLOCKED_ID), { ok: true, spotIndex: 2 });
});

test('dispatch reserves the first spot and unlocks cars behind it', () => {
  const game = new BusLoopGame();
  assert.equal(game.clickVehicle(LEVEL12_BLOCKED_ID).reason, 'blocked');
  assert.deepEqual(game.clickVehicle(LEVEL12_DISPATCH_ID), { ok: true, spotIndex: 0 });
  assert.equal(game.snapshot().spots[0].vehicleId, LEVEL12_DISPATCH_ID);
  assert.deepEqual(game.getBlockers(LEVEL12_BLOCKED_ID), [3]);
});

test('blocked click uses Unity collision advance, contact hit, and return phases', () => {
  const game = new BusLoopGame();
  assert.equal(game.clickVehicle(LEVEL12_BLOCKED_ID).reason, 'blocked');
  const attacker = game.getVehicle(LEVEL12_BLOCKED_ID);
  assert.equal(attacker.state, 'colliding');
  assert.equal(attacker.collision.targetId, 1);
  assert.ok(attacker.collision.distance > 0);
  const forwardDuration = attacker.collision.forwardDuration;
  advance(game, forwardDuration + .01, .005);
  assert.ok(game.getVehicle(1).hit);
  assert.equal(chooseHitClip(game.getVehicle(1).hit), 'left');
  advance(game, .5);
  assert.equal(attacker.state, 'parked');
  assert.equal(attacker.collision, null);
});

test('station drive uses the Unity rounded path and authored weighted curve', () => {
  const game = new BusLoopGame();
  game.clickVehicle(LEVEL12_DISPATCH_ID);
  const data = game.getVehicle(LEVEL12_DISPATCH_ID).motionData;
  assert.ok(data.path.segments.some((segment) => segment.type === 'cubic'));
  assert.ok(data.duration > 0 && data.duration < 1);
  const middleDistance = data.path.length * evaluateUnityCurve(data.curve, .5);
  const middle = evaluatePath(data.path, middleDistance);
  assert.ok(Number.isFinite(middle.position.x));
  assert.ok(Math.hypot(middle.tangent.x, middle.tangent.z) > .99);
});

test('station approach follows the Unity parking-area rectangle before entering the spot', () => {
  const originalYaw = SCENE_TUNING.facing.parkingSpotYawDegrees;
  SCENE_TUNING.facing.parkingSpotYawDegrees = 35;
  try {
    const game = new BusLoopGame();
    game.clickVehicle(LEVEL12_DISPATCH_ID);
    const target = game.getSpotPosition(0);
    const data = game.getVehicle(LEVEL12_DISPATCH_ID).motionData;
    const finalSegment = data.path.segments.at(-1);
    const rawPoints = buildToStationPoints(game.getVehicle(LEVEL12_DISPATCH_ID), target, SCENE_TUNING.vehiclePath);
    assert.equal(target.visualYaw, 35);
    assert.notEqual(target.yaw, target.visualYaw);
    const mappedCenter = mapVehicleAreaPoint(target);
    assert.ok(Math.abs(mappedCenter.x - target.visualX) < 1e-6);
    assert.ok(Math.abs(mappedCenter.z - target.visualZ) < 1e-6);
    assert.ok(Number.isFinite(target.approachX));
    assert.ok(Number.isFinite(target.approachZ));
    assert.equal(target.visualApproachX, target.visualX);
    assert.ok(target.visualApproachZ > target.visualZ);
    assert.notDeepEqual(rawPoints.at(-2), { x: target.approachX, z: target.approachZ });
    assert.equal(rawPoints[0].x, game.getVehicle(LEVEL12_DISPATCH_ID).x);
    assert.equal(rawPoints[0].z, game.getVehicle(LEVEL12_DISPATCH_ID).z);
    assert.ok(rawPoints.some((point) => Math.abs(point.z - UNITY_VEHICLE_MOTION.parkingBounds.maxZ) < 1e-6));
    assert.ok(Math.abs(finalSegment.p1.x - target.x) < 1e-6);
    assert.ok(Math.abs(finalSegment.p1.z - target.z) < 1e-6);
  } finally {
    SCENE_TUNING.facing.parkingSpotYawDegrees = originalYaw;
  }
});

test('vehicle path preview and shape controls are wired to scene tuning', () => {
  assert.equal(SCENE_TUNING.vehiclePath.enabled, 0);
  assert.deepEqual(SCENE_TUNING.vehiclePath.parkingBounds, UNITY_VEHICLE_MOTION.parkingBounds);
  const game = new BusLoopGame();
  const target = game.getSpotPosition(0);
  const vehicle = game.getVehicle(LEVEL12_DISPATCH_ID);
  const originalPoints = buildToStationPoints(vehicle, target, SCENE_TUNING.vehiclePath);
  const tunedMotion = {
    ...SCENE_TUNING.vehiclePath,
    parkingBounds: {
      ...SCENE_TUNING.vehiclePath.parkingBounds,
      maxZ: SCENE_TUNING.vehiclePath.parkingBounds.maxZ + 0.5
    },
    turnRadius: SCENE_TUNING.vehiclePath.turnRadius + 0.2
  };
  const tunedPoints = buildToStationPoints(vehicle, target, tunedMotion);
  const originalPath = buildRoundedPath(originalPoints, SCENE_TUNING.vehiclePath);
  const tunedPath = buildRoundedPath(tunedPoints, tunedMotion);
  assert.notEqual(tunedPoints.find((point) => point.z > SCENE_TUNING.vehiclePath.parkingBounds.maxZ)?.z, undefined);
  assert.notEqual(Math.round(originalPath.length * 1000), Math.round(tunedPath.length * 1000));

  const editorSource = readFileSync(join('src', 'scene-editor.js'), 'utf8');
  assert.match(editorSource, /vehiclePath\.enabled/);
  assert.match(editorSource, /vehiclePath\.parkingBounds\.maxZ/);
  assert.match(editorSource, /vehicleDeparturePath\.enabled/);
  assert.match(editorSource, /vehicleDeparturePath\.fullLoadDelay/);
  assert.match(editorSource, /vehicleDeparturePath\.exitTargetX/);
  assert.match(editorSource, /vehicleDeparturePath\.backwardSpeed/);
  assert.match(editorSource, /vehicleDeparturePath\.forwardSpeed/);
  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  assert.match(viewSource, /updateVehiclePathPreview/);
  assert.match(viewSource, /updateVehicleDeparturePathPreview/);
  assert.match(viewSource, /buildToStationPoints\(vehicle, target, tuning\)/);
  assert.match(viewSource, /buildOutStationPoints\(target, tuning\)/);
  assert.match(viewSource, /departureY = SCENE_TUNING\.vehicleDeparturePath\?\.y/);
  assert.match(viewSource, /mapMotionPoint\(sample\.position, departureY\)/);
});

test('Unity bus hit clips retain their authored directional keys', () => {
  const right = sampleHitClip('right', .1);
  const front = sampleHitClip('front', .1);
  assert.ok(Math.abs(right.rotationDegrees - 8.855473) < .001);
  assert.ok(Math.abs(front.rotationDegrees - -8.572966) < .001);
  assert.equal(right.rotationAxis, 'z');
  assert.equal(front.rotationAxis, 'x');
});

test('seat count board displays remaining passengers, not remaining groups', () => {
  const viewSource = readFileSync(join('src', 'scene-view.js'), 'utf8');
  assert.match(viewSource, /baseRemaining = Math\.max\(0, vehicle\.seats - vehicle\.boardedGroups\) \* LEVEL_1\.groupSize/);
  assert.match(viewSource, /boardingRemaining \+= 1/);
  assert.match(viewSource, /snapshot\.spots\[vehicle\.spotIndex\]\?\.vehicleId === vehicle\.id/);
});

test('matching groups board only an arrived same-color vehicle', () => {
  const game = new BusLoopGame();
  game.clickVehicle(LEVEL12_DISPATCH_ID);
  advance(game, .8);
  const vehicle = game.getVehicle(LEVEL12_DISPATCH_ID);
  assert.equal(vehicle.state, 'at-spot');
  const before = vehicle.boardedGroups;
  for (let i = 0; i < 300 && vehicle.boardedGroups === before; i += 1) game.update(0.05);
  assert.ok(vehicle.boardedGroups > before);
  assert.equal(game.snapshot().boardingEvents.at(-1).vehicleId, LEVEL12_DISPATCH_ID);
  assert.equal(game.getVehicle(7).boardedGroups, 0);
});

test('a full vehicle frees its spot and departs', () => {
  const game = new BusLoopGame();
  game.clickVehicle(LEVEL12_DISPATCH_ID);
  advance(game, .8);
  const vehicle = game.getVehicle(LEVEL12_DISPATCH_ID);
  vehicle.boardedGroups = vehicle.seats - 1;
  const slot = game.slots[0];
  slot.colorIndex = vehicle.colorIndex;
  slot.progress = LEVEL_1.exitStart;
  game.update(0.01);
  assert.equal(vehicle.state, 'boarding-final');
  advance(game, SCENE_TUNING.vehicleDeparturePath.fullLoadDelay + 0.1);
  assert.equal(vehicle.state, 'departing');
  assert.equal(game.spots[0].vehicleId, null);
});

test('full vehicle backs out below the parking spot before leaving', () => {
  const originalYaw = SCENE_TUNING.facing.parkingSpotYawDegrees;
  SCENE_TUNING.facing.parkingSpotYawDegrees = -30;
  try {
    const game = new BusLoopGame();
    game.clickVehicle(LEVEL12_DISPATCH_ID);
    advance(game, .8);
    const vehicle = game.getVehicle(LEVEL12_DISPATCH_ID);
    const target = game.getSpotPosition(0);
    vehicle.boardedGroups = vehicle.seats - 1;
    const slot = game.slots[0];
    slot.colorIndex = vehicle.colorIndex;
    slot.progress = LEVEL_1.exitStart;
    game.update(0.01);
    advance(game, SCENE_TUNING.vehicleDeparturePath.fullLoadDelay + 0.1);
    const data = vehicle.motionData;
    const firstSegment = data.backwardPath.segments[0];
    const forwardSegment = data.forwardPath.segments.at(-1);
    const rawPoints = buildOutStationPoints(target);
    assert.equal(target.visualApproachX, target.visualX);
    assert.ok(target.visualApproachZ > target.visualZ);
    assert.deepEqual(rawPoints[0], { x: target.x, z: target.z });
    assert.deepEqual(rawPoints[1], { x: target.approachX, z: target.approachZ });
    assert.ok(Math.abs(firstSegment.p0.x - target.x) < 1e-6);
    assert.ok(Math.abs(firstSegment.p0.z - target.z) < 1e-6);
    assert.ok(Math.abs(forwardSegment.p0.z - forwardSegment.p1.z) < 1e-6);
    assert.ok(forwardSegment.p1.x > forwardSegment.p0.x);
  } finally {
    SCENE_TUNING.facing.parkingSpotYawDegrees = originalYaw;
  }
});


test('vehicle departure path and full-load delay are scene-tunable', () => {
  const original = { ...SCENE_TUNING.vehicleDeparturePath };
  SCENE_TUNING.vehicleDeparturePath.fullLoadDelay = 0.25;
  SCENE_TUNING.vehicleDeparturePath.exitTargetX = 5.5;
  SCENE_TUNING.vehicleDeparturePath.exitTargetZOffset = 0.75;
  SCENE_TUNING.vehicleDeparturePath.exitTurnOffsetX = -0.9;
  try {
    const game = new BusLoopGame();
    game.clickVehicle(LEVEL12_DISPATCH_ID);
    advance(game, .8);
    const vehicle = game.getVehicle(LEVEL12_DISPATCH_ID);
    vehicle.boardedGroups = vehicle.seats - 1;
    const slot = game.slots[0];
    slot.colorIndex = vehicle.colorIndex;
    slot.progress = LEVEL_1.exitStart;
    game.update(0.01);
    assert.equal(vehicle.state, 'boarding-final');
    advance(game, 0.3);
    assert.equal(vehicle.state, 'departing');
    const forwardSegment = vehicle.motionData.forwardPath.segments.at(-1);
    assert.equal(forwardSegment.p1.x, 5.5);
    assert.ok(Math.abs(forwardSegment.p1.z - (forwardSegment.p0.z + 0.75)) < 1e-6);
  } finally {
    Object.assign(SCENE_TUNING.vehicleDeparturePath, original);
  }
});

test('Unity conveyor failure rule triggers on a deadlocked full station', () => {
  const game = new BusLoopGame();
  assert.equal(game.spots.length, 6);
  for (let i = 0; i < game.spots.length; i += 1) game.spots[i].vehicleId = 1000 + i;
  for (const queue of game.sourceQueues) queue.length = 0;
  for (const queue of game.queues) queue.length = 0;
  for (const slot of game.slots) slot.colorIndex = 0;
  game.checkEndState();
  assert.equal(game.status, 'lost');
});

test('level12 initial movable cars reserve the first parking spots', () => {
  const game = new BusLoopGame();
  for (const id of LEVEL12_INITIAL_MOVABLE_IDS) {
    assert.equal(game.clickVehicle(id).ok, true, `vehicle ${id} should be movable`);
  }
  assert.equal(game.spots.length, 6);
  assert.deepEqual(game.snapshot().spots.slice(0, LEVEL12_INITIAL_MOVABLE_IDS.length).map((spot) => spot.vehicleId), LEVEL12_INITIAL_MOVABLE_IDS);
  assert.deepEqual(
    LEVEL_1.vehicles
      .filter((vehicle) => game.getBlockers(vehicle.id).length === 0 && vehicle.state === 'parked')
      .map((vehicle) => vehicle.id),
    [3, 6, 33, 35, 38]
  );
});



test('parking spot visual scale changes do not move the authored vehicle path center', () => {
  const original = {
    scaleX: SCENE_TUNING.parkingSpots.scaleX,
    scaleZ: SCENE_TUNING.parkingSpots.scaleZ,
    yaw: SCENE_TUNING.facing.parkingSpotYawDegrees
  };
  SCENE_TUNING.parkingSpots.scaleX = 1.6;
  SCENE_TUNING.parkingSpots.scaleZ = 0.7;
  SCENE_TUNING.facing.parkingSpotYawDegrees = 25;
  try {
    const game = new BusLoopGame();
    const target = game.getSpotPosition(2);
    const mappedCenter = mapVehicleAreaPoint(target);
    assert.ok(Math.abs(mappedCenter.x - target.visualX) < 1e-6);
    assert.ok(Math.abs(mappedCenter.z - target.visualZ) < 1e-6);
  } finally {
    SCENE_TUNING.parkingSpots.scaleX = original.scaleX;
    SCENE_TUNING.parkingSpots.scaleZ = original.scaleZ;
    SCENE_TUNING.facing.parkingSpotYawDegrees = original.yaw;
  }
});

test('main thread saves and restores scene tuning from localStorage', () => {
  const mainSource = readFileSync(join('src', 'main.js'), 'utf8');
  assert.match(mainSource, /bus-loop-scene-tuning-v3/);
  assert.match(mainSource, /bus-loop-scene-tuning-v2/);
  assert.match(mainSource, /LEGACY_TUNING_STORAGE_KEY/);
  assert.match(mainSource, /function deepMerge/);
  assert.match(mainSource, /classList\.toggle\('is-phone-preview', EDITOR_ENABLED && Boolean\(preview\?\.enabled\)\)/);
  assert.match(mainSource, /function loadSavedTuning\(\) \{\s+if \(!EDITOR_ENABLED\) return;/);
  assert.match(mainSource, /deepMerge\(SCENE_TUNING, JSON\.parse\(saved\)\)/);
  assert.match(mainSource, /delete legacy\.vehicleArea/);
  assert.match(mainSource, /localStorage\.setItem/);
  assert.match(mainSource, /localStorage\.getItem/);
  assert.match(mainSource, /function writeTuning\(value\) \{\s+if \(!EDITOR_ENABLED\) return;/);
  assert.match(mainSource, /function clearSavedTuning\(\) \{\s+if \(!EDITOR_ENABLED\) return;/);
  assert.match(mainSource, /clearSavedTuning/);
  assert.match(mainSource, /isPassengerMaterialTuningPath/);
  assert.match(mainSource, /PASSENGER_MATERIAL_TUNING_PREFIX = 'passengerMaterial\.'/);
  assert.match(mainSource, /PASSENGER_MATERIAL_COLOR_INDEX_PATTERN/);
  assert.match(mainSource, /getPassengerMaterialColorIndex/);
  assert.match(mainSource, /startsWith\(PASSENGER_MATERIAL_TUNING_PREFIX\)/);
  assert.match(mainSource, /mode: materialOnly \? 'passengerMaterial' : 'full', colorIndex/);
  assert.match(mainSource, /setTimeout\(flushTuningSave, 150\)/);
  assert.match(mainSource, /beforeunload', flushTuningSave/);
  assert.match(mainSource, /if \(!materialOnly\) \{/);
  assert.match(mainSource, /game\.initializeQueues\(view\.getQueueCapacities\(\), view\.getQueueSpacing\(\), view\.getQueueLengths\(\), view\.getConveyorPathLength\(\)\)/);
  assert.match(mainSource, /createGameAudioController\(LEVEL_1\.assets\.audio\)/);
  assert.match(mainSource, /audio\.handleGameEvent\(state\.lastEvent, state\.time\)/);
  assert.match(mainSource, /audio\.playPassengerUp\(\)/);
  assert.match(mainSource, /audio\.unlock\(\)/);
  assert.match(mainSource, /loadingScreen/);
  assert.match(mainSource, /updateLoadingProgress/);
  assert.match(mainSource, /loadingProgressBar\.style\.width/);
  assert.match(mainSource, /view\.ready\?\.finally/);
  assert.match(mainSource, /updateLoadingProgress\(1\)/);
  assert.match(mainSource, /loadingScreen\?\.classList\.add\('is-hidden'\)/);
  assert.match(mainSource, /const ctaButton = \$\('#cta-button'\)/);
  assert.match(mainSource, /web: 'https:\/\/play\.google\.com\/store\/apps\/details\?id=gridplus\.busjam\.carpuzzle'/);
  assert.match(mainSource, /web: 'https:\/\/apps\.apple\.com\/app\/id6746743297'/);
  assert.match(mainSource, /itms-apps:\/\/itunes\.apple\.com\/app\/id6746743297/);
  assert.match(mainSource, /STORE_OPEN_COOLDOWN_MS = 800/);
  assert.match(mainSource, /MAX_NUMBER_COUNT_BUS = 10/);
  assert.match(mainSource, /function applyCtaTuning/);
  assert.match(mainSource, /function InstallFullGame/);
  assert.match(mainSource, /let lastStoreOpenAt = 0/);
  assert.match(mainSource, /let storeOpenAttempts = 0/);
  assert.match(mainSource, /function isIOSDevice\(\)/);
  assert.match(mainSource, /Macintosh/);
  assert.match(mainSource, /navigator\.maxTouchPoints > 1/);
  assert.match(mainSource, /function getStoreTarget\(\)/);
  assert.match(mainSource, /function getMraidStoreUrl\(target\)/);
  assert.match(mainSource, /function openStore\(\)/);
  assert.match(mainSource, /now - lastStoreOpenAt < STORE_OPEN_COOLDOWN_MS/);
  assert.match(mainSource, /const target = getStoreTarget\(\)/);
  assert.match(mainSource, /storeOpenAttempts \+= 1/);
  assert.match(mainSource, /function waitForMraidReady\(onReady\)/);
  assert.match(mainSource, /mraid\.getState\(\)/);
  assert.match(mainSource, /state === 'loading'/);
  assert.match(mainSource, /mraid\.addEventListener\('ready', startOnce\)/);
  assert.match(mainSource, /state === 'default'/);
  assert.match(mainSource, /waitForMraidReady\(startRuntime\)/);
  assert.match(mainSource, /window\.mraid\?\.open/);
  assert.match(mainSource, /window\.mraid\.open\(url\)/);
  assert.match(mainSource, /window\.open\(target\.web, '_blank', 'noopener'\)/);
  assert.match(mainSource, /let numberCountBus = 0/);
  assert.match(mainSource, /let isFinish = false/);
  assert.match(mainSource, /countedInstallVehicles = new Set\(\)/);
  assert.match(mainSource, /INSTALL_GATE_VEHICLE_STATES = new Set\(\['at-spot', 'boarding-final', 'departing', 'done'\]\)/);
  assert.match(mainSource, /const markInstallVehicle = \(vehicleId\) => \{/);
  assert.match(mainSource, /countedInstallVehicles\.has\(vehicleId\)/);
  assert.match(mainSource, /const handleVehicleClick = \(vehicleId\) => \{/);
  assert.match(mainSource, /const result = game\.clickVehicle\(vehicleId\)/);
  assert.match(mainSource, /result\?\.ok && markInstallVehicle\(vehicleId\)/);
  assert.match(mainSource, /function updateInstallGate\(state\)/);
  assert.match(mainSource, /for \(const vehicle of state\.vehicles \?\? \[\]\)/);
  assert.match(mainSource, /countedInstallVehicles\.has\(vehicle\.id\)/);
  assert.match(mainSource, /markInstallVehicle\(vehicle\.id\)/);
  assert.match(mainSource, /numberCountBus \+= 1/);
  assert.match(mainSource, /numberCountBus >= MAX_NUMBER_COUNT_BUS/);
  assert.match(mainSource, /if \(isFinish\) \{/);
  assert.match(mainSource, /stopImmediatePropagation\(\)/);
  assert.match(mainSource, /ctaButton\?\.addEventListener\('click', \(event\) => \{/);
  assert.match(mainSource, /event\.stopPropagation\(\)/);
  assert.match(mainSource, /installState: \(\) => \(\{ numberCountBus, maxNumberCountBus: MAX_NUMBER_COUNT_BUS, isFinish \}\)/);
  assert.match(mainSource, /height \* \(Number\(cta\.stretchX\)/);
  assert.match(mainSource, /Number\.isFinite\(Number\(cta\.x\)\)/);
  assert.match(mainSource, /Number\.isFinite\(Number\(cta\.y\)\)/);
  assert.match(mainSource, /Number\(cta\.worldX\)/);
  assert.match(mainSource, /Number\(cta\.worldZ\)/);
  assert.match(mainSource, /projectWorldToCanvas/);
  assert.match(mainSource, /function cssPx\(value\)/);
  assert.match(mainSource, /--cta-width', cssPx\(width\)/);
  assert.match(mainSource, /--cta-height', cssPx\(height\)/);
  assert.match(mainSource, /--cta-font-size', cssPx\(fontSize\)/);
  assert.match(mainSource, /--cta-stroke-width', cssPx\(Math\.max\(0, Number\(cta\.strokeWidth\) \|\| 0\)\)/);
  assert.match(mainSource, /const stageRect = stage\?\.getBoundingClientRect\(\)/);
  assert.match(mainSource, /const positionScale = getStagePositionScale\(stageWidth, designWidth\)/);
  assert.match(mainSource, /worldPosition\?\.x \?\? stageWidth \/ 2 \+ \(centerX - designWidth \/ 2\) \* positionScale/);
  assert.match(mainSource, /worldPosition\?\.y \?\? stageHeight \/ 2 \+ \(centerY - designHeight \/ 2\) \* positionScale/);
  assert.match(mainSource, /--cta-font-height/);
  assert.match(mainSource, /--cta-stroke-color/);
  assert.match(mainSource, /--cta-pulse-duration/);
  assert.match(mainSource, /const updateCtaPosition = \(\) => \{/);
  assert.match(mainSource, /applyCtaTuning\(view\)/);
  assert.match(mainSource, /updateCtaPosition\(\)/);
});
