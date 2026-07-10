import './styles.css';

export function createStarPassengerHud({ stage } = {}) {
  let root = null;
  let count = null;
  let progress = null;
  let progressBar = null;
  let lastCoins = 0;

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
    count.textContent = '0/3';
    header.append(label, count);

    progress = document.createElement('div');
    progress.className = 'star-reward-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', '金币充能进度');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '3');
    progress.setAttribute('aria-valuenow', '0');
    progressBar = document.createElement('div');
    progressBar.id = 'star-reward-progress-bar';
    progressBar.className = 'star-reward-progress-bar';
    progress.append(progressBar);

    root.append(header, progress);
    stage.append(root);
    return root;
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
    if (root) root.hidden = true;
    lastCoins = 0;
  }

  return {
    reset() {
      lastCoins = 0;
      if (count) count.textContent = '0/3';
      if (progressBar) progressBar.style.width = '0%';
    },

    sync({ state, mechanic }) {
      if (mechanic?.id !== 'star-passenger') {
        hide();
        return;
      }

      if (!ensureRoot()) return;
      root.hidden = false;
      const reward = state.starReward ?? { coins: 0, target: 3 };
      const target = Math.max(1, reward.target ?? 3);
      const coins = Math.max(0, reward.coins ?? 0);
      const percent = Math.min(100, Math.round((coins / target) * 100));

      count.textContent = `${coins}/${target}`;
      progressBar.style.width = `${percent}%`;
      progress.setAttribute('aria-valuemax', String(target));
      progress.setAttribute('aria-valuenow', String(Math.min(coins, target)));

      if (coins > lastCoins) spawnStarRewardFlyEffect();
      lastCoins = coins;
    }
  };
}
