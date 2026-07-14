import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MECHANICS,
  filterMechanics,
  getMechanicById,
  resolveMechanicId
} from '../src/mechanic-registry.js';
import {
  createMechanicLibrary,
  filterMechanicCollection
} from '../src/mechanic-library.js';
import {
  createMechanicDetailView,
  resolvePlayableMechanicId
} from '../src/mechanics/index.js';
import { createQuestionPassengerDetailView } from '../src/mechanics/question-passenger/view.js';
import * as mechanicLab from '../src/mechanic-lab.js';

const {
  getMechanicIdFromSearch,
  replaceMechanicQuery,
  safeRemoveStorageItem,
  syncMechanicQuery
} = mechanicLab;

const MECHANIC_IDS_AFTER_BASE = [
  'question-passenger',
  'question-vehicle',
  'elevator-bay',
  'garage',
  'linked-passengers',
  'linked-vehicles',
  'special-gate',
  'star-passenger',
  'order-passenger',
  'valve',
  'train',
  'locked-garage',
  'count-garage',
  'rotating-spots',
  'double-gate',
  'maglev-spot'
];

const PLAYABLE_MECHANIC_IDS = new Set([
  'base',
  'question-passenger',
  'garage',
  'star-passenger',
  'order-passenger',
  'valve',
  'count-garage',
  'linked-passengers',
  'train'
]);
const PLANNED_MECHANIC_IDS = ['base', ...MECHANIC_IDS_AFTER_BASE].filter((id) => (
  !PLAYABLE_MECHANIC_IDS.has(id)
));

const EXPECTED_SUMMARIES = {
  'question-passenger': '左右队列不可见颜色，进入传送带后显示。',
  'question-vehicle': '颜色不可见，前方无阻挡时显示。',
  'elevator-bay': '舱门前车辆移开后才打开并传出下一组车辆。',
  garage: '车库口前车开走后下一辆才出现。',
  'linked-passengers': '前后排粘连，必须同时上一辆车。',
  'linked-vehicles': '两辆车联动，同时进入并各占一个停车位。',
  'special-gate': '车辆经过停车场两侧特殊门时触发对应效果。',
  'star-passenger': '上车时获得星星并为道具充能。',
  'order-passenger': '接完订单上的红色、黄色、棕色乘客即可完成关卡。',
  valve: '玩家手动控制左右哪边乘客进入。',
  train: '车厢移至轨道，集齐4节并上满乘客后开走。',
  'locked-garage': '带钥匙车辆开走后解锁上锁停车场。',
  'count-garage': '开走指定数量车辆后解锁车库。',
  'rotating-spots': '每点击一次车辆，车位上的车顺时针旋转90°。',
  'double-gate': '乘客经过闸门时数量翻倍。',
  'maglev-spot': '点击切换车位升降，升起时不阻挡地面车辆。'
};

EXPECTED_SUMMARIES.valve = '传送带左右阀门自动轮流放行同色乘客段。';

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  setFromString(value) {
    this.values = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.contains(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }

  toString() {
    return [...this.values].join(' ');
  }
}

class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new FakeClassList(this);
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  get className() {
    return this.classList.toString();
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get id() {
    return this.getAttribute('id') ?? '';
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.textContent = '';
    this.append(...children);
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (let current = this; current; current = event.bubbles ? current.parentElement : null) {
      event.currentTarget = current;
      for (const listener of [...(current.listeners.get(event.type) ?? [])]) {
        listener.call(current, event);
      }
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', bubbles: true, target: null, currentTarget: null });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  contains(element) {
    return element === this || this.children.some((child) => child.contains(element));
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    const dataSelector = selector.match(/^\[data-([a-z0-9-]+)(?:="([^"]*)")?\]$/i);
    if (dataSelector) {
      const key = dataSelector[1]
        .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      if (!Object.hasOwn(this.dataset, key)) return false;
      return dataSelector[2] === undefined || this.dataset[key] === dataSelector[2];
    }
    return this.tagName === selector.toUpperCase();
  }

  closest(selector) {
    for (let current = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
}

class FakeDocument {
  constructor(defaultView) {
    this.defaultView = defaultView;
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

function createMatchMedia(initialMatches) {
  const listeners = new Set();
  return {
    matches: initialMatches,
    media: '(max-width: 860px)',
    addEventListener(type, listener) {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'change') listeners.delete(listener);
    },
    dispatch(matches) {
      this.matches = matches;
      for (const listener of [...listeners]) {
        listener({ matches, media: this.media });
      }
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

function createLibraryFixture({ mobile = false } = {}) {
  const previousDocument = globalThis.document;
  const previousMatchMedia = globalThis.matchMedia;
  const hadDocument = Object.hasOwn(globalThis, 'document');
  const hadMatchMedia = Object.hasOwn(globalThis, 'matchMedia');
  const media = createMatchMedia(mobile);
  const view = { matchMedia: () => media };
  const document = new FakeDocument(view);
  const root = document.createElement('aside');
  root.id = 'mechanic-library';

  const toggle = document.createElement('button');
  toggle.id = 'mechanic-library-toggle';
  const search = document.createElement('input');
  search.id = 'mechanic-search';
  const list = document.createElement('div');
  list.id = 'mechanic-list';
  const detail = document.createElement('section');
  detail.id = 'mechanic-detail';
  root.append(toggle, search, list, detail);

  globalThis.document = document;
  globalThis.matchMedia = view.matchMedia;

  return {
    document,
    root,
    toggle,
    search,
    list,
    detail,
    media,
    restore() {
      if (hadDocument) globalThis.document = previousDocument;
      else delete globalThis.document;
      if (hadMatchMedia) globalThis.matchMedia = previousMatchMedia;
      else delete globalThis.matchMedia;
    }
  };
}

function createTestMechanic(id, overrides = {}) {
  return {
    id,
    name: `Mechanic ${id}`,
    categories: ['Routing'],
    status: 'planned',
    summary: `Summary ${id}`,
    effect: `Effect ${id}`,
    experience: `Experience ${id}`,
    difficulty: 'Low',
    ...overrides
  };
}

test('page shell exposes the mechanic lab controls without ad CTA copy', () => {
  const html = readFileSync(join('index.html'), 'utf8');

  for (const id of [
    'mechanic-library',
    'mechanic-library-toggle',
    'mechanic-search',
    'mechanic-list',
    'mechanic-detail',
    'mechanic-overlay',
    'mechanic-overlay-title',
    'mechanic-overlay-summary',
    'mechanic-back-button',
    'stage',
    'game-canvas',
    'loading-screen',
    'end-panel',
    'scene-editor'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /id="app" class="mechanic-lab"/);
  assert.doesNotMatch(html, /cta-button|Play Now/);
});

test('mechanic library module exports its UI factory', () => {
  const librarySource = readFileSync(join('src', 'mechanic-library.js'), 'utf8');

  assert.match(librarySource, /export function createMechanicLibrary/);
});

test('mechanic lab styles define the desktop grid and mobile drawer breakpoint', () => {
  const css = readFileSync(join('src', 'styles.css'), 'utf8');

  assert.match(
    css,
    /grid-template-columns:\s*minmax\(236px,\s*286px\)\s+minmax\(0,\s*1fr\)\s+auto/
  );
  assert.match(css, /@media\s*\(max-width:\s*860px\)/);
  assert.match(css, /\.mechanic-library\.is-collapsed[\s\S]*?width:\s*48px[\s\S]*?height:\s*48px/);
  assert.match(css, /\.mechanic-library-toggle\s*\{[^}]*display:\s*none/);
  assert.match(
    css,
    /@media\s*\(max-width:\s*860px\)[\s\S]*?\n\s{2}\.mechanic-library-toggle\s*\{[^}]*display:\s*block/
  );
  assert.doesNotMatch(css, /\.cta-button|@keyframes\s+cta-pulse/);
});

test('question passenger detail styles stay mechanic-owned and load through the root stylesheet', () => {
  const css = readFileSync(join('src', 'styles.css'), 'utf8');
  const questionCss = readFileSync(
    join('src', 'mechanics', 'question-passenger', 'styles.css'),
    'utf8'
  );

  assert.match(css, /^@import ['"]\.\/mechanics\/question-passenger\/styles\.css['"];/);
  assert.match(questionCss, /\[data-question-passenger-settings\]/);
  assert.match(questionCss, /\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(questionCss, /:focus-visible/);
  assert.match(questionCss, /@media\s*\(max-width:\s*860px\)/);
});

test('linked passenger detail styles stay mechanic-owned and load after question settings', () => {
  const css = readFileSync(join('src', 'styles.css'), 'utf8');
  const linkedCss = readFileSync(
    join('src', 'mechanics', 'linked-passengers', 'styles.css'),
    'utf8'
  );

  assert.match(
    css,
    /^@import ['"]\.\/mechanics\/question-passenger\/styles\.css['"];\s*\n@import ['"]\.\/mechanics\/linked-passengers\/styles\.css['"];/
  );
  assert.match(linkedCss, /\[data-linked-passenger-settings\]/);
  assert.match(linkedCss, /\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(linkedCss, /:focus-visible/);
  assert.match(linkedCss, /@media\s*\(max-width:\s*860px\)/);
});

test('train detail styles stay mechanic-owned and load after linked settings', () => {
  const css = readFileSync(join('src', 'styles.css'), 'utf8');
  const trainCss = readFileSync(join('src', 'mechanics', 'train', 'styles.css'), 'utf8');

  assert.match(
    css,
    /@import ['"]\.\/mechanics\/linked-passengers\/styles\.css['"];\s*\n@import ['"]\.\/mechanics\/train\/styles\.css['"];/
  );
  assert.match(trainCss, /\[data-train-settings\]/);
});

test('createMechanicLibrary renders unique groups with textContent and rerenders search states', () => {
  const fixture = createLibraryFixture();
  const mechanics = [
    createTestMechanic('alpha', {
      name: '<img src=x onerror=alert(1)> Alpha',
      categories: ['Routing']
    }),
    createTestMechanic('beta', {
      categories: ['Scoring']
    })
  ];
  const expectedGroups = new Map([
    ['Routing', ['alpha']],
    ['Scoring', ['beta']]
  ]);

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics: [...mechanics, mechanics[0]],
      activeId: mechanics[0].id
    });
    const groups = fixture.list.querySelectorAll('.mechanic-group');
    const renderedIds = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .map((button) => button.dataset.mechanicId);

    assert.deepEqual(
      groups.map((group) => group.querySelector('.mechanic-group-title').textContent),
      [...expectedGroups.keys()]
    );
    for (const group of groups) {
      const title = group.querySelector('.mechanic-group-title').textContent;
      assert.deepEqual(
        group.querySelectorAll('[data-mechanic-id]')
          .map((button) => button.dataset.mechanicId),
        expectedGroups.get(title)
      );
    }
    assert.deepEqual(renderedIds, ['alpha', 'beta']);
    assert.equal(new Set(renderedIds).size, renderedIds.length);
    assert.equal(
      fixture.list.querySelector('.mechanic-item-name').textContent,
      mechanics[0].name
    );
    assert.equal(fixture.list.querySelector('img'), null);

    fixture.search.value = 'missing';
    fixture.search.dispatchEvent({ type: 'input', bubbles: false, target: null });
    assert.ok(fixture.list.querySelector('.mechanic-empty-state'));

    fixture.search.value = 'alpha';
    fixture.search.dispatchEvent({ type: 'input', bubbles: false, target: null });
    assert.equal(fixture.list.querySelectorAll('[data-mechanic-id]').length, 1);

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('mobile mechanic library starts collapsed with toggle state synchronized', () => {
  const fixture = createLibraryFixture({ mobile: true });

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics: [createTestMechanic('alpha')],
      activeId: 'alpha'
    });

    assert.ok(fixture.root.classList.contains('is-collapsed'));
    assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'false');

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('mobile mechanic selection calls onSelect, updates current state, collapses, and focuses toggle', () => {
  const fixture = createLibraryFixture({ mobile: true });
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const selected = [];

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'alpha',
      onSelect: (id) => selected.push(id)
    });
    const betaButton = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .find((button) => button.dataset.mechanicId === 'beta');

    betaButton.focus();
    betaButton.click();

    assert.deepEqual(selected, ['beta']);
    assert.equal(betaButton.getAttribute('aria-current'), 'true');
    assert.ok(fixture.root.classList.contains('is-collapsed'));
    assert.equal(fixture.document.activeElement, fixture.toggle);

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('viewport change expands the mobile drawer on desktop and synchronizes toggle aria', () => {
  const fixture = createLibraryFixture({ mobile: true });

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics: [createTestMechanic('alpha')],
      activeId: 'alpha'
    });

    assert.ok(fixture.root.classList.contains('is-collapsed'));
    fixture.toggle.click();
    assert.equal(fixture.root.classList.contains('is-collapsed'), false);

    fixture.media.dispatch(false);

    assert.equal(fixture.root.classList.contains('is-collapsed'), false);
    assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(fixture.toggle.getAttribute('aria-label'), '收起机制库');
    assert.equal(fixture.media.listenerCount(), 1);

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('destroy detaches search, toggle, list, and viewport behavior', () => {
  const fixture = createLibraryFixture({ mobile: true });
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const selected = [];

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'alpha',
      onSelect: (id) => selected.push(id)
    });
    const firstGroup = fixture.list.querySelector('.mechanic-group');
    const betaButton = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .find((button) => button.dataset.mechanicId === 'beta');

    assert.ok(fixture.root.classList.contains('is-collapsed'));
    library.destroy();

    assert.equal(fixture.media.listenerCount(), 0);

    fixture.search.value = 'missing';
    fixture.search.dispatchEvent({ type: 'input', bubbles: false, target: null });
    fixture.toggle.click();
    betaButton.click();
    fixture.media.dispatch(false);

    assert.equal(fixture.list.querySelector('.mechanic-group'), firstGroup);
    assert.ok(fixture.root.classList.contains('is-collapsed'));
    assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(selected, []);
    assert.equal(betaButton.getAttribute('aria-current'), 'false');
  } finally {
    fixture.restore();
  }
});

test('detail extensions replace and clean up exactly once across selection and destroy', () => {
  const fixture = createLibraryFixture();
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const rendered = [];
  const destroyed = [];

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'alpha',
      renderDetailExtension({ mechanic, document }) {
        rendered.push({ mechanic, document });
        const element = document.createElement('section');
        element.setAttribute('data-detail-extension', mechanic.id);
        return {
          element,
          destroy: () => destroyed.push(mechanic.id)
        };
      }
    });

    assert.equal(
      fixture.detail.querySelector('[data-detail-extension="alpha"]').textContent,
      ''
    );
    assert.equal(rendered[0].mechanic, mechanics[0]);
    assert.equal(rendered[0].document, fixture.document);

    library.setActive('beta');

    assert.deepEqual(destroyed, ['alpha']);
    assert.equal(fixture.detail.querySelector('[data-detail-extension="alpha"]'), null);
    assert.ok(fixture.detail.querySelector('[data-detail-extension="beta"]'));

    library.destroy();
    library.destroy();

    assert.deepEqual(destroyed, ['alpha', 'beta']);
  } finally {
    fixture.restore();
  }
});

test('synchronous selection feedback does not remount the active detail extension', () => {
  const fixture = createLibraryFixture();
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const rendered = [];
  const destroyed = [];
  let library;

  try {
    library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'alpha',
      onSelect: (id) => library.setActive(id),
      renderDetailExtension({ mechanic, document }) {
        rendered.push(mechanic.id);
        const element = document.createElement('section');
        element.setAttribute('data-detail-extension', mechanic.id);
        return {
          element,
          destroy: () => destroyed.push(mechanic.id)
        };
      }
    });
    const betaButton = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .find((button) => button.dataset.mechanicId === 'beta');

    betaButton.click();

    assert.deepEqual(rendered, ['alpha', 'beta']);
    assert.deepEqual(destroyed, ['alpha']);
    assert.ok(fixture.detail.querySelector('[data-detail-extension="beta"]'));

    library.destroy();
    library.destroy();
    assert.deepEqual(destroyed, ['alpha', 'beta']);
  } finally {
    fixture.restore();
  }
});

test('synchronous selection renders the target extension from updated runtime state once', () => {
  const fixture = createLibraryFixture();
  const mechanics = [createTestMechanic('base'), createTestMechanic('question-passenger')];
  const rendered = [];
  const destroyed = [];
  let runtimeState = { questionPassenger: { authoredMarked: 0, authoredTotal: 0 } };
  let library;

  try {
    library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'base',
      onSelect(id) {
        runtimeState = id === 'question-passenger'
          ? { questionPassenger: { authoredMarked: 3, authoredTotal: 8 } }
          : { questionPassenger: { authoredMarked: 0, authoredTotal: 0 } };
        library.setActive(id);
      },
      renderDetailExtension({ mechanic, document }) {
        const authoredMarked = runtimeState.questionPassenger.authoredMarked;
        const authoredTotal = runtimeState.questionPassenger.authoredTotal;
        rendered.push({ id: mechanic.id, authoredMarked, authoredTotal });
        const element = document.createElement('section');
        element.setAttribute('data-runtime-extension', mechanic.id);
        element.textContent = `${authoredMarked}/${authoredTotal}`;
        return {
          element,
          destroy: () => destroyed.push(mechanic.id)
        };
      }
    });
    const questionButton = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .find((button) => button.dataset.mechanicId === 'question-passenger');

    questionButton.click();

    assert.deepEqual(rendered, [
      { id: 'base', authoredMarked: 0, authoredTotal: 0 },
      { id: 'question-passenger', authoredMarked: 3, authoredTotal: 8 }
    ]);
    assert.equal(
      fixture.detail.querySelectorAll('[data-runtime-extension="question-passenger"]').length,
      1
    );
    assert.equal(
      fixture.detail.querySelector('[data-runtime-extension="question-passenger"]').textContent,
      '3/8'
    );
    assert.deepEqual(destroyed, ['base']);

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('selection fallback renders the target when onSelect does not manage active state', () => {
  const fixture = createLibraryFixture();
  const mechanics = [createTestMechanic('alpha'), createTestMechanic('beta')];
  const selected = [];
  const rendered = [];

  try {
    const library = createMechanicLibrary(fixture.root, {
      mechanics,
      activeId: 'alpha',
      onSelect: (id) => selected.push(id),
      renderDetailExtension({ mechanic, document }) {
        rendered.push(mechanic.id);
        const element = document.createElement('section');
        element.setAttribute('data-fallback-extension', mechanic.id);
        return { element };
      }
    });
    const betaButton = fixture.list
      .querySelectorAll('[data-mechanic-id]')
      .find((button) => button.dataset.mechanicId === 'beta');

    betaButton.click();

    assert.deepEqual(selected, ['beta']);
    assert.deepEqual(rendered, ['alpha', 'beta']);
    assert.equal(betaButton.getAttribute('aria-current'), 'true');
    assert.ok(fixture.detail.querySelector('[data-fallback-extension="beta"]'));

    library.destroy();
  } finally {
    fixture.restore();
  }
});

test('detail extension factory delegates optional mechanic views without id branching', () => {
  const fixture = createLibraryFixture();

  try {
    const extension = createMechanicDetailView('question-passenger', {
      document: fixture.document
    });

    assert.ok(extension?.element.matches('[data-question-passenger-settings]'));
    assert.equal(typeof extension.destroy, 'function');
    const linkedExtension = createMechanicDetailView('linked-passengers', {
      document: fixture.document
    });
    assert.ok(linkedExtension?.element.matches('[data-linked-passenger-settings]'));
    assert.equal(typeof linkedExtension.destroy, 'function');
    const trainExtension = createMechanicDetailView('train', {
      document: fixture.document,
      state: { train: { authoredGroupCount: 3, authoredCarriageCount: 12 } }
    });
    assert.ok(trainExtension?.element.matches('[data-train-settings]'));
    assert.equal(typeof trainExtension.destroy, 'function');
    assert.equal(createMechanicDetailView('base', { document: fixture.document }), null);
    assert.equal(createMechanicDetailView('missing', { document: fixture.document }), null);
    extension.destroy();
    linkedExtension.destroy();
    trainExtension.destroy();
  } finally {
    fixture.restore();
  }
});

test('train detail view keeps chance and authored settings independent', () => {
  const fixture = createLibraryFixture();
  const commits = [];

  try {
    const extension = createMechanicDetailView('train', {
      document: fixture.document,
      options: { mode: 'chance', chance: 0.3 },
      state: {
        train: {
          authoredGroupCount: 3,
          authoredCarriageCount: 12,
          invalidAuthoredGroupCount: 0
        }
      },
      onCommit: (options) => commits.push(options)
    });
    const mode = extension.element.querySelector('[data-train-mode]');
    const chance = extension.element.querySelector('[data-train-chance]');
    const output = extension.element.querySelector('[data-train-chance-output]');
    const chanceRow = extension.element.querySelector('[data-train-chance-row]');
    const summary = extension.element.querySelector('[data-train-authored-summary]');

    assert.equal(mode.value, 'chance');
    assert.equal(chance.value, '30');
    assert.equal(output.textContent, '30%');
    assert.equal(chance.getAttribute('min'), '0');
    assert.equal(chance.getAttribute('max'), '100');
    assert.equal(chance.getAttribute('step'), '1');
    assert.equal(chanceRow.hidden, false);
    assert.equal(summary.hidden, true);
    assert.equal(summary.textContent, '固定标记：3 列火车，12 节车厢');

    mode.value = 'authored';
    mode.dispatchEvent({ type: 'change' });
    assert.equal(chanceRow.hidden, true);
    assert.equal(summary.hidden, false);
    assert.deepEqual(commits, [{ mode: 'authored', chance: 0.3 }]);

    chance.value = '47';
    chance.dispatchEvent({ type: 'input' });
    assert.equal(output.textContent, '47%');
    chance.dispatchEvent({ type: 'change' });
    assert.deepEqual(commits.at(-1), { mode: 'authored', chance: 0.47 });
    extension.destroy();
  } finally {
    fixture.restore();
  }
});

test('linked passenger detail view keeps chance and authored settings independent', () => {
  const fixture = createLibraryFixture();
  const commits = [];

  try {
    const extension = createMechanicDetailView('linked-passengers', {
      document: fixture.document,
      options: { mode: 'chance', chance: 0.3, maxLength: 10 },
      state: {
        linkedPassenger: {
          maxVehicleSeats: 10,
          chainCount: 2,
          linkedGroupCount: 5,
          invalidAuthoredCount: 0,
          authoredChainCount: 12,
          authoredLinkedGroupCount: 66,
          authoredInvalidAuthoredCount: 0
        }
      },
      onCommit: (options) => commits.push(options)
    });
    const mode = extension.element.querySelector('[data-linked-mode]');
    const chance = extension.element.querySelector('[data-linked-chance]');
    const chanceOutput = extension.element.querySelector('[data-linked-chance-output]');
    const maxLength = extension.element.querySelector('[data-linked-max-length]');
    const lengthOutput = extension.element.querySelector('[data-linked-max-length-output]');
    const chanceRow = extension.element.querySelector('[data-linked-chance-row]');
    const lengthRow = extension.element.querySelector('[data-linked-length-row]');
    const authoredSummary = extension.element.querySelector('[data-linked-authored-summary]');

    assert.ok(extension.element.matches('[data-linked-passenger-settings]'));
    assert.equal(extension.element.querySelector('h3').textContent, '机制设置');
    assert.deepEqual(
      mode.querySelectorAll('option').map((option) => [option.value, option.textContent]),
      [['chance', '概率随机'], ['authored', '关卡标记']]
    );
    assert.equal(mode.value, 'chance');
    assert.equal(chance.value, '30');
    assert.equal(chance.getAttribute('min'), '0');
    assert.equal(chance.getAttribute('max'), '100');
    assert.equal(chance.getAttribute('step'), '1');
    assert.equal(chanceOutput.textContent, '30%');
    assert.equal(maxLength.value, '10');
    assert.equal(maxLength.getAttribute('min'), '2');
    assert.equal(maxLength.getAttribute('max'), '10');
    assert.equal(maxLength.getAttribute('step'), '1');
    assert.equal(lengthOutput.textContent, '10');
    assert.equal(chanceRow.hidden, false);
    assert.equal(lengthRow.hidden, false);
    assert.equal(authoredSummary.hidden, true);
    assert.match(authoredSummary.textContent, /12/);
    assert.match(authoredSummary.textContent, /66/);
    assert.doesNotMatch(authoredSummary.textContent, /固定标记：2 组连体/);
    assert.doesNotMatch(authoredSummary.textContent, /，5 排乘客/);

    chance.value = '45';
    chance.dispatchEvent({ type: 'change', bubbles: false, target: null });
    maxLength.value = '6';
    maxLength.dispatchEvent({ type: 'change', bubbles: false, target: null });
    mode.value = 'authored';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });

    assert.equal(chanceRow.hidden, true);
    assert.equal(lengthRow.hidden, true);
    assert.equal(authoredSummary.hidden, false);
    assert.equal(authoredSummary.textContent, '固定标记：12 组连体，66 排乘客');
    assert.deepEqual(commits, [
      { mode: 'chance', chance: 0.45, maxLength: 10 },
      { mode: 'chance', chance: 0.45, maxLength: 6 },
      { mode: 'authored', chance: 0.45, maxLength: 6 }
    ]);

    extension.destroy();
    chance.value = '70';
    chance.dispatchEvent({ type: 'change', bubbles: false, target: null });
    maxLength.value = '4';
    maxLength.dispatchEvent({ type: 'change', bubbles: false, target: null });
    mode.value = 'chance';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });
    assert.equal(commits.length, 3);
  } finally {
    fixture.restore();
  }
});

test('question passenger detail view renders chance controls and authored visibility', () => {
  const fixture = createLibraryFixture();

  try {
    const view = createQuestionPassengerDetailView({
      document: fixture.document,
      options: { chance: 0.3 }
    });
    const mode = view.element.querySelector('[data-question-mode]');
    const chance = view.element.querySelector('[data-question-chance]');
    const output = view.element.querySelector('[data-question-chance-output]');
    const chanceRow = view.element.querySelector('[data-question-chance-row]');
    const authoredSummary = view.element.querySelector('[data-question-authored-summary]');

    assert.equal(view.element.querySelector('h3').textContent, '机制设置');
    assert.deepEqual(
      mode.querySelectorAll('option').map((option) => [option.value, option.textContent]),
      [['chance', '概率随机'], ['authored', '关卡标记']]
    );
    assert.equal(mode.value, 'chance');
    assert.equal(chance.value, '30');
    assert.equal(chance.getAttribute('min'), '0');
    assert.equal(chance.getAttribute('max'), '100');
    assert.equal(chance.getAttribute('step'), '1');
    assert.equal(output.textContent, '30%');
    assert.match(chance.id, /^question-passenger-chance-\d+$/);
    assert.equal(output.getAttribute('for'), chance.id);
    assert.equal(chance.getAttribute('aria-valuetext'), '30%');
    assert.equal(chanceRow.hidden, false);
    assert.equal(authoredSummary.hidden, true);
    assert.equal(authoredSummary.textContent, '固定标记：0/0 组');
    view.destroy();
  } finally {
    fixture.restore();
  }
});

test('question passenger detail view commits normalized mode and authored counts once', () => {
  const fixture = createLibraryFixture();
  const commits = [];

  try {
    const view = createQuestionPassengerDetailView({
      document: fixture.document,
      options: { mode: 'authored', chance: '0.45' },
      state: { questionPassenger: { authoredMarked: 3, authoredTotal: 8 } },
      onCommit: (options) => commits.push(options)
    });
    const mode = view.element.querySelector('[data-question-mode]');
    const chanceRow = view.element.querySelector('[data-question-chance-row]');
    const authoredSummary = view.element.querySelector('[data-question-authored-summary]');

    assert.equal(mode.value, 'authored');
    assert.equal(chanceRow.hidden, true);
    assert.equal(authoredSummary.hidden, false);
    assert.equal(authoredSummary.textContent, '固定标记：3/8 组');

    mode.value = 'invalid';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });

    assert.equal(mode.value, 'chance');
    assert.equal(chanceRow.hidden, false);
    assert.equal(authoredSummary.hidden, true);
    assert.deepEqual(commits, [{ mode: 'chance', chance: 0.45 }]);
    view.destroy();
  } finally {
    fixture.restore();
  }
});

test('question passenger mode transitions retain quantized fractional chance with exact commits', () => {
  const fixture = createLibraryFixture();
  const commits = [];

  try {
    const view = createQuestionPassengerDetailView({
      document: fixture.document,
      options: { mode: 'chance', chance: 0.304 },
      onCommit: (options) => commits.push(options)
    });
    const mode = view.element.querySelector('[data-question-mode]');
    const chance = view.element.querySelector('[data-question-chance]');
    const output = view.element.querySelector('[data-question-chance-output]');
    const chanceRow = view.element.querySelector('[data-question-chance-row]');
    const authoredSummary = view.element.querySelector('[data-question-authored-summary]');

    assert.equal(chance.value, '30');
    assert.equal(output.textContent, '30%');

    mode.value = 'authored';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });
    assert.equal(chanceRow.hidden, true);
    assert.equal(authoredSummary.hidden, false);
    assert.deepEqual(commits, [{ mode: 'authored', chance: 0.3 }]);

    mode.value = 'chance';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });
    assert.equal(chanceRow.hidden, false);
    assert.equal(authoredSummary.hidden, true);
    assert.deepEqual(commits, [
      { mode: 'authored', chance: 0.3 },
      { mode: 'chance', chance: 0.3 }
    ]);
    view.destroy();
  } finally {
    fixture.restore();
  }
});

test('question passenger chance input previews, change commits, and destroy detaches controls', () => {
  const fixture = createLibraryFixture();
  const commits = [];

  try {
    const view = createQuestionPassengerDetailView({
      document: fixture.document,
      options: { chance: Number.POSITIVE_INFINITY },
      onCommit: (options) => commits.push(options)
    });
    const mode = view.element.querySelector('[data-question-mode]');
    const chance = view.element.querySelector('[data-question-chance]');
    const output = view.element.querySelector('[data-question-chance-output]');

    assert.equal(chance.value, '30');
    chance.value = '45';
    chance.dispatchEvent({ type: 'input', bubbles: false, target: null });
    assert.equal(output.textContent, '45%');
    assert.equal(chance.getAttribute('aria-valuetext'), '45%');
    assert.deepEqual(commits, []);

    chance.dispatchEvent({ type: 'change', bubbles: false, target: null });
    assert.deepEqual(commits, [{ mode: 'chance', chance: 0.45 }]);

    view.destroy();
    chance.value = '72';
    chance.dispatchEvent({ type: 'input', bubbles: false, target: null });
    chance.dispatchEvent({ type: 'change', bubbles: false, target: null });
    mode.value = 'authored';
    mode.dispatchEvent({ type: 'change', bubbles: false, target: null });

    assert.equal(output.textContent, '45%');
    assert.deepEqual(commits, [{ mode: 'chance', chance: 0.45 }]);
  } finally {
    fixture.restore();
  }
});

test('registry contains base plus sixteen unique mechanic entries', () => {
  assert.equal(MECHANICS.length, 17);
  assert.equal(new Set(MECHANICS.map(({ id }) => id)).size, 17);
  assert.deepEqual(
    MECHANICS.map(({ id }) => id),
    ['base', ...MECHANIC_IDS_AFTER_BASE]
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

test('implemented mechanic presets including train are playable while remaining presets are planned', () => {
  assert.equal(getMechanicById('base').status, 'playable');
  assert.equal(getMechanicById('question-passenger').status, 'playable');
  assert.equal(getMechanicById('garage').status, 'playable');
  assert.equal(getMechanicById('star-passenger').status, 'playable');
  assert.equal(getMechanicById('question-passenger').status, 'playable');
  assert.equal(getMechanicById('garage').status, 'playable');
  assert.equal(getMechanicById('star-passenger').status, 'playable');
  assert.equal(getMechanicById('order-passenger').status, 'playable');
  assert.equal(getMechanicById('valve').status, 'playable');
  assert.equal(getMechanicById('count-garage').status, 'playable');
  assert.equal(getMechanicById('linked-passengers').status, 'playable');
  assert.equal(resolvePlayableMechanicId('linked-passengers'), 'linked-passengers');
  assert.equal(getMechanicById('train').status, 'playable');
  assert.equal(resolvePlayableMechanicId('train'), 'train');
  assert.equal(MECHANICS.filter(({ status }) => status === 'playable').length, 9);
  assert.equal(MECHANICS.filter(({ status }) => status === 'planned').length, 8);
  assert.equal(PLANNED_MECHANIC_IDS.length, 8);
});

test('registry and nested category arrays are deeply frozen', () => {
  assert.ok(Object.isFrozen(MECHANICS));
  for (const mechanic of MECHANICS) {
    assert.ok(Object.isFrozen(mechanic));
    assert.ok(Object.isFrozen(mechanic.categories));
  }
});

test('filterMechanics searches names, summaries, and categories', () => {
  assert.deepEqual(
    filterMechanics('车库').map(({ id }) => id),
    ['garage', 'locked-garage', 'count-garage']
  );
  assert.deepEqual(filterMechanics('订单').map(({ id }) => id), ['order-passenger']);
  assert.deepEqual(filterMechanics('火车').map(({ id }) => id), ['train']);
  assert.deepEqual(filterMechanics('磁悬浮').map(({ id }) => id), ['maglev-spot']);
  assert.deepEqual(
    filterMechanics('信息隐藏').map(({ id }) => id),
    ['question-passenger', 'question-vehicle']
  );
  assert.deepEqual(filterMechanics('  '), MECHANICS);
});

test('filterMechanics returns a mutable copy for an empty search', () => {
  const result = filterMechanics('');

  assert.notEqual(result, MECHANICS);
  assert.doesNotThrow(() => result.sort(({ id: a }, { id: b }) => a.localeCompare(b)));
});

test('filterMechanicCollection searches a provided custom collection', () => {
  const customMechanics = [
    {
      id: 'custom-name',
      name: 'Signal Relay',
      summary: 'Redirects arriving buses',
      categories: ['Routing']
    },
    {
      id: 'custom-summary',
      name: 'Platform Clock',
      summary: 'Rewards precise timing',
      categories: ['Scoring']
    },
    {
      id: 'custom-category',
      name: 'Depot Queue',
      summary: 'Stores vehicles off stage',
      categories: ['Capacity']
    }
  ];

  assert.deepEqual(
    filterMechanicCollection(customMechanics, 'signal').map(({ id }) => id),
    ['custom-name']
  );
  assert.deepEqual(
    filterMechanicCollection(customMechanics, 'precise').map(({ id }) => id),
    ['custom-summary']
  );
  assert.deepEqual(
    filterMechanicCollection(customMechanics, 'capacity').map(({ id }) => id),
    ['custom-category']
  );
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

test('safeRemoveStorageItem returns true when storage removal succeeds', () => {
  const removedKeys = [];
  const storage = {
    removeItem(key) {
      removedKeys.push(key);
    }
  };

  assert.equal(typeof safeRemoveStorageItem, 'function');
  assert.equal(safeRemoveStorageItem(storage, 'scene-tuning'), true);
  assert.deepEqual(removedKeys, ['scene-tuning']);
});

test('safeRemoveStorageItem reports storage removal errors without throwing', () => {
  const error = new DOMException('Storage access denied', 'SecurityError');
  const reportedErrors = [];
  const storage = {
    removeItem() {
      throw error;
    }
  };

  assert.equal(typeof safeRemoveStorageItem, 'function');
  assert.doesNotThrow(() => {
    assert.equal(
      safeRemoveStorageItem(storage, 'scene-tuning', (caught) => reportedErrors.push(caught)),
      false
    );
  });
  assert.deepEqual(reportedErrors, [error]);
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

test('query replacement preserves a double-slash pathname', () => {
  assert.equal(
    replaceMechanicQuery('//lab?foo=1#preview', 'garage'),
    '//lab?foo=1&mechanic=garage#preview'
  );
});

test('query synchronization replaces the current location with a resolved id', () => {
  const calls = [];
  const location = {
    origin: 'https://busloop.local',
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

  assert.deepEqual(calls, [[null, '', 'https://busloop.local/lab?foo=1&mechanic=base#preview']]);
});

test('query synchronization keeps a double-slash pathname on the current origin', () => {
  const calls = [];
  const location = {
    origin: 'https://busloop.local',
    pathname: '//lab',
    search: '?foo=1',
    hash: '#x'
  };
  const history = {
    replaceState(...args) {
      calls.push(args);
    }
  };

  syncMechanicQuery('garage', location, history);

  assert.deepEqual(calls, [[
    null,
    '',
    'https://busloop.local//lab?foo=1&mechanic=garage#x'
  ]]);
});
