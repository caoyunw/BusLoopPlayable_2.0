import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MECHANIC_MODULES,
  createMechanicRuntime,
  getMechanicModuleById,
  resolvePlayableMechanicId
} from '../src/mechanics/index.js';
import { MECHANICS } from '../src/mechanic-registry.js';

test('mechanic modules own registry definitions and expose unique ids', () => {
  assert.deepEqual(
    MECHANIC_MODULES.map((module) => module.definition.id),
    MECHANICS.map((mechanic) => mechanic.id)
  );
  assert.equal(
    new Set(MECHANIC_MODULES.map((module) => module.definition.id)).size,
    MECHANIC_MODULES.length
  );
  assert.equal(getMechanicModuleById('star-passenger').definition.name, '星星乘客');
});

test('planned mechanics resolve to base runtime while playable mechanics keep their id', () => {
  assert.equal(resolvePlayableMechanicId('base'), 'base');
  assert.equal(resolvePlayableMechanicId('star-passenger'), 'star-passenger');
  assert.equal(resolvePlayableMechanicId('valve'), 'valve');
  assert.equal(resolvePlayableMechanicId('train'), 'base');
  assert.equal(createMechanicRuntime('train').id, 'base');
  assert.equal(createMechanicRuntime('star-passenger', { random: () => 1 }).id, 'star-passenger');
  assert.equal(createMechanicRuntime('valve').id, 'valve');
});

test('star passenger owns its model and view implementation files', () => {
  const modelSource = readFileSync(join('src', 'mechanics', 'star-passenger', 'model.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'mechanics', 'star-passenger', 'view.js'), 'utf8');
  const mainSource = readFileSync(join('src', 'main.js'), 'utf8');
  const gameSource = readFileSync(join('src', 'game-model.js'), 'utf8');

  assert.match(modelSource, /createStarPassengerRuntime/);
  assert.match(viewSource, /createStarPassengerHud/);
  assert.match(mainSource, /createMechanicUiControllers/);
  assert.match(gameSource, /createMechanicRuntime/);
  assert.doesNotMatch(gameSource, /STAR_PASSENGER_MECHANIC_ID/);
  assert.doesNotMatch(gameSource, /createStarPassengerReward/);
});

test('linked passenger owns model and detail files while game model stays generic', () => {
  const modelSource = readFileSync(join('src', 'mechanics', 'linked-passengers', 'model.js'), 'utf8');
  const viewSource = readFileSync(join('src', 'mechanics', 'linked-passengers', 'view.js'), 'utf8');
  const gameSource = readFileSync(join('src', 'game-model.js'), 'utf8');

  assert.match(modelSource, /createLinkedPassengerRuntime/);
  assert.match(viewSource, /createLinkedPassengerDetailView/);
  assert.match(gameSource, /getBeltEntryBatch/);
  assert.match(gameSource, /getBoardingBatch/);
  assert.doesNotMatch(gameSource, /linked-passengers/);
});
