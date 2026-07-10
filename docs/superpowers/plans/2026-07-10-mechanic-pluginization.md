# Mechanic Pluginization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor BusLoop mechanic demos so each mechanic can be owned in its own directory, while preserving the current playable base and star passenger behavior.

**Architecture:** Mechanic metadata moves from a single registry array into `src/mechanics/<mechanic-id>/index.js`. Playable mechanics expose runtime hooks consumed by `BusLoopGame`; planned mechanics expose only definitions. Star passenger becomes the reference implementation with isolated model and view files.

**Tech Stack:** Vite, browser ES modules, Three.js scene view, Node `node:test`.

---

### Task 1: Add Architecture Guard Tests

**Files:**
- Create: `test/mechanic-architecture.test.js`
- Modify: none

- [ ] **Step 1: Write the failing architecture tests**

```js
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
  assert.equal(new Set(MECHANIC_MODULES.map((module) => module.definition.id)).size, MECHANIC_MODULES.length);
  assert.equal(getMechanicModuleById('star-passenger').definition.name, '星星乘客');
});

test('planned mechanics resolve to base runtime while playable mechanics keep their id', () => {
  assert.equal(resolvePlayableMechanicId('star-passenger'), 'star-passenger');
  assert.equal(resolvePlayableMechanicId('train'), 'base');
  assert.equal(createMechanicRuntime('train').id, 'base');
  assert.equal(createMechanicRuntime('star-passenger', { random: () => 1 }).id, 'star-passenger');
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
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/mechanic-architecture.test.js`

Expected: FAIL because `src/mechanics/index.js` and star passenger module files do not exist yet.

---

### Task 2: Split Mechanic Definitions

**Files:**
- Create: `src/mechanics/base/index.js`
- Create: `src/mechanics/<planned-id>/index.js` for each planned mechanic
- Create: `src/mechanics/star-passenger/index.js`
- Create: `src/mechanics/index.js`
- Modify: `src/mechanic-registry.js`
- Test: `test/mechanic-architecture.test.js`, `test/mechanic-registry.test.js`

- [ ] **Step 1: Create one module per mechanic**

Each module exports a `definition` object:

```js
export const definition = {
  id: 'base',
  name: '基础规则',
  categories: ['基础规则'],
  status: 'playable',
  summary: '车辆进入停车位后，匹配颜色的乘客依次上车。',
  effect: '提供车辆调度、颜色匹配、乘客上车和停车位周转的基础循环。',
  experience: '玩家观察阻挡关系并安排车辆顺序，让对应颜色的乘客顺利上车。',
  difficulty: '基础'
};

export default { definition };
```

- [ ] **Step 2: Add module aggregation**

`src/mechanics/index.js` imports all mechanic modules in display order, exports `MECHANIC_MODULES`, `MECHANIC_DEFINITIONS`, `getMechanicModuleById`, `resolvePlayableMechanicId`, and `createMechanicRuntime`.

- [ ] **Step 3: Make registry read aggregated definitions**

`src/mechanic-registry.js` imports `MECHANIC_DEFINITIONS` and freezes them into the public `MECHANICS` array.

- [ ] **Step 4: Verify definition tests**

Run:

```bash
node --test test/mechanic-architecture.test.js
node --test test/mechanic-registry.test.js
```

Expected: registry tests pass; architecture tests still fail until runtime files are implemented.

---

### Task 3: Move Star Passenger Runtime Hooks

**Files:**
- Create: `src/mechanics/star-passenger/model.js`
- Modify: `src/mechanics/base/index.js`
- Modify: `src/mechanics/star-passenger/index.js`
- Modify: `src/game-model.js`
- Test: `test/star-passenger-mechanic.test.js`, `test/mechanic-architecture.test.js`

- [ ] **Step 1: Implement no-op base runtime**

Base runtime exposes hook names with no-op behavior:

```js
export function createBaseRuntime() {
  return {
    id: 'base',
    createState: () => ({}),
    createQueueItemData: () => ({}),
    createSlotData: () => ({}),
    cloneQueueItemSnapshot: () => ({}),
    cloneSlotSnapshot: () => ({}),
    decorateSnapshot: () => ({})
  };
}
```

- [ ] **Step 2: Implement star runtime**

`createStarPassengerRuntime({ random, options })` owns reward state, random generation, clone helpers, exit pass counting, and boarding reward collection.

- [ ] **Step 3: Replace star-specific game-model methods with runtime hooks**

`BusLoopGame` calls `createMechanicRuntime`, stores `this.mechanicRuntime`, and delegates queue item creation, passenger entry, exit crossing, boarding, slot cleanup, and snapshot decoration through hooks.

- [ ] **Step 4: Verify behavior**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
node --test test/mechanic-architecture.test.js
```

Expected: both pass.

---

### Task 4: Move Star Passenger UI

**Files:**
- Create: `src/mechanics/star-passenger/view.js`
- Create: `src/mechanics/star-passenger/styles.css`
- Create: `src/mechanics/ui.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Test: `test/star-passenger-mechanic.test.js`, `test/mechanic-architecture.test.js`

- [ ] **Step 1: Implement `createStarPassengerHud`**

The view module creates its own HUD DOM inside `stage`, syncs progress from `snapshot.starReward`, and spawns the flying star effect when coin count increases.

- [ ] **Step 2: Add UI controller aggregation**

`src/mechanics/ui.js` exports `createMechanicUiControllers(context)` and returns the star passenger HUD controller.

- [ ] **Step 3: Make main use UI controllers**

`src/main.js` imports `createMechanicUiControllers`, creates controllers after `stage` exists, calls `sync` from `syncHud`, and calls `reset` during reset and mechanism switches.

- [ ] **Step 4: Remove star passenger HUD from `index.html`**

The HUD becomes owned by `src/mechanics/star-passenger/view.js`.

- [ ] **Step 5: Verify UI source tests**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
node --test test/mechanic-architecture.test.js
```

Expected: both pass.

---

### Task 5: Document Collaboration Workflow

**Files:**
- Create: `docs/mechanic-collaboration.md`
- Modify: `README.md`

- [ ] **Step 1: Document per-mechanic ownership**

Write the branch workflow, mechanism directory structure, required files, and verification commands.

- [ ] **Step 2: Link docs from README**

Add a short note that new mechanism demos should start under `src/mechanics/<mechanic-id>/`.

- [ ] **Step 3: Verify build and focused tests**

Run:

```bash
node --test test/mechanic-architecture.test.js
node --test test/star-passenger-mechanic.test.js
node --test test/mechanic-registry.test.js
npm run build
```

Expected: all focused tests and build pass.

---
