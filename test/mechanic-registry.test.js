import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MECHANICS,
  filterMechanics,
  getMechanicById,
  resolveMechanicId
} from '../src/mechanic-registry.js';
import {
  getMechanicIdFromSearch,
  replaceMechanicQuery,
  syncMechanicQuery
} from '../src/mechanic-lab.js';

const PLANNED_MECHANIC_IDS = [
  'question-passenger',
  'question-vehicle',
  'elevator-bay',
  'garage',
  'linked-passengers',
  'linked-vehicles',
  'special-gate',
  'star-passenger',
  'order-passenger',
  'valve'
];

const EXPECTED_SUMMARIES = {
  'question-passenger': '左右队列不可见颜色，进入传送带后显示。',
  'question-vehicle': '颜色不可见，前方无阻挡时显示。',
  'elevator-bay': '舱门前车辆移开后才打开并传出下一组车辆。',
  garage: '车库口前车开走后下一辆才出现。',
  'linked-passengers': '前后排粘连，必须同时上一辆车。',
  'linked-vehicles': '两辆车联动，同时进入并各占一个停车位。',
  'special-gate': '车辆经过停车场两侧特殊门时触发对应效果。',
  'star-passenger': '上车时获得星星并为道具充能。',
  'order-passenger': '普通车挡住南瓜车，解救后对应乘客上车并给予奖励。',
  valve: '玩家手动控制左右哪边乘客进入。'
};

test('registry contains base plus ten unique mechanic entries', () => {
  assert.equal(MECHANICS.length, 11);
  assert.equal(new Set(MECHANICS.map(({ id }) => id)).size, 11);
  assert.deepEqual(
    MECHANICS.map(({ id }) => id),
    ['base', ...PLANNED_MECHANIC_IDS]
  );
});

test('every mechanic has complete Chinese metadata and the expected summary', () => {
  const requiredFields = [
    'id',
    'name',
    'categories',
    'status',
    'summary',
    'effect',
    'experience',
    'difficulty'
  ];

  for (const mechanic of MECHANICS) {
    assert.deepEqual(Object.keys(mechanic).sort(), [...requiredFields].sort());
    for (const field of requiredFields.filter((field) => field !== 'categories')) {
      assert.equal(typeof mechanic[field], 'string');
      assert.ok(mechanic[field].trim(), `${mechanic.id}.${field} must not be empty`);
    }
    assert.ok(mechanic.categories.length, `${mechanic.id}.categories must not be empty`);
    assert.ok(mechanic.categories.every((category) => typeof category === 'string' && category.trim()));
  }

  for (const [id, summary] of Object.entries(EXPECTED_SUMMARIES)) {
    assert.equal(getMechanicById(id).summary, summary);
  }
});

test('base is playable and all ten presets are planned', () => {
  assert.equal(getMechanicById('base').status, 'playable');
  assert.equal(MECHANICS.filter(({ status }) => status === 'playable').length, 1);
  assert.equal(MECHANICS.filter(({ status }) => status === 'planned').length, 10);
});

test('registry and nested category arrays are deeply frozen', () => {
  assert.ok(Object.isFrozen(MECHANICS));
  for (const mechanic of MECHANICS) {
    assert.ok(Object.isFrozen(mechanic));
    assert.ok(Object.isFrozen(mechanic.categories));
  }
});

test('filterMechanics searches names, summaries, and categories', () => {
  assert.deepEqual(filterMechanics('车库').map(({ id }) => id), ['garage']);
  assert.deepEqual(filterMechanics('南瓜车').map(({ id }) => id), ['order-passenger']);
  assert.deepEqual(
    filterMechanics('信息隐藏').map(({ id }) => id),
    ['question-passenger', 'question-vehicle']
  );
  assert.equal(filterMechanics('  '), MECHANICS);
});

test('invalid mechanic ids fall back to base', () => {
  assert.equal(getMechanicById('garage').id, 'garage');
  assert.equal(getMechanicById('missing'), null);
  assert.equal(resolveMechanicId('garage'), 'garage');
  assert.equal(resolveMechanicId('missing'), 'base');
  assert.equal(resolveMechanicId(null), 'base');
});

test('query parsing resolves known ids and falls back to base', () => {
  assert.equal(getMechanicIdFromSearch('?mechanic=question-vehicle'), 'question-vehicle');
  assert.equal(getMechanicIdFromSearch('?mechanic=missing'), 'base');
  assert.equal(getMechanicIdFromSearch('?foo=1'), 'base');
});

test('query replacement preserves other parameters and the hash', () => {
  assert.equal(
    replaceMechanicQuery('/lab?foo=1#preview', 'garage'),
    '/lab?foo=1&mechanic=garage#preview'
  );
  assert.equal(
    replaceMechanicQuery('/lab?mechanic=garage&foo=1#preview', 'missing'),
    '/lab?mechanic=base&foo=1#preview'
  );
});

test('query synchronization replaces the current location with a resolved id', () => {
  const calls = [];
  const location = {
    pathname: '/lab',
    search: '?foo=1',
    hash: '#preview'
  };
  const history = {
    replaceState(...args) {
      calls.push(args);
    }
  };

  syncMechanicQuery('missing', location, history);

  assert.deepEqual(calls, [[null, '', '/lab?foo=1&mechanic=base#preview']]);
});
