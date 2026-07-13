import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as THREE from 'three';

import { BusLoopGame } from '../src/game-model.js';
import { COLORS, LEVEL_1 } from '../src/level-data.js';
import { SceneView } from '../src/scene-view.js';
import { SCENE_TUNING } from '../src/scene-tuning.js';
import * as questionPassengerMechanic from '../src/mechanics/question-passenger/index.js';
import { createQuestionPassengerRuntime } from '../src/mechanics/question-passenger/model.js';
import { createQuestionPassengerDetailView } from '../src/mechanics/question-passenger/view.js';

const sceneSource = readFileSync(join('src', 'scene-view.js'), 'utf8');

function getSourceSection(startMarker, endMarker) {
  const start = sceneSource.indexOf(startMarker);
  assert.notEqual(start, -1, `missing scene source marker: ${startMarker}`);
  const end = sceneSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing scene source marker: ${endMarker}`);
  return sceneSource.slice(start, end);
}

function makeBadges(opacity = 0.25) {
  return Array.from({ length: 4 }, () => ({
    visible: false,
    material: { opacity }
  }));
}

function makeAppearanceScene(passengerColorTextures = []) {
  return {
    passengerColorTextures,
    setQuestionPassengerBadgesVisible: SceneView.prototype.setQuestionPassengerBadgesVisible
  };
}

function makeRevealView(baseScale = 1.4) {
  const view = new THREE.Group();
  view.scale.setScalar(baseScale);
  view.userData.questionRevealBaseScale = baseScale;
  const badges = Array.from({ length: 4 }, () => {
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 1 }));
    badge.visible = false;
    view.add(badge);
    return badge;
  });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0 }));
  flash.scale.set(0.72, 0.72, 1);
  flash.visible = false;
  view.add(flash);
  view.userData.questionBadges = badges;
  view.userData.questionRevealFlash = flash;
  return { view, badges, flash, baseScale };
}

function makeRevealScene(reducedMotion = false) {
  return {
    reducedMotionQuery: { matches: reducedMotion },
    setQuestionPassengerBadgesVisible: SceneView.prototype.setQuestionPassengerBadgesVisible
  };
}

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

function makeVatView(material, colorIndex, hidden = null) {
  return {
    userData: {
      modelReady: true,
      colorIndex,
      questionPassengerHidden: hidden,
      questionBadges: makeBadges(),
      personSlots: [{ userData: { vatMaterial: material } }]
    }
  };
}

function makeLevel(authoredMasks = [[true, false], [false, true]]) {
  return {
    mechanics: {
      'question-passenger': { authoredMasks }
    }
  };
}

test('level12 provides frozen authored question-passenger masks', () => {
  const questionConfig = LEVEL_1.mechanics['question-passenger'];
  const authoredMasks = questionConfig.authoredMasks;
  const authoredResidues = [[0, 3, 7], [1, 5, 8]];

  assert.equal(authoredMasks.length, 2);
  assert.deepEqual(
    authoredMasks.map((row) => row.length),
    LEVEL_1.passengerQueues.map((row) => row.length)
  );
  assert.equal(authoredMasks.every((row) => row.every((value) => typeof value === 'boolean')), true);
  assert.equal(authoredMasks.flat().filter(Boolean).length, 132);
  assert.equal(authoredMasks.flat().length, 438);
  authoredMasks.forEach((row, queueIndex) => {
    row.forEach((value, sourceIndex) => {
      assert.equal(
        value,
        authoredResidues[queueIndex].includes(sourceIndex % 10),
        `queue ${queueIndex} mask at source index ${sourceIndex}`
      );
    });
  });
  assert.equal(Object.isFrozen(authoredMasks), true);
  assert.equal(authoredMasks.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(questionConfig), true);
  assert.equal(Object.isFrozen(LEVEL_1.mechanics), true);
});

test('level12 authored mode follows fixed masks without calling random', () => {
  const runtime = createQuestionPassengerRuntime({
    level: LEVEL_1,
    options: { mode: 'authored' },
    random() {
      throw new Error('authored mode must not call random');
    }
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'authored',
      chance: 0.3,
      authoredMarked: 132,
      authoredTotal: 438
    }
  });
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 0 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }).questionPassenger.hidden, true);
});

test('chance mode defaults to 30% and uses a strict lower bound', () => {
  const randomValues = [0.2999, 0.3];
  const runtime = questionPassengerMechanic.createRuntime({
    random: () => randomValues.shift(),
    level: makeLevel()
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'chance',
      chance: 0.3,
      authoredMarked: 2,
      authoredTotal: 4
    }
  });
  assert.deepEqual(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }), {
    questionPassenger: {
      hidden: true,
      wasHidden: true,
      revealVersion: 0
    }
  });
  assert.deepEqual(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }), {
    questionPassenger: {
      hidden: false,
      wasHidden: false,
      revealVersion: 0
    }
  });
});

test('authored mode uses only strict true masks and never calls random', () => {
  let randomCalls = 0;
  const runtime = questionPassengerMechanic.createRuntime({
    random: () => {
      randomCalls += 1;
      return 0;
    },
    level: makeLevel([[true, 1, false], [false, true]]),
    options: { mode: 'authored' }
  });

  assert.deepEqual(runtime.createState(), {
    questionPassenger: {
      mode: 'authored',
      chance: 0.3,
      authoredMarked: 2,
      authoredTotal: 5
    }
  });
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 1, sourceIndex: 1 }).questionPassenger.hidden, true);
  assert.equal(runtime.createQueueItemData({ queueIndex: 2, sourceIndex: 0 }).questionPassenger.hidden, false);
  assert.equal(runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 99 }).questionPassenger.hidden, false);
  assert.equal(randomCalls, 0);
});

test('authored masks require array rows from the exact configuration path', () => {
  const missingLevelState = questionPassengerMechanic.createRuntime().createState().questionPassenger;
  assert.equal(missingLevelState.authoredMarked, 0);
  assert.equal(missingLevelState.authoredTotal, 0);

  const missingMasksState = questionPassengerMechanic.createRuntime({
    level: { mechanics: { 'question-passenger': {} } }
  }).createState().questionPassenger;
  assert.equal(missingMasksState.authoredMarked, 0);
  assert.equal(missingMasksState.authoredTotal, 0);

  const nonArrayMasksState = questionPassengerMechanic.createRuntime({
    level: makeLevel('bad')
  }).createState().questionPassenger;
  assert.equal(nonArrayMasksState.authoredMarked, 0);
  assert.equal(nonArrayMasksState.authoredTotal, 0);

  const mixedRowsRuntime = questionPassengerMechanic.createRuntime({
    level: makeLevel([[true, false], { 0: true }, [true, 1]]),
    options: { mode: 'authored' }
  });
  const mixedRowsState = mixedRowsRuntime.createState().questionPassenger;
  assert.equal(mixedRowsState.authoredMarked, 2);
  assert.equal(mixedRowsState.authoredTotal, 4);
  assert.equal(
    mixedRowsRuntime.createQueueItemData({ queueIndex: 1, sourceIndex: 0 }).questionPassenger.hidden,
    false
  );

  const wrongPathState = questionPassengerMechanic.createRuntime({
    level: {
      authoredMasks: [[true]],
      mechanics: {
        authoredMasks: [[true]],
        questionPassenger: { authoredMasks: [[true]] }
      }
    }
  }).createState().questionPassenger;
  assert.equal(wrongPathState.authoredMarked, 0);
  assert.equal(wrongPathState.authoredTotal, 0);
});

test('mode and chance options normalize to safe chance assignment', () => {
  const invalidRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0.2999,
    options: { mode: 'invalid', chance: Number.NaN }
  });
  assert.equal(invalidRuntime.createState().questionPassenger.mode, 'chance');
  assert.equal(invalidRuntime.createState().questionPassenger.chance, 0.3);
  assert.equal(invalidRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);

  const belowRangeRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0,
    options: { chance: -2 }
  });
  assert.equal(belowRangeRuntime.createState().questionPassenger.chance, 0);
  assert.equal(belowRangeRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, false);

  const aboveRangeRuntime = questionPassengerMechanic.createRuntime({
    random: () => 0.999,
    options: { chance: 4 }
  });
  assert.equal(aboveRangeRuntime.createState().questionPassenger.chance, 1);
  assert.equal(aboveRangeRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);

  const coercedRandomValues = [0.4499, 0.45];
  const coercedRuntime = questionPassengerMechanic.createRuntime({
    random: () => coercedRandomValues.shift(),
    options: { chance: '0.45' }
  });
  assert.equal(coercedRuntime.createState().questionPassenger.chance, 0.45);
  assert.equal(coercedRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 }).questionPassenger.hidden, true);
  assert.equal(coercedRuntime.createQueueItemData({ queueIndex: 0, sourceIndex: 1 }).questionPassenger.hidden, false);

  const positiveInfinityRuntime = questionPassengerMechanic.createRuntime({
    options: { chance: Number.POSITIVE_INFINITY }
  });
  assert.equal(positiveInfinityRuntime.createState().questionPassenger.chance, 0.3);

  const negativeInfinityRuntime = questionPassengerMechanic.createRuntime({
    options: { chance: Number.NEGATIVE_INFINITY }
  });
  assert.equal(negativeInfinityRuntime.createState().questionPassenger.chance, 0.3);
});

test('runtime exposes mechanic identity and empty slot metadata', () => {
  const runtime = questionPassengerMechanic.createRuntime();

  assert.equal(runtime.id, 'question-passenger');
  assert.deepEqual(runtime.createSlotData(), { questionPassenger: null });
  assert.equal(questionPassengerMechanic.definition.status, 'playable');
  assert.equal(questionPassengerMechanic.default.definition, questionPassengerMechanic.definition);
  assert.equal(questionPassengerMechanic.default.createRuntime, questionPassengerMechanic.createRuntime);
  assert.equal(questionPassengerMechanic.createDetailView, createQuestionPassengerDetailView);
  assert.equal(questionPassengerMechanic.default.createDetailView, createQuestionPassengerDetailView);
});

test('scene neutralizes hidden passenger materials with the exact question appearance', () => {
  const helper = getSourceSection(
    'function applyQuestionPassengerMaterial(material)',
    'async function loadVatGeometry'
  );

  assert.match(helper, /setPassengerMaterialMaps\(material, null, null\)/);
  assert.match(helper, /material\.color\.setHex\(0x9da8b8\)/);
  assert.match(helper, /material\.emissive\.setHex\(0x303946\)/);
  assert.match(helper, /material\.emissiveIntensity = 0\.18/);
  assert.match(helper, /material\.roughness = 0\.72/);
  assert.match(helper, /material\.metalness = 0/);
  assert.match(helper, /material\.userData\.passengerColorIndex = null/);
});

test('scene builds four independent question sprites over passenger positions from one shared texture', () => {
  const badgeHelpers = getSourceSection(
    'let questionPassengerBadgeTexture = null;',
    'function makeStarBadgeLabel'
  );
  const passengerGroup = getSourceSection('function makePassengerGroup', 'export class SceneView');

  assert.match(badgeHelpers, /function getQuestionPassengerBadgeTexture\(\)/);
  assert.match(badgeHelpers, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(badgeHelpers, /context\.arc\([\s\S]*?context\.fillStyle = '#ffffff'[\s\S]*?context\.strokeStyle = '#263244'/);
  assert.match(badgeHelpers, /context\.fillText\('\?',/);
  assert.match(badgeHelpers, /for \(let index = 0; index < 4; index \+= 1\)/);
  assert.match(badgeHelpers, /new THREE\.SpriteMaterial\(\{[\s\S]*?map: getQuestionPassengerBadgeTexture\(\),[\s\S]*?transparent: true,[\s\S]*?depthTest: false,[\s\S]*?depthWrite: false,[\s\S]*?toneMapped: false/);
  assert.match(badgeHelpers, /new THREE\.Sprite\(material\)/);
  assert.match(badgeHelpers, /sprite\.position\.set\(\(index - 1\.5\) \* spacing,/);
  assert.match(badgeHelpers, /sprite\.renderOrder = 90/);
  assert.match(passengerGroup, /const questionBadges = makeQuestionPassengerBadges\(spacing\)/);
  assert.match(passengerGroup, /group\.userData\.questionBadges = questionBadges/);
  assert.match(passengerGroup, /group\.add\(\.\.\.questionBadges\)/);
});

test('question reveal starts once, pulses midway, and cleans without restarting', () => {
  const { view, badges, flash, baseScale } = makeRevealView();
  const scene = makeRevealScene();
  const state = { wasHidden: true, revealVersion: 1 };

  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 10, 41);
  assert.equal(view.userData.questionPassengerId, 41);
  assert.equal(view.userData.questionPassengerRevealVersion, 1);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 10);

  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 10.125, 41);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 10);
  assert.ok(view.scale.x > baseScale);
  assert.equal(flash.visible, true);
  assert.ok(flash.material.opacity > 0 && flash.material.opacity < 1);
  assert.equal(badges.every((badge) => badge.visible), true);
  assert.equal(badges.every((badge) => badge.material.opacity > 0 && badge.material.opacity < 1), true);

  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 10.25, 41);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 10);
  assertClose(view.scale.x, baseScale);
  assert.equal(flash.visible, false);
  assert.equal(flash.material.opacity, 0);
  assert.equal(badges.every((badge) => !badge.visible && badge.material.opacity === 1), true);

  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 30, 41);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 10);
  assertClose(view.scale.x, baseScale);
  assert.equal(flash.visible, false);
});

test('question reveal retriggers only for a higher hidden reveal version', () => {
  const { view, badges, flash, baseScale } = makeRevealView();
  const scene = makeRevealScene();

  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: false, revealVersion: 1 },
    3,
    7
  );
  assert.equal(view.userData.questionPassengerRevealStartedAt, -Infinity);
  assertClose(view.scale.x, baseScale);
  assert.equal(flash.visible, false);

  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 0 },
    4,
    8
  );
  assert.equal(view.userData.questionPassengerRevealStartedAt, -Infinity);
  assert.equal(badges.every((badge) => !badge.visible), true);

  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 1 },
    5,
    8
  );
  assert.equal(view.userData.questionPassengerRevealVersion, 1);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 5);
  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 1 },
    5.25,
    8
  );
  assert.equal(flash.visible, false);
  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 2 },
    6,
    8
  );
  assert.equal(view.userData.questionPassengerRevealVersion, 2);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 6);
  assert.equal(flash.visible, true);
});

test('reduced-motion question reveal preserves group and flash transforms while fading', () => {
  const { view, badges, flash, baseScale } = makeRevealView(1.75);
  const scene = makeRevealScene(true);

  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 1 },
    12,
    19
  );
  const flashScale = flash.scale.clone();
  SceneView.prototype.updateQuestionPassengerReveal.call(
    scene,
    view,
    { wasHidden: true, revealVersion: 1 },
    12.125,
    19
  );

  assertClose(view.scale.x, baseScale);
  assert.deepEqual(flash.scale.toArray(), flashScale.toArray());
  assert.equal(flash.visible, true);
  assert.ok(flash.material.opacity > 0 && flash.material.opacity < 1);
  assert.equal(badges.every((badge) => badge.material.opacity > 0 && badge.material.opacity < 1), true);
});

test('resetQuestionPassengerReveal clears all transient state and badge opacity', () => {
  const { view, badges, flash, baseScale } = makeRevealView(1.2);
  view.scale.setScalar(1.8);
  view.userData.questionPassengerId = 9;
  view.userData.questionPassengerRevealVersion = 3;
  view.userData.questionPassengerRevealStartedAt = 15;
  flash.visible = true;
  flash.material.opacity = 0.4;
  flash.scale.set(1.4, 1.4, 1);
  badges.forEach((badge) => {
    badge.visible = true;
    badge.material.opacity = 0.3;
  });

  SceneView.prototype.resetQuestionPassengerReveal.call(
    makeRevealScene(),
    view,
    baseScale
  );

  assert.equal(view.userData.questionPassengerId, null);
  assert.equal(view.userData.questionPassengerRevealVersion, null);
  assert.equal(view.userData.questionPassengerRevealStartedAt, -Infinity);
  assertClose(view.scale.x, baseScale);
  assert.equal(flash.visible, false);
  assert.equal(flash.material.opacity, 0);
  assert.equal(badges.every((badge) => !badge.visible && badge.material.opacity === 1), true);
});

test('reset generation clears reveal deduplication before reused passenger ids render', () => {
  const { view, flash } = makeRevealView();
  const scene = {
    ...makeRevealScene(),
    passengerViews: [view],
    lastSeenResetVersion: null,
    resetQuestionPassengerReveal: SceneView.prototype.resetQuestionPassengerReveal
  };
  const state = { wasHidden: true, revealVersion: 1 };

  SceneView.prototype.syncQuestionPassengerRevealResetVersion.call(scene, 1);
  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 7, 1);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 7);

  SceneView.prototype.syncQuestionPassengerRevealResetVersion.call(scene, 1);
  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 7.1, 1);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 7);

  SceneView.prototype.syncQuestionPassengerRevealResetVersion.call(scene, 2);
  assert.equal(view.userData.questionPassengerId, null);
  assert.equal(view.userData.questionPassengerRevealVersion, null);
  assert.equal(view.userData.questionPassengerRevealStartedAt, -Infinity);
  assert.equal(flash.visible, false);

  SceneView.prototype.updateQuestionPassengerReveal.call(scene, view, state, 0.2, 1);
  assert.equal(view.userData.questionPassengerRevealStartedAt, 0.2);
});

test('scene caches hidden appearance and restores fallback or Unity colors without leaking badges', () => {
  const appearance = getSourceSection(
    '  setPassengerAppearance(view, colorIndex, hidden = false)',
    '  updateStarPassengerBadge'
  );

  assert.match(appearance, /view\.userData\.colorIndex === colorIndex\s*&&\s*view\.userData\.questionPassengerHidden === questionPassengerHidden/);
  assert.match(appearance, /view\.userData\.colorIndex = colorIndex/);
  assert.match(appearance, /view\.userData\.questionPassengerHidden = questionPassengerHidden/);
  assert.match(appearance, /this\.setQuestionPassengerBadgesVisible\(view, questionPassengerHidden\)/);
  assert.match(appearance, /applyQuestionPassengerMaterial\(fallbackMaterial\)/);
  assert.match(appearance, /fallbackMaterial\.color\.setHex\(COLORS\[colorIndex\]\.hex\)/);
  assert.match(appearance, /applyQuestionPassengerMaterial\(material\)/);
  assert.match(appearance, /applyPassengerMaterial\(material, colorIndex, map\)/);
  assert.match(appearance, /badge\.material\.opacity = 1/);
  assert.match(appearance, /view\.userData\.colorIndex = null/);
  assert.match(appearance, /view\.userData\.questionPassengerHidden = null/);
});

test('scene keeps queue questions hidden, belt colors real, and clears reused invisible views', () => {
  const update = getSourceSection('  update(snapshot, game)', '  updateGuideHandTuning()');
  const beltUpdate = update.slice(0, update.indexOf('    const queueSnapshots'));
  const queueUpdate = update.slice(update.indexOf('    const queueSnapshots'));

  assert.match(update, /this\.setPassengerAppearance\(view, slot\.colorIndex, false\)/);
  assert.match(beltUpdate, /this\.setPassengerAppearance\(view, slot\.colorIndex, false\);[\s\S]*?this\.updateQuestionPassengerReveal\(view, slot\.questionPassenger, snapshot\.time, slot\.passengerId\)/);
  assert.match(update, /this\.setPassengerAppearance\(view, colorIndex, Boolean\(item\.questionPassenger\?\.hidden\)\)/);
  assert.doesNotMatch(queueUpdate, /updateQuestionPassengerReveal/);
  assert.equal((update.match(/this\.resetPassengerAppearance\(view\)/g) ?? []).length, 2);
});

test('scene synchronizes reset generations before processing snapshot time or slots', () => {
  const update = getSourceSection('  update(snapshot, game)', '  updateGuideHandTuning()');
  const syncIndex = update.indexOf(
    'this.syncQuestionPassengerRevealResetVersion(snapshot.resetVersion)'
  );
  const timeIndex = update.indexOf('const previousUpdateTime');
  const slotsIndex = update.indexOf('for (const slot of snapshot.slots)');

  assert.ok(syncIndex >= 0);
  assert.ok(syncIndex < timeIndex);
  assert.ok(syncIndex < slotsIndex);
});

test('question reveal scene contract uses one shared radial texture and exact duration', () => {
  const revealHelpers = getSourceSection(
    'function getQuestionPassengerRevealTexture()',
    'function makeStarBadgeLabel'
  );
  assert.match(sceneSource, /const QUESTION_PASSENGER_REVEAL_DURATION = 0\.25/);
  assert.match(sceneSource, /let questionPassengerRevealTexture = null/);
  assert.match(revealHelpers, /createRadialGradient/);
  assert.match(revealHelpers, /new THREE\.SpriteMaterial\(\{[\s\S]*?map: getQuestionPassengerRevealTexture\(\)/);
  assert.match(revealHelpers, /transparent: true,[\s\S]*?depthTest: false,[\s\S]*?depthWrite: false,[\s\S]*?toneMapped: false/);
  assert.match(revealHelpers, /const sprite = new THREE\.Sprite\(material\)/);
  assert.match(sceneSource, /group\.userData\.questionRevealFlash = questionRevealFlash/);
});

test('scene resynchronizes question badges and targets material tuning to visible matching roots', () => {
  const visualTuning = getSourceSection(
    '  updatePassengerVisualTuning()',
    '  updatePassengerMaterialTuning'
  );
  const materialTuning = getSourceSection(
    '  updatePassengerMaterialTuning',
    '  upgradePassengerViews()'
  );

  assert.match(visualTuning, /root\.userData\.questionBadges\?\.forEach\(\(badge, index\) => \{[\s\S]*?badge\.position\.x = \(index - 1\.5\) \* spacing/);
  assert.match(materialTuning, /if \(root\.userData\.questionPassengerHidden === true\) continue/);
  assert.match(materialTuning, /const rootColorIndex = [\s\S]*?root\.userData\.colorIndex/);
  assert.match(materialTuning, /if \(!shouldUpdateColor\(rootColorIndex\)\) continue/);
  assert.match(materialTuning, /applyPassengerMaterial\(material, rootColorIndex, map\)[\s\S]*?root\.userData\.questionPassengerHidden = null/);
});

test('setPassengerAppearance restores fallback colors around a hidden neutral transition', () => {
  const material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    roughness: 0.1,
    metalness: 0.8
  });
  material.map = new THREE.Texture();
  material.emissiveMap = new THREE.Texture();
  const badges = makeBadges();
  const view = {
    userData: {
      modelReady: false,
      colorIndex: null,
      questionPassengerHidden: null,
      questionBadges: badges,
      personSlots: [{ userData: { fallback: { material } } }]
    }
  };
  const scene = makeAppearanceScene();

  SceneView.prototype.setPassengerAppearance.call(scene, view, 3, false);
  assert.equal(material.color.getHex(), COLORS[3].hex);
  assert.equal(material.emissive.getHex(), 0x000000);
  assert.equal(material.roughness, 0.62);
  assert.equal(material.userData.passengerColorIndex, 3);
  assert.equal(badges.every((badge) => !badge.visible && badge.material.opacity === 1), true);

  badges.forEach((badge) => { badge.material.opacity = 0.2; });
  SceneView.prototype.setPassengerAppearance.call(scene, view, 3, true);
  assert.equal(material.map, null);
  assert.equal(material.emissiveMap, null);
  assert.equal(material.color.getHex(), 0x9da8b8);
  assert.equal(material.emissive.getHex(), 0x303946);
  assert.equal(material.emissiveIntensity, 0.18);
  assert.equal(material.roughness, 0.72);
  assert.equal(material.metalness, 0);
  assert.equal(material.userData.passengerColorIndex, null);
  assert.equal(badges.every((badge) => badge.visible && badge.material.opacity === 1), true);

  badges.forEach((badge) => { badge.material.opacity = 0.4; });
  SceneView.prototype.setPassengerAppearance.call(scene, view, 3, false);
  assert.equal(material.color.getHex(), COLORS[3].hex);
  assert.equal(material.emissive.getHex(), 0x000000);
  assert.equal(material.userData.passengerColorIndex, 3);
  assert.equal(badges.every((badge) => !badge.visible && badge.material.opacity === 1), true);
});

test('setPassengerAppearance removes and restores VAT color maps and tuned material values', () => {
  const colorIndex = 2;
  const colorTexture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial();
  const view = makeVatView(material, null, null);
  const scene = makeAppearanceScene(Array.from({ length: colorIndex + 1 }, (_, index) => (
    index === colorIndex ? colorTexture : new THREE.Texture()
  )));

  SceneView.prototype.setPassengerAppearance.call(scene, view, colorIndex, false);
  assert.equal(material.map, colorTexture);
  assert.equal(material.emissiveMap, colorTexture);
  assert.equal(material.emissiveIntensity, SCENE_TUNING.passengerMaterial.emissionStrength);
  assert.equal(material.roughness, SCENE_TUNING.passengerMaterial.roughness);
  assert.equal(material.userData.passengerColorIndex, colorIndex);

  SceneView.prototype.setPassengerAppearance.call(scene, view, colorIndex, true);
  assert.equal(material.map, null);
  assert.equal(material.emissiveMap, null);
  assert.equal(material.color.getHex(), 0x9da8b8);
  assert.equal(material.userData.passengerColorIndex, null);

  SceneView.prototype.setPassengerAppearance.call(scene, view, colorIndex, false);
  assert.equal(material.map, colorTexture);
  assert.equal(material.emissiveMap, colorTexture);
  assert.equal(material.emissiveIntensity, SCENE_TUNING.passengerMaterial.emissionStrength);
  assert.equal(material.roughness, SCENE_TUNING.passengerMaterial.roughness);
  assert.equal(material.userData.passengerColorIndex, colorIndex);
});

test('appearance cache invalidation restores a reused view and resets question badges', () => {
  const material = new THREE.MeshStandardMaterial();
  const badges = makeBadges();
  const view = {
    scale: new THREE.Vector3(1, 1, 1),
    userData: {
      modelReady: false,
      colorIndex: null,
      questionPassengerHidden: null,
      questionBadges: badges,
      personSlots: [{ userData: { fallback: { material } } }]
    }
  };
  const scene = makeAppearanceScene();

  SceneView.prototype.setPassengerAppearance.call(scene, view, 1, false);
  material.color.setHex(0x123456);
  badges.forEach((badge) => {
    badge.visible = true;
    badge.material.opacity = 0.1;
  });
  SceneView.prototype.setPassengerAppearance.call(scene, view, 1, false);
  assert.equal(material.color.getHex(), 0x123456);
  assert.equal(badges.every((badge) => badge.visible && badge.material.opacity === 0.1), true);

  SceneView.prototype.resetPassengerAppearance.call({
    setQuestionPassengerBadgesVisible: SceneView.prototype.setQuestionPassengerBadgesVisible,
    resetQuestionPassengerReveal: SceneView.prototype.resetQuestionPassengerReveal
  }, view);
  assert.equal(view.userData.colorIndex, null);
  assert.equal(view.userData.questionPassengerHidden, null);
  assert.equal(badges.every((badge) => !badge.visible && badge.material.opacity === 1), true);

  SceneView.prototype.setPassengerAppearance.call(scene, view, 1, false);
  assert.equal(material.color.getHex(), COLORS[1].hex);
  assert.equal(material.userData.passengerColorIndex, 1);
});

test('material tuning skips hidden and nonmatching roots while full updates keep reveal current', () => {
  const textures = Array.from({ length: 3 }, () => new THREE.Texture());
  const scene = makeAppearanceScene(textures);
  scene.passengerMaterials = [];
  scene.queuePassengerViews = [[]];
  scene.boardingViews = [];

  const targetedMaterial = new THREE.MeshStandardMaterial();
  const otherMaterial = new THREE.MeshStandardMaterial();
  const hiddenMaterial = new THREE.MeshStandardMaterial();
  const targeted = makeVatView(targetedMaterial, null, null);
  const other = makeVatView(otherMaterial, null, null);
  const hidden = makeVatView(hiddenMaterial, null, null);
  SceneView.prototype.setPassengerAppearance.call(scene, targeted, 1, false);
  SceneView.prototype.setPassengerAppearance.call(scene, other, 2, false);
  SceneView.prototype.setPassengerAppearance.call(scene, hidden, 1, true);
  targetedMaterial.emissiveIntensity = 9;
  otherMaterial.emissiveIntensity = 8;
  scene.passengerViews = [targeted, other];
  scene.queuePassengerViews[0].push(hidden);

  SceneView.prototype.updatePassengerMaterialTuning.call(scene, { colorIndex: 1 });
  assert.equal(targetedMaterial.emissiveIntensity, SCENE_TUNING.passengerMaterial.emissionStrength);
  assert.equal(targeted.userData.questionPassengerHidden, null);
  assert.equal(otherMaterial.emissiveIntensity, 8);
  assert.equal(other.userData.questionPassengerHidden, false);
  assert.equal(hiddenMaterial.emissiveIntensity, 0.18);
  assert.equal(hiddenMaterial.color.getHex(), 0x9da8b8);
  assert.equal(hidden.userData.questionPassengerHidden, true);

  SceneView.prototype.updatePassengerMaterialTuning.call(scene);
  assert.equal(otherMaterial.emissiveIntensity, SCENE_TUNING.passengerMaterial.emissionStrength);
  assert.equal(other.userData.questionPassengerHidden, null);
  assert.equal(hiddenMaterial.emissiveIntensity, 0.18);
  assert.equal(hidden.userData.questionPassengerHidden, true);

  const originalEmissionStrength = SCENE_TUNING.passengerMaterial.emissionStrength;
  try {
    SCENE_TUNING.passengerMaterial.emissionStrength = 1.35;
    SceneView.prototype.updatePassengerMaterialTuning.call(scene);
    assert.equal(hiddenMaterial.emissiveIntensity, 0.18);
    assert.equal(hidden.userData.questionPassengerHidden, true);
    SceneView.prototype.setPassengerAppearance.call(scene, hidden, 1, false);
    assert.equal(hiddenMaterial.emissiveIntensity, 1.35);
    assert.equal(hiddenMaterial.userData.passengerColorIndex, 1);
  } finally {
    SCENE_TUNING.passengerMaterial.emissionStrength = originalEmissionStrength;
  }
});

test('hidden passengers reveal once when entering a belt slot without mutating queue state', () => {
  const runtime = questionPassengerMechanic.createRuntime({ random: () => 0 });
  const passenger = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const slot = runtime.createSlotData();

  runtime.onPassengerEnteredBelt({ slot, passenger });

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
  assert.deepEqual(passenger.questionPassenger, {
    hidden: true,
    wasHidden: true,
    revealVersion: 0
  });
});

test('passengers without question-passenger state clear belt slot state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.onPassengerEnteredBelt({ slot, passenger: {} });

  assert.equal(slot.questionPassenger, null);
});

test('passengers with explicit null question-passenger state clear populated belt slots', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.onPassengerEnteredBelt({ slot, passenger: { questionPassenger: null } });

  assert.equal(slot.questionPassenger, null);
});

test('visible passengers preserve their reveal version when cloned to a belt slot', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const passenger = {
    questionPassenger: {
      hidden: false,
      wasHidden: false,
      revealVersion: 7
    }
  };
  const slot = runtime.createSlotData();

  runtime.onPassengerEnteredBelt({ slot, passenger });

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: false,
    revealVersion: 7
  });
  assert.deepEqual(passenger.questionPassenger, {
    hidden: false,
    wasHidden: false,
    revealVersion: 7
  });
  assert.notEqual(slot.questionPassenger, passenger.questionPassenger);
});

test('queue-item and decorated global snapshots isolate nested runtime state', () => {
  const runtime = questionPassengerMechanic.createRuntime({ random: () => 0 });
  const queueItem = runtime.createQueueItemData({ queueIndex: 0, sourceIndex: 0 });
  const game = { mechanicState: runtime.createState() };

  const queueSnapshot = runtime.cloneQueueItemSnapshot(queueItem);
  const globalSnapshot = runtime.decorateSnapshot(game);
  queueSnapshot.questionPassenger.hidden = false;
  globalSnapshot.questionPassenger.mode = 'authored';

  assert.equal(queueItem.questionPassenger.hidden, true);
  assert.equal(game.mechanicState.questionPassenger.mode, 'chance');
  assert.notEqual(queueSnapshot.questionPassenger, queueItem.questionPassenger);
  assert.notEqual(globalSnapshot.questionPassenger, game.mechanicState.questionPassenger);
});

test('slot snapshots clone nested question-passenger state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  const snapshot = runtime.cloneSlotSnapshot(slot);
  snapshot.questionPassenger.revealVersion = 9;

  assert.deepEqual(slot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
  assert.notEqual(snapshot.questionPassenger, slot.questionPassenger);
});

test('queue-item and slot snapshots normalize missing or null mechanic state to null', () => {
  const runtime = questionPassengerMechanic.createRuntime();

  assert.deepEqual(runtime.cloneQueueItemSnapshot({}), { questionPassenger: null });
  assert.deepEqual(
    runtime.cloneQueueItemSnapshot({ questionPassenger: null }),
    { questionPassenger: null }
  );
  assert.deepEqual(runtime.cloneSlotSnapshot({}), { questionPassenger: null });
  assert.deepEqual(
    runtime.cloneSlotSnapshot({ questionPassenger: null }),
    { questionPassenger: null }
  );
});

test('clearing slot data removes question-passenger state', () => {
  const runtime = questionPassengerMechanic.createRuntime();
  const slot = {
    questionPassenger: {
      hidden: false,
      wasHidden: true,
      revealVersion: 1
    }
  };

  runtime.clearSlotData({ slot });

  assert.equal(slot.questionPassenger, null);
});

test('question-passenger runtime flows hidden queue metadata through game belt entry', () => {
  const authoredMasks = LEVEL_1.passengerQueues.map((queue, queueIndex) => (
    queue.map((_, sourceIndex) => queueIndex === 0 && sourceIndex === 0)
  ));
  const level = {
    ...LEVEL_1,
    mechanics: {
      'question-passenger': { authoredMasks }
    }
  };
  const game = new BusLoopGame(level);
  game.mechanicRuntime = createQuestionPassengerRuntime({
    level,
    options: { mode: 'authored' }
  });

  game.reset();

  const queueSnapshot = game.snapshot();
  assert.deepEqual(queueSnapshot.queueItems[0][0].questionPassenger, {
    hidden: true,
    wasHidden: true,
    revealVersion: 0
  });
  queueSnapshot.queueItems[0][0].questionPassenger.hidden = false;
  assert.equal(game.snapshot().queueItems[0][0].questionPassenger.hidden, true);

  game.slots[0].progress = 0.999;
  game.slots[0].previousProgress = 0.999;
  game.update(0.01);

  const beltSlot = game.snapshot().slots[0];
  assert.equal(beltSlot.entryIndex, 0);
  assert.deepEqual(beltSlot.questionPassenger, {
    hidden: false,
    wasHidden: true,
    revealVersion: 1
  });
});
