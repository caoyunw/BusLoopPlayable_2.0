# Star Passenger Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make star passenger lifetime readable as a `3 -> 2 -> 1` badge, change coin charge to a repeatable `0/20` loop, and celebrate every completed charge without interrupting play.

**Architecture:** Keep lifetime and charge truth inside the star passenger runtime. `scene-view.js` reads passenger reward snapshots to render the world-space number badge and one-shot `-1`; the mechanic-owned HUD controller temporarily presents `20/20` while the model has already reset the next charge to zero. Completion is keyed by a monotonic `completedCharges` counter so animation is repeatable and de-duplicated.

**Tech Stack:** Browser ES modules, Three.js, DOM/CSS animations, Node `node:test`, Vite.

---

## File Map

| File | Responsibility in this change |
| --- | --- |
| `src/mechanics/star-passenger/model.js` | Remaining exit passes, decrement version, current charge, completed charge count. |
| `src/scene-view.js` | Three.js number badge and one-shot `-1` feedback beside a passenger. |
| `src/mechanics/star-passenger/view.js` | `0/20` HUD rendering, visual `20/20` hold, celebration lifecycle and cleanup. |
| `src/mechanics/star-passenger/styles.css` | Charge sweep, particle burst, pulse, ring and reduced-motion behavior. |
| `test/star-passenger-mechanic.test.js` | Runtime behavior and source wiring contracts. |
| `README.md` | Current star passenger behavior. |
| `docs/mechanic-lab-handoff.md` | New-conversation handoff state and validation baseline. |

Do not add markup to `index.html`. Do not move star-specific charge rules into `main.js` or `game-model.js`.

### Task 1: Add Lifetime And Repeatable Charge State

**Files:**
- Modify: `test/star-passenger-mechanic.test.js`
- Modify: `src/mechanics/star-passenger/model.js`

- [ ] **Step 1: Update the test factory to use a 20-coin target**

Change `makeStarGame` to pass the new target explicitly so tests state their intent:

```js
function makeStarGame(randomValues = [0]) {
  return new BusLoopGame(TEST_LEVEL, {
    mechanicId: 'star-passenger',
    random: makeRandom(randomValues),
    starPassenger: { chance: 0.5, expireExitPasses: 3, progressTarget: 20 }
  });
}
```

- [ ] **Step 2: Write failing tests for initial and decremented lifetime**

Replace the initial target assertion and expand the expiry test with exact lifetime state:

```js
// In "randomly marks only some passengers", update the existing assertion:
assert.equal(state.starReward.target, 20);
assert.equal(state.starReward.charge, 0);
assert.equal(state.starReward.completedCharges, 0);

test('star passenger starts with three visible exit passes', () => {
  const game = makeStarGame([0.1, 0.8]);
  const reward = game.snapshot().queueItems[0][0].starReward;

  assert.equal(game.snapshot().starReward.target, 20);
  assert.equal(reward.active, true);
  assert.equal(reward.exitPasses, 0);
  assert.equal(reward.remainingPasses, 3);
  assert.equal(reward.decrementVersion, 0);
});

test('each exit crossing decrements the visible star lifetime once', () => {
  const game = makeStarGame([0.1, 0.8]);
  const slot = game.slots[0];
  Object.assign(slot, {
    colorIndex: 0,
    passengerId: 1,
    progress: 0.24,
    previousProgress: 0.24,
    starReward: {
      active: true,
      exitPasses: 0,
      remainingPasses: 3,
      decrementVersion: 0,
      expired: false
    }
  });

  game.update(0.02);
  assert.equal(game.snapshot().slots[0].starReward.remainingPasses, 2);
  assert.equal(game.snapshot().slots[0].starReward.decrementVersion, 1);

  Object.assign(slot, { progress: 0.24, previousProgress: 0.24 });
  game.update(0.02);
  assert.equal(game.snapshot().slots[0].starReward.remainingPasses, 1);
  assert.equal(game.snapshot().slots[0].starReward.decrementVersion, 2);

  Object.assign(slot, { progress: 0.24, previousProgress: 0.24 });
  game.update(0.02);
  const expired = game.snapshot().slots[0].starReward;
  assert.equal(expired.remainingPasses, 0);
  assert.equal(expired.decrementVersion, 3);
  assert.equal(expired.active, false);
  assert.equal(expired.expired, true);
});
```

- [ ] **Step 3: Write a failing runtime test for 19, 20 and 21 collected coins**

Add the runtime import and a small real-runtime helper:

```js
import { createStarPassengerRuntime } from '../src/mechanics/star-passenger/model.js';

test('star charge completes at twenty and starts a new repeatable cycle', () => {
  const runtime = createStarPassengerRuntime({
    random: () => 0,
    options: { progressTarget: 20 }
  });
  const game = { mechanicState: runtime.createState(), lastEvent: {} };

  const collect = () => runtime.onPassengerBoarded({
    game,
    slot: {
      passengerId: game.mechanicState.starReward.collected + 1,
      starReward: {
        active: true,
        exitPasses: 0,
        remainingPasses: 3,
        decrementVersion: 0,
        expired: false
      }
    }
  });

  for (let index = 0; index < 19; index += 1) collect();
  assert.equal(game.mechanicState.starReward.coins, 19);
  assert.equal(game.mechanicState.starReward.charge, 19);
  assert.equal(game.mechanicState.starReward.completedCharges, 0);

  const twentieth = collect();
  assert.equal(twentieth.starChargeCompleted, true);
  assert.equal(twentieth.starChargeRound, 1);
  assert.equal(game.mechanicState.starReward.coins, 20);
  assert.equal(game.mechanicState.starReward.charge, 0);
  assert.equal(game.mechanicState.starReward.completedCharges, 1);

  const twentyFirst = collect();
  assert.equal(twentyFirst.starChargeCompleted, false);
  assert.equal(game.mechanicState.starReward.coins, 21);
  assert.equal(game.mechanicState.starReward.charge, 1);
  assert.equal(game.mechanicState.starReward.completedCharges, 1);
});
```

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
```

Expected: FAIL because `target` is still 3, `remainingPasses` / `decrementVersion` / `charge` / `completedCharges` are missing, and `starChargeCompleted` is undefined.

- [ ] **Step 5: Implement lifetime and charge state in the runtime**

Change the default target and state helpers in `model.js`:

```js
const DEFAULT_CONFIG = Object.freeze({
  chance: 0.18,
  expireExitPasses: 3,
  progressTarget: 20
});

function getLifetime(config) {
  return Math.max(1, Math.round(config.expireExitPasses ?? 3));
}

function getChargeTarget(config) {
  return Math.max(1, Math.round(config.progressTarget ?? 20));
}
```

Return the expanded global state:

```js
function createRewardState() {
  return {
    enabled: true,
    coins: 0,
    charge: 0,
    collected: 0,
    expired: 0,
    target: getChargeTarget(config),
    completedCharges: 0
  };
}
```

Return the expanded passenger reward:

```js
function createPassengerReward() {
  const chance = clampNumber(Number(config.chance ?? 0), 0, 1);
  if (random() >= chance) return null;
  return {
    active: true,
    exitPasses: 0,
    remainingPasses: getLifetime(config),
    decrementVersion: 0,
    expired: false
  };
}
```

Replace `onPassengerExitPassed` with:

```js
onPassengerExitPassed({ game, slot }) {
  const reward = slot.starReward;
  if (!reward?.active || reward.expired) return false;

  const limit = getLifetime(config);
  reward.exitPasses = Math.max(0, reward.exitPasses ?? 0) + 1;
  reward.remainingPasses = Math.max(0, limit - reward.exitPasses);
  reward.decrementVersion = Math.max(0, reward.decrementVersion ?? 0) + 1;
  if (reward.remainingPasses > 0) return true;

  reward.active = false;
  reward.expired = true;
  game.mechanicState.starReward.expired += 1;
  game.lastEvent = {
    type: 'star-passenger-expired',
    passengerId: slot.passengerId,
    slotIndex: slot.index,
    exitPasses: reward.exitPasses
  };
  return true;
},
```

Replace the successful branch of `onPassengerBoarded` with:

```js
reward.active = false;
const state = game.mechanicState.starReward;
const target = Math.max(1, state.target ?? getChargeTarget(config));
state.coins += 1;
state.collected += 1;
state.charge += 1;

const starChargeCompleted = state.charge >= target;
if (starChargeCompleted) {
  state.charge = 0;
  state.completedCharges += 1;
}

return {
  starRewardCollected: true,
  starChargeCompleted,
  starChargeRound: state.completedCharges
};
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
```

Expected: all star passenger model tests pass; the existing UI source test may remain unchanged until Task 3.

- [ ] **Step 7: Commit the model slice**

```bash
git add test/star-passenger-mechanic.test.js src/mechanics/star-passenger/model.js
git commit -m "feat: add star lifetime and repeatable charge state"
```

### Task 2: Render The `3/2/1` Badge And One-Shot `-1`

**Files:**
- Modify: `test/star-passenger-mechanic.test.js`
- Modify: `src/scene-view.js`

- [ ] **Step 1: Add failing scene wiring assertions**

Extend the existing UI shell test:

```js
assert.match(sceneSource, /remainingPasses/);
assert.match(sceneSource, /decrementVersion/);
assert.match(sceneSource, /passengerId/);
assert.match(sceneSource, /starBadgeCountSprite/);
assert.match(sceneSource, /starBadgeDecrementSprite/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
```

Expected: FAIL because `scene-view.js` does not create count or decrement sprites and does not read the new fields.

- [ ] **Step 3: Add a reusable canvas-sprite helper near `makeStarBadge`**

Add this helper before `makeStarBadge`:

```js
function makeStarBadgeLabel({ width = 96, height = 96, scaleX = 0.18, scaleY = 0.18 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 84;
  return { canvas, texture, sprite };
}

function drawStarBadgeCount(label, value) {
  const context = label.canvas.getContext('2d');
  const centerX = label.canvas.width / 2;
  const centerY = label.canvas.height / 2;
  context.clearRect(0, 0, label.canvas.width, label.canvas.height);
  context.beginPath();
  context.arc(centerX, centerY, 32, 0, Math.PI * 2);
  context.fillStyle = '#e45139';
  context.fill();
  context.lineWidth = 9;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '900 48px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), centerX, centerY + 2);
  label.texture.needsUpdate = true;
}

function drawStarBadgeDecrement(label) {
  const context = label.canvas.getContext('2d');
  context.clearRect(0, 0, label.canvas.width, label.canvas.height);
  context.font = '900 52px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = '#ffffff';
  context.strokeText('-1', label.canvas.width / 2, label.canvas.height / 2);
  context.fillStyle = '#ef653e';
  context.fillText('-1', label.canvas.width / 2, label.canvas.height / 2);
  label.texture.needsUpdate = true;
}
```

- [ ] **Step 4: Extend `makeStarBadge` with named count and decrement sprites**

After creating `halo` and `badge`, add:

```js
const countLabel = makeStarBadgeLabel();
countLabel.sprite.position.set(0.12, 0.66, 0.02);
countLabel.sprite.visible = false;

const decrementLabel = makeStarBadgeLabel({ width: 128, height: 96, scaleX: 0.24, scaleY: 0.18 });
drawStarBadgeDecrement(decrementLabel);
decrementLabel.sprite.position.set(0.28, 0.63, 0.02);
decrementLabel.sprite.visible = false;

root.add(halo, badge, countLabel.sprite, decrementLabel.sprite);
root.userData.starMesh = badge;
root.userData.haloMesh = halo;
root.userData.starBadgeCountSprite = countLabel.sprite;
root.userData.starBadgeCountLabel = countLabel;
root.userData.starBadgeDecrementSprite = decrementLabel.sprite;
root.userData.starBadgePassengerId = null;
root.userData.starBadgeRemainingPasses = null;
root.userData.starBadgeDecrementVersion = null;
root.userData.starBadgeDecrementStartedAt = -Infinity;
```

Remove the previous `root.add(halo, badge)` line so each object is added once.

- [ ] **Step 5: Replace `updateStarPassengerBadge` with identity-safe presentation logic**

```js
updateStarPassengerBadge(view, reward, time = 0, passengerId = null) {
  const badge = view.userData.starBadge;
  if (!badge) return;

  if (!reward) {
    badge.visible = false;
    badge.userData.starBadgePassengerId = null;
    badge.userData.starBadgeDecrementVersion = null;
    return;
  }

  const changedPassenger = badge.userData.starBadgePassengerId !== passengerId;
  if (changedPassenger) {
    badge.userData.starBadgePassengerId = passengerId;
    badge.userData.starBadgeDecrementVersion = reward.decrementVersion ?? 0;
    badge.userData.starBadgeDecrementStartedAt = -Infinity;
  } else if ((reward.decrementVersion ?? 0) > (badge.userData.starBadgeDecrementVersion ?? 0)) {
    badge.userData.starBadgeDecrementVersion = reward.decrementVersion;
    badge.userData.starBadgeDecrementStartedAt = time;
  }

  const remainingPasses = Math.max(0, reward.remainingPasses ?? 0);
  const rewardVisible = Boolean(reward.active && !reward.expired && remainingPasses > 0);
  const decrementElapsed = time - badge.userData.starBadgeDecrementStartedAt;
  const showDecrement = decrementElapsed >= 0 && decrementElapsed < 0.65;

  badge.visible = rewardVisible || showDecrement;
  badge.userData.starMesh.visible = rewardVisible;
  badge.userData.haloMesh.visible = rewardVisible;
  badge.userData.starBadgeCountSprite.visible = rewardVisible;
  badge.userData.starBadgeDecrementSprite.visible = showDecrement;

  if (rewardVisible && badge.userData.starBadgeRemainingPasses !== remainingPasses) {
    badge.userData.starBadgeRemainingPasses = remainingPasses;
    drawStarBadgeCount(badge.userData.starBadgeCountLabel, remainingPasses);
  }

  if (rewardVisible) {
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    badge.scale.setScalar(pulse);
  } else {
    badge.scale.setScalar(1);
  }

  if (showDecrement) {
    const progress = decrementElapsed / 0.65;
    badge.userData.starBadgeDecrementSprite.position.y = 0.63 + progress * 0.2;
    badge.userData.starBadgeDecrementSprite.material.opacity = 1 - progress;
  }
}
```

- [ ] **Step 6: Pass passenger identity from both conveyor and queue call sites**

Use:

```js
this.updateStarPassengerBadge(view, slot.starReward, snapshot.time, slot.passengerId);
```

and:

```js
this.updateStarPassengerBadge(view, item.starReward, snapshot.time, item.id);
```

Keep the hidden-view calls as `this.updateStarPassengerBadge(view, null, snapshot.time)`.

- [ ] **Step 7: Run the focused test and verify GREEN**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
```

Expected: all star passenger tests pass.

- [ ] **Step 8: Commit the world-space feedback slice**

```bash
git add test/star-passenger-mechanic.test.js src/scene-view.js
git commit -m "feat: show star passenger lifetime countdown"
```

### Task 3: Build The `0/20` HUD And Full-Charge Celebration

**Files:**
- Modify: `test/star-passenger-mechanic.test.js`
- Modify: `src/mechanics/star-passenger/view.js`
- Modify: `src/mechanics/star-passenger/styles.css`

- [ ] **Step 1: Add failing HUD and motion-accessibility assertions**

Extend the existing UI shell test:

```js
assert.match(viewSource, /0\/20/);
assert.match(viewSource, /completedCharges/);
assert.match(viewSource, /spawnChargeCompleteEffect/);
assert.match(viewSource, /star-charge-celebration/);
assert.match(styles, /\.star-charge-celebration/);
assert.match(styles, /\.star-reward-hud\.is-charge-complete/);
assert.match(styles, /prefers-reduced-motion/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
```

Expected: FAIL because the HUD still initializes to `0/3` and no completion celebration exists.

- [ ] **Step 3: Add explicit HUD rendering and celebration lifecycle state**

At the top of `createStarPassengerHud`, replace `lastCoins`-only state with:

```js
let lastCoins = 0;
let lastCompletedCharges = 0;
let latestReward = null;
let celebrationTimer = null;
let celebrating = false;
```

Initialize the count and ARIA maximum as `0/20` and `20`.

Add these helpers inside `createStarPassengerHud`:

```js
function renderProgress(value, target) {
  const safeTarget = Math.max(1, target ?? 20);
  const safeValue = Math.max(0, Math.min(value ?? 0, safeTarget));
  count.textContent = `${safeValue}/${safeTarget}`;
  progressBar.style.width = `${Math.round((safeValue / safeTarget) * 100)}%`;
  progress.setAttribute('aria-valuemax', String(safeTarget));
  progress.setAttribute('aria-valuenow', String(safeValue));
}

function clearChargeCompleteEffect() {
  if (celebrationTimer !== null) window.clearTimeout(celebrationTimer);
  celebrationTimer = null;
  celebrating = false;
  root?.classList.remove('is-charge-complete');
  root?.querySelectorAll('.star-charge-celebration').forEach((element) => element.remove());
}

function spawnChargeCompleteEffect(target) {
  if (!root) return;
  clearChargeCompleteEffect();
  celebrating = true;
  renderProgress(target, target);
  root.classList.remove('is-charge-complete');
  void root.offsetWidth;
  root.classList.add('is-charge-complete');

  const celebration = document.createElement('div');
  celebration.className = 'star-charge-celebration';
  celebration.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('span');
  ring.className = 'star-charge-ring';
  celebration.append(ring);
  for (let index = 0; index < 14; index += 1) {
    const particle = document.createElement('span');
    particle.className = index % 3 === 0 ? 'star-charge-particle is-star' : 'star-charge-particle';
    particle.textContent = index % 3 === 0 ? '★' : '●';
    particle.style.setProperty('--particle-index', String(index));
    particle.style.setProperty('--particle-angle', `${(360 / 14) * index}deg`);
    celebration.append(particle);
  }
  root.append(celebration);

  celebrationTimer = window.setTimeout(() => {
    celebration.remove();
    root?.classList.remove('is-charge-complete');
    celebrating = false;
    celebrationTimer = null;
    renderProgress(latestReward?.charge ?? 0, latestReward?.target ?? 20);
  }, 1000);
}
```

- [ ] **Step 4: Replace reset, hide and sync behavior**

Use this cleanup behavior:

```js
function hide() {
  clearChargeCompleteEffect();
  if (root) root.hidden = true;
  lastCoins = 0;
  lastCompletedCharges = 0;
  latestReward = null;
}
```

Use this reset body:

```js
reset() {
  clearChargeCompleteEffect();
  lastCoins = 0;
  lastCompletedCharges = 0;
  latestReward = null;
  if (count) count.textContent = '0/20';
  if (progressBar) progressBar.style.width = '0%';
  if (progress) progress.setAttribute('aria-valuenow', '0');
},
```

Replace the progress part of `sync` with:

```js
const reward = state.starReward ?? {
  coins: 0,
  charge: 0,
  target: 20,
  completedCharges: 0
};
latestReward = reward;
const target = Math.max(1, reward.target ?? 20);
const coins = Math.max(0, reward.coins ?? 0);
const completedCharges = Math.max(0, reward.completedCharges ?? 0);

if (coins > lastCoins) spawnStarRewardFlyEffect();
if (completedCharges > lastCompletedCharges) {
  spawnChargeCompleteEffect(target);
} else if (!celebrating) {
  renderProgress(reward.charge ?? 0, target);
}

lastCoins = coins;
lastCompletedCharges = completedCharges;
```

- [ ] **Step 5: Add celebration styles and reduced-motion fallback**

Append to `styles.css`:

```css
.star-reward-hud.is-charge-complete {
  animation: star-charge-hud-pulse 1s cubic-bezier(.2, .9, .25, 1);
}

.star-reward-hud.is-charge-complete .star-reward-progress-bar {
  background: linear-gradient(90deg, #f2a62d, #fff08b 55%, #f6b32f);
  background-size: 220% 100%;
  box-shadow: 0 0 12px rgba(255, 206, 62, .9), 0 0 26px rgba(255, 191, 38, .55);
  animation: star-charge-sweep .55s linear 2;
}

.star-charge-celebration {
  position: absolute;
  z-index: 18;
  inset: -44px -34px;
  overflow: visible;
  pointer-events: none;
}

.star-charge-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 70px;
  height: 70px;
  border: 4px solid rgba(255, 215, 74, .84);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(.3);
  opacity: 0;
  animation: star-charge-ring 1s ease-out forwards;
}

.star-charge-particle {
  --particle-distance: 68px;
  position: absolute;
  left: 50%;
  top: 50%;
  color: #ffc83d;
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  text-shadow: 0 2px 0 #895f11, 0 0 8px rgba(255, 226, 105, .9);
  transform: translate(-50%, -50%) rotate(var(--particle-angle)) translateY(0) scale(.5);
  animation: star-charge-particle .9s cubic-bezier(.15, .75, .22, 1) forwards;
  animation-delay: calc(var(--particle-index) * 12ms);
}

.star-charge-particle.is-star {
  color: #fff3a4;
  font-size: 17px;
}

@keyframes star-charge-hud-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  22% { transform: translateX(-50%) scale(1.08); }
  48% { transform: translateX(-50%) scale(.98); }
  70% { transform: translateX(-50%) scale(1.035); }
}

@keyframes star-charge-sweep {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@keyframes star-charge-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); }
  22% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.6); }
}

@keyframes star-charge-particle {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--particle-angle)) translateY(0) scale(.5);
  }
  18% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--particle-angle)) translateY(calc(var(--particle-distance) * -1)) scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .star-reward-hud.is-charge-complete,
  .star-reward-hud.is-charge-complete .star-reward-progress-bar,
  .star-charge-ring,
  .star-charge-particle,
  .star-reward-fly {
    animation-duration: .01ms;
    animation-iteration-count: 1;
  }
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --test test/star-passenger-mechanic.test.js
node --test test/mechanic-architecture.test.js
node --test test/mechanic-registry.test.js
```

Expected: star passenger 8/8 passes, architecture 3/3 passes, registry 23/23 passes.

- [ ] **Step 7: Commit the HUD slice**

```bash
git add test/star-passenger-mechanic.test.js src/mechanics/star-passenger/view.js src/mechanics/star-passenger/styles.css
git commit -m "feat: celebrate completed star charge"
```

### Task 4: Update Documentation And Verify The Complete Feature

**Files:**
- Modify: `README.md`
- Modify: `docs/mechanic-lab-handoff.md`

- [ ] **Step 1: Update user-facing behavior descriptions**

In `README.md`, replace the star passenger paragraph with:

```markdown
`star-passenger` 星星乘客也已可试玩：随机乘客带星星标记，星星上的 `3/2/1` 数字表示还可经过出口的次数，每次经过出口会显示 `-1`；成功上车时获得金币并推进 `0/20` 充能，充满后播放庆祝并开始下一轮。若第 3 次经过出口仍未上车，星星奖励消失但乘客保留。
```

In `docs/mechanic-lab-handoff.md`, change the star passenger completed-work bullets so they state:

```markdown
- 星星右上角显示剩余出口次数 `3/2/1`，每次经过出口弹出 `-1`。
- 星星乘客成功上车时，当前金币充能增加 1。
- 默认充能目标为 20；达到 `20/20` 时播放庆祝，随后从 `0/20` 开始下一轮。
- 第 3 次经过出口仍未上车时，星星奖励消失，但乘客保留。
```

- [ ] **Step 2: Run formatting and focused verification**

Run:

```bash
git diff --check
node --test test/star-passenger-mechanic.test.js
node --test test/mechanic-architecture.test.js
node --test test/mechanic-registry.test.js
npm run build
```

Expected: `git diff --check` exits 0; all focused tests pass; Vite build exits 0. The existing chunk-size warning is allowed.

- [ ] **Step 3: Verify the repaired full-suite baseline**

Run:

```bash
node --test test/game-model.test.js
pnpm test
```

Expected baseline: all 32 game-model tests pass. Then run `pnpm test` and require the full suite to remain at 83/83 or better. Stop and investigate any regression.

- [ ] **Step 4: Perform desktop visual QA at the current preview URL**

Start or reuse the dev server:

```bash
npm run dev -- --port 4173
```

Open:

```text
http://127.0.0.1:4173/?mechanic=star-passenger
```

Verify at the normal desktop viewport:

1. Queue and conveyor star passengers display a readable `3` badge.
2. Crossing the exit updates `3 -> 2 -> 1`, with one `-1` pop per crossing.
3. The final crossing hides the star but not the passenger.
4. HUD starts at `0/20` and ordinary collection moves it by one.
5. Trigger the twentieth coin without changing source by evaluating the following in the current page through browser automation or the browser console:

   ```js
   const game = window.__busLoop.game;
   Object.assign(game.mechanicState.starReward, {
     coins: 19,
     charge: 19,
     completedCharges: 0,
     target: 20
   });
   game.mechanicRuntime.onPassengerBoarded({
     game,
     slot: { starReward: { active: true, expired: false } }
   });
   game.emit();
   ```

6. Celebration holds `20/20` for about one second, then shows `0/20`. Evaluate the final two runtime calls once more to verify the next collected coin displays `1/20` without replaying the full celebration.
7. Celebration does not block vehicle clicks or move the stage layout.

- [ ] **Step 5: Perform mobile and reduced-motion visual QA**

At a viewport near `390 x 844`, verify the number badge remains readable and does not overlap the HUD. Enable reduced motion in browser emulation or the operating system and confirm count/color changes remain visible while large movement is suppressed.

- [ ] **Step 6: Remove temporary QA changes and rerun final verification**

Run:

```bash
git diff --check
node --test test/star-passenger-mechanic.test.js test/mechanic-architecture.test.js test/mechanic-registry.test.js
npm run build
git status --short
```

Expected: focused tests and build pass; no source target override exists; only intended source, test and documentation files are modified.

- [ ] **Step 7: Commit documentation and final polish**

```bash
git add README.md docs/mechanic-lab-handoff.md
git commit -m "docs: update star passenger feedback"
```

---

## Completion Criteria

- Every active star reward exposes `remainingPasses` and `decrementVersion`.
- The world-space badge clearly displays `3`, `2`, then `1`.
- Exactly one `-1` appears for each exit crossing, including the final expiration crossing.
- The charge HUD starts at `0/20`, completes on coin 20, holds `20/20` during celebration, and continues at `1/20` on coin 21.
- Every completed charge increments `completedCharges` and can trigger a new celebration.
- Reset and mechanic switching clear timers, particles and classes.
- Reduced-motion users still receive complete numeric and color feedback.
- Focused tests, the 83/83 full-suite baseline, and the Vite build all pass.
