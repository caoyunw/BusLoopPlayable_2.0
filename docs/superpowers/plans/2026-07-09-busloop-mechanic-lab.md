# BusLoop Mechanic Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the playable-ad delivery layer and turn the existing BusLoop runtime into a design-facing mechanic lab with a searchable 10-mechanic catalog and a playable base scenario.

**Architecture:** A pure mechanic registry owns metadata and selection helpers. A DOM-focused mechanic library renders the left rail, while the existing game runtime remains the single playable base preview and is paused behind an explanatory overlay for unimplemented mechanics. `main.js` composes these modules with the existing Three.js view and scene editor without embedding mechanic metadata or advertising behavior.

**Tech Stack:** Vite, native ES modules, Three.js, Node.js test runner, Playwright browser validation.

---

## File Structure

- Create `src/mechanic-registry.js`: immutable mechanic definitions, lookup, search, and ID resolution.
- Create `src/mechanic-library.js`: mechanic rail rendering, grouped list, search, detail panel, and selection callbacks.
- Create `src/mechanic-lab.js`: query-string parsing/writing and current-mechanic state coordination.
- Create `test/mechanic-registry.test.js`: pure registry and URL-state tests.
- Modify `src/main.js`: remove ad behavior and connect selection state to the base runtime pause/reset lifecycle.
- Modify `index.html`: replace ad shell with mechanic lab structure.
- Modify `src/styles.css`: add three-column/compact drawer UI and remove CTA/ad presentation.
- Modify `src/scene-editor.js`: default the tuning editor to collapsed and expose teardown-safe control.
- Modify `src/level-data.js` and `src/scene-view.js`: point retained compressed assets at `/assets/runtime/`.
- Modify `test/game-model.test.js`: replace ad source-contract assertions with mechanic-lab runtime assertions.
- Delete AppLovin package scripts and generated packages.
- Update project navigation, progress, findings, and README.

### Task 1: Mechanic Registry And URL State

**Files:**
- Create: `src/mechanic-registry.js`
- Create: `src/mechanic-lab.js`
- Create: `test/mechanic-registry.test.js`

- [ ] **Step 1: Write failing registry and URL tests**

```js
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
  replaceMechanicQuery
} from '../src/mechanic-lab.js';

test('registry contains base plus ten unique mechanic entries', () => {
  assert.equal(MECHANICS.length, 11);
  assert.equal(new Set(MECHANICS.map(({ id }) => id)).size, 11);
  assert.equal(getMechanicById('base').status, 'playable');
  assert.equal(MECHANICS.filter(({ status }) => status === 'planned').length, 10);
});

test('mechanic metadata is complete and searchable', () => {
  for (const mechanic of MECHANICS) {
    assert.ok(mechanic.name);
    assert.ok(mechanic.categories.length);
    assert.ok(mechanic.effect);
    assert.ok(mechanic.experience);
    assert.ok(mechanic.difficulty);
  }
  assert.deepEqual(filterMechanics('车库').map(({ id }) => id), ['garage']);
});

test('invalid mechanic ids fall back to base', () => {
  assert.equal(resolveMechanicId('garage'), 'garage');
  assert.equal(resolveMechanicId('missing'), 'base');
  assert.equal(getMechanicIdFromSearch('?mechanic=question-vehicle'), 'question-vehicle');
  assert.equal(replaceMechanicQuery('/lab?foo=1', 'garage'), '/lab?foo=1&mechanic=garage');
});
```

- [ ] **Step 2: Run the test and verify module-not-found failure**

Run: `node --test test/mechanic-registry.test.js`

Expected: FAIL because `src/mechanic-registry.js` and `src/mechanic-lab.js` do not exist.

- [ ] **Step 3: Implement the immutable registry**

Create `src/mechanic-registry.js` with `base` and the ten confirmed entries. Each object must contain:

```js
{
  id: 'garage',
  name: '车库',
  categories: ['信息', '空间'],
  status: 'planned',
  summary: '前车离开后，下一辆车才从车库中出现。',
  effect: '延迟揭示后续车辆并建立处理顺序。',
  experience: '玩家需要为尚未出现的车辆预留空间和颜色匹配余量。',
  difficulty: '低'
}
```

Export:

```js
export const MECHANICS = Object.freeze(definitions.map((item) => Object.freeze({
  ...item,
  categories: Object.freeze([...item.categories])
})));

export function getMechanicById(id) {
  return MECHANICS.find((mechanic) => mechanic.id === id) ?? null;
}

export function resolveMechanicId(id) {
  return getMechanicById(id)?.id ?? 'base';
}

export function filterMechanics(query = '') {
  const value = query.trim().toLocaleLowerCase('zh-CN');
  if (!value) return MECHANICS;
  return MECHANICS.filter((mechanic) =>
    [mechanic.name, mechanic.summary, ...mechanic.categories]
      .some((text) => text.toLocaleLowerCase('zh-CN').includes(value))
  );
}
```

- [ ] **Step 4: Implement pure URL helpers**

Create `src/mechanic-lab.js`:

```js
import { resolveMechanicId } from './mechanic-registry.js';

export function getMechanicIdFromSearch(search = '') {
  return resolveMechanicId(new URLSearchParams(search).get('mechanic'));
}

export function replaceMechanicQuery(pathAndSearch, mechanicId) {
  const url = new URL(pathAndSearch, 'https://busloop.local');
  url.searchParams.set('mechanic', resolveMechanicId(mechanicId));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function syncMechanicQuery(mechanicId, location = window.location, history = window.history) {
  history.replaceState(null, '', replaceMechanicQuery(
    `${location.pathname}${location.search}${location.hash}`,
    mechanicId
  ));
}
```

- [ ] **Step 5: Run focused tests**

Run: `node --test test/mechanic-registry.test.js`

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/mechanic-registry.js src/mechanic-lab.js test/mechanic-registry.test.js
git commit -m "feat: add mechanic registry and selection state"
```

### Task 2: Mechanic Library UI

**Files:**
- Create: `src/mechanic-library.js`
- Modify: `index.html`
- Modify: `src/styles.css`
- Test: `test/mechanic-registry.test.js`

- [ ] **Step 1: Add failing source-contract assertions**

Append:

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('page shell and library module expose the mechanic lab controls', () => {
  const html = readFileSync(join('index.html'), 'utf8');
  const librarySource = readFileSync(join('src', 'mechanic-library.js'), 'utf8');
  for (const id of [
    'mechanic-library',
    'mechanic-search',
    'mechanic-list',
    'mechanic-detail',
    'mechanic-overlay',
    'mechanic-back-button'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(librarySource, /export function createMechanicLibrary/);
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test test/mechanic-registry.test.js`

Expected: FAIL because the new DOM and UI module are absent.

- [ ] **Step 3: Replace the page shell**

Make `index.html` use this semantic structure:

```html
<div id="app" class="mechanic-lab">
  <aside id="mechanic-library" class="mechanic-library" aria-label="机制库">
    <header class="library-header">
      <p class="library-kicker">BUSLOOP LAB</p>
      <h1>机制实验台</h1>
      <input id="mechanic-search" type="search" placeholder="搜索机制" aria-label="搜索机制" />
    </header>
    <div id="mechanic-list" class="mechanic-list"></div>
    <section id="mechanic-detail" class="mechanic-detail" aria-live="polite"></section>
  </aside>
  <main id="stage" class="stage">
    <canvas id="game-canvas" aria-label="BusLoop 机制体验盘面"></canvas>
    <div id="loading-screen" class="loading-screen" role="status" aria-live="polite">
      <p class="loading-kicker">BUSLOOP LAB</p>
      <h2>正在准备机制场景</h2>
      <div class="loading-progress" role="progressbar" aria-label="加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div id="loading-progress-bar" class="loading-progress-bar"></div>
      </div>
      <p id="loading-progress-value" class="loading-progress-value">0%</p>
    </div>
    <section id="mechanic-overlay" class="mechanic-overlay" hidden>
      <p class="mechanic-overlay-kicker">机制预览</p>
      <h2 id="mechanic-overlay-title"></h2>
      <p id="mechanic-overlay-summary"></p>
      <button id="mechanic-back-button" type="button">返回基础规则</button>
    </section>
    <div id="end-panel" class="end-panel" hidden>
      <p id="end-kicker">关卡完成</p>
      <h2 id="end-title">全部车辆已发车</h2>
      <button id="end-reset-button" type="button">重新体验</button>
    </div>
  </main>
  <aside id="scene-editor" class="scene-editor" aria-label="场景调参"></aside>
</div>
```

- [ ] **Step 4: Implement grouped list and details**

`createMechanicLibrary(root, { mechanics, activeId, onSelect })` must:

- render grouped buttons from the filtered registry;
- display textual `可试玩` or `待实现` status;
- update `aria-current`;
- render effect, experience, difficulty, and categories in `#mechanic-detail`;
- return `{ setActive(id), destroy() }`;
- remove the search listener in `destroy()`.

- [ ] **Step 5: Add responsive tool UI styles**

Implement a quiet three-column desktop layout using fixed responsive tracks:

```css
#app {
  display: grid;
  grid-template-columns: minmax(236px, 286px) minmax(0, 1fr) auto;
}
.mechanic-library { min-width: 0; overflow: hidden; }
.mechanic-list { min-height: 0; overflow-y: auto; }
.mechanic-item { width: 100%; min-height: 44px; border-radius: 6px; }
.mechanic-overlay[hidden] { display: none; }
@media (max-width: 860px) {
  #app { display: block; }
  .mechanic-library { position: absolute; inset: 8px auto 8px 8px; width: min(286px, calc(100vw - 72px)); }
  .mechanic-library.is-collapsed { width: 48px; height: 48px; }
}
```

Remove CTA rules and avoid nested cards, decorative gradients, oversized headings, and pill-shaped text controls.

- [ ] **Step 6: Run focused tests**

Run: `node --test test/mechanic-registry.test.js`

Expected: all registry/UI contract tests pass.

- [ ] **Step 7: Commit**

```bash
git add index.html src/styles.css src/mechanic-library.js test/mechanic-registry.test.js
git commit -m "feat: add mechanic library shell"
```

### Task 3: Connect The Base Runtime And Remove Ad Behavior

**Files:**
- Modify: `src/main.js`
- Modify: `src/scene-editor.js`
- Modify: `test/game-model.test.js`
- Test: `test/mechanic-registry.test.js`

- [ ] **Step 1: Replace ad contract assertions with lab assertions**

Delete expectations for store URLs, MRAID, CTA, install counters, and `InstallFullGame`. Add:

```js
assert.match(mainSource, /from '\.\/mechanic-registry\.js'/);
assert.match(mainSource, /from '\.\/mechanic-library\.js'/);
assert.match(mainSource, /from '\.\/mechanic-lab\.js'/);
assert.match(mainSource, /let paused =/);
assert.match(mainSource, /function selectMechanic/);
assert.match(mainSource, /syncMechanicQuery\(activeMechanic\.id\)/);
assert.match(mainSource, /mechanicOverlay\.hidden = !paused/);
assert.doesNotMatch(mainSource, /mraid|InstallFullGame|play\.google\.com|apps\.apple\.com|ctaButton/);
```

- [ ] **Step 2: Run focused tests and verify the old runtime fails them**

Run:

```bash
node --test --test-name-pattern "main thread saves|mechanic" test/game-model.test.js test/mechanic-registry.test.js
```

Expected: FAIL on missing mechanic-lab source contracts.

- [ ] **Step 3: Strip advertising code from `main.js`**

Remove:

- `STORE_URL`, `STORE_OPEN_COOLDOWN_MS`, `MAX_NUMBER_COUNT_BUS`;
- MRAID readiness handling;
- CTA DOM references and tuning;
- iOS/store helpers;
- install counters and install-gate interception;
- `InstallFullGame`, `openStore`, and `installState` from `window.__busLoop`.

Start the runtime directly with `startRuntime()`.

- [ ] **Step 4: Connect mechanic selection to the base preview**

Use a single base runtime and a paused flag:

```js
let activeMechanic = getMechanicById(getMechanicIdFromSearch(location.search));
let paused = activeMechanic.status !== 'playable';

function selectMechanic(id, { syncUrl = true } = {}) {
  activeMechanic = getMechanicById(resolveMechanicId(id));
  paused = activeMechanic.status !== 'playable';
  mechanicLibrary.setActive(activeMechanic.id);
  mechanicOverlay.hidden = !paused;
  mechanicOverlayTitle.textContent = activeMechanic.name;
  mechanicOverlaySummary.textContent = activeMechanic.summary;
  canvas.toggleAttribute('inert', paused);
  if (syncUrl) syncMechanicQuery(activeMechanic.id);
}

const handleVehicleClick = (vehicleId) => {
  if (paused) return { ok: false, reason: 'mechanic-preview-paused' };
  return game.clickVehicle(vehicleId);
};

function frame(now) {
  const delta = (now - previous) / 1000;
  previous = now;
  if (!paused) game.update(delta);
  view.update(game.snapshot(), game);
  view.render();
  requestAnimationFrame(frame);
}
```

The back button calls `selectMechanic('base')`. The QA API exposes `currentMechanic`, `selectMechanic`, `isPaused`, and no advertising methods.

- [ ] **Step 5: Collapse the scene editor by default**

Call `setCollapsed(true)` after `createSceneEditor` initializes. Keep its existing toggle and tuning-save behavior.

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
node --test --test-name-pattern "main thread saves|mechanic" test/game-model.test.js test/mechanic-registry.test.js
npm test
```

Expected: focused tests pass; full suite passes or exposes only pre-existing blocker assertions, which must be investigated before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/scene-editor.js test/game-model.test.js
git commit -m "refactor: convert runtime to mechanic lab"
```

### Task 4: Migrate Runtime Assets And Delete AppLovin Delivery

**Files:**
- Move: `public/assets/applovin/` to `public/assets/runtime/`
- Delete: `public/assets/runtime/icon_q75.jpg`
- Modify: `src/level-data.js`
- Modify: `src/scene-view.js`
- Modify: `package.json`
- Delete: `scripts/package-applovin-single-html.mjs`
- Delete: `scripts/check-applovin-package.mjs`
- Delete: `artifacts/applovin/`
- Delete: `artifacts/asset-compress-tests/`
- Modify: `test/game-model.test.js`
- Modify: `test/mechanic-registry.test.js`

- [ ] **Step 1: Add failing resource and ad-removal checks**

Add:

```js
test('active runtime uses neutral assets and contains no ad delivery hooks', () => {
  const activeFiles = [
    'index.html',
    'package.json',
    'src/main.js',
    'src/level-data.js',
    'src/scene-view.js'
  ].map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.match(activeFiles, /\/assets\/runtime\//);
  assert.doesNotMatch(
    activeFiles,
    /mraid|InstallFullGame|play\.google\.com\/store|apps\.apple\.com\/app|Play Now|package:applovin|check:applovin|\/assets\/applovin\//
  );
});
```

- [ ] **Step 2: Run focused checks**

Run: `node --test --test-name-pattern "assets|main thread saves|mechanic" test/game-model.test.js test/mechanic-registry.test.js`

Expected: FAIL while old paths and advertising scripts remain.

- [ ] **Step 3: Verify and move the asset directory**

Before moving, resolve both paths and verify the source is inside the repository and the destination does not exist. Then move the explicit directory and delete only `public/assets/runtime/icon_q75.jpg`.

- [ ] **Step 4: Update runtime references**

Replace all retained `/assets/applovin/` references in `src/level-data.js` and `src/scene-view.js` with `/assets/runtime/`.

- [ ] **Step 5: Remove delivery scripts and generated artifacts**

Delete the two AppLovin scripts and the two advertising/compression artifact directories. Remove `package:applovin` and `check:applovin` from `package.json`; retain `apply:tuning`, `dev`, `build`, `preview`, and `test`.

- [ ] **Step 6: Verify absence and buildability**

Run:

```bash
rg -n "mraid|InstallFullGame|play\\.google\\.com/store|apps\\.apple\\.com/app|Play Now|package:applovin|check:applovin|assets/applovin" src index.html package.json scripts test
npm test
npm run build
```

Expected: `rg` returns no matches; tests and build pass.

- [ ] **Step 7: Commit**

```bash
git add -A -- public/assets src/level-data.js src/scene-view.js package.json scripts artifacts test
git commit -m "chore: remove playable ad delivery"
```

### Task 5: Documentation And Browser Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/project/code-navigation.md`
- Modify: `docs/project/playable-project-progress.md`
- Modify: `findings.md`
- Modify: `task_plan.md`
- Modify: `progress.md`

- [ ] **Step 1: Document the new project identity**

README must include:

- purpose: BusLoop mechanic design and experience lab;
- `npm install`, `npm run dev`, `npm test`, and `npm run build`;
- registry fields and steps for adding a mechanic;
- note that ad-platform delivery is intentionally absent.

- [ ] **Step 2: Update code ownership and durable findings**

Add the three new modules and their tests to `code-navigation.md`. Add a concise progress entry recording the ad removal, 10-entry catalog, verification, and remaining work: implementing each planned mechanic.

- [ ] **Step 3: Start the development server**

Run: `npm run dev -- --port 4173`

Expected: Vite reports a local URL and remains running for QA.

- [ ] **Step 4: Validate desktop and mobile with Playwright**

Desktop viewport: `1440x1000`.

- Assert canvas dimensions are non-zero.
- Confirm left library, stage, and collapsed right editor are visible without overlap.
- Select `车库`; assert URL contains `mechanic=garage`, overlay text is visible, and canvas is inert.
- Click “返回基础规则”; assert overlay is hidden and a known unblocked vehicle can be clicked.

Mobile viewport: `390x844`.

- Confirm the stage fills the viewport.
- Open the mechanism drawer and select `问号车`.
- Confirm long names/status text fit and the editor remains collapsed.
- Capture screenshots for both viewports and inspect them.

- [ ] **Step 5: Run final verification**

Run:

```bash
git diff --check
npm test
npm run build
git status --short
```

Expected: no whitespace errors; tests/build pass; only the user-owned `BusLoopPlayable_new/` remains untracked.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/project/code-navigation.md docs/project/playable-project-progress.md findings.md task_plan.md progress.md
git commit -m "docs: document mechanic lab workflow"
```
