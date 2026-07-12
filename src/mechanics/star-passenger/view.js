import './styles.css';

export function createStarPassengerHud({ stage } = {}) {
  let root = null;
  let count = null;
  let progress = null;
  let progressBar = null;
  let lastCoins = 0;
  let lastCompletedCharges = 0;
  let latestReward = null;
  let celebrationTimer = null;
  let celebrating = false;

  function ensureRoot() {
    if (root || !stage) return root;
    root = document.createElement('div');
    root.id = 'star-reward-hud';
    root.className = 'star-reward-hud';
    root.hidden = true;
    root.setAttribute('aria-live', 'polite');

    const header = document.createElement('div');
    header.className = 'star-reward-header';
    const label = document.createElement('p');
    label.className = 'star-reward-label';
    label.textContent = '金币充能';
    count = document.createElement('strong');
    count.id = 'star-reward-count';
    count.textContent = '0/20';
    header.append(label, count);

    progress = document.createElement('div');
    progress.className = 'star-reward-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', '金币充能进度');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '20');
    progress.setAttribute('aria-valuenow', '0');
    progressBar = document.createElement('div');
    progressBar.id = 'star-reward-progress-bar';
    progressBar.className = 'star-reward-progress-bar';
    progress.append(progressBar);

    root.append(header, progress);
    stage.append(root);
    return root;
  }

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

    const celebrationRoot = root;
    const timerId = window.setTimeout(() => {
      if (celebrationTimer !== timerId || root !== celebrationRoot) return;
      celebration.remove();
      celebrationRoot.classList.remove('is-charge-complete');
      celebrating = false;
      celebrationTimer = null;
      renderProgress(latestReward?.charge ?? 0, latestReward?.target ?? 20);
    }, 1000);
    celebrationTimer = timerId;
  }

  function spawnStarRewardFlyEffect() {
    if (!stage || !root || root.hidden) return;
    const effect = document.createElement('span');
    effect.className = 'star-reward-fly';
    effect.textContent = '★';
    effect.setAttribute('aria-hidden', 'true');
    stage.append(effect);
    effect.addEventListener('animationend', () => effect.remove(), { once: true });
    window.setTimeout(() => effect.remove(), 900);
  }

  function hide() {
    clearChargeCompleteEffect();
    if (root) root.hidden = true;
    lastCoins = 0;
    lastCompletedCharges = 0;
    latestReward = null;
  }

  return {
    reset() {
      clearChargeCompleteEffect();
      lastCoins = 0;
      lastCompletedCharges = 0;
      latestReward = null;
      if (count) count.textContent = '0/20';
      if (progressBar) progressBar.style.width = '0%';
      if (progress) progress.setAttribute('aria-valuenow', '0');
    },

    sync({ state, mechanic }) {
      if (mechanic?.id !== 'star-passenger') {
        hide();
        return;
      }

      if (!ensureRoot()) return;
      root.hidden = false;
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
      lastCompletedCharges = Math.max(lastCompletedCharges, completedCharges);
    }
  };
}
