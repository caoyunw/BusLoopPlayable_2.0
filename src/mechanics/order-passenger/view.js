import { COLORS } from '../../level-data.js';
import './styles.css';

const ORDER_ICON_COLOR_OVERRIDES = Object.freeze({
  5: 'rgb(255, 211, 32)'
});

function getColorName(colorIndex) {
  return COLORS[colorIndex]?.name ?? `Color ${colorIndex}`;
}

function getIconColor(colorIndex) {
  return ORDER_ICON_COLOR_OVERRIDES[colorIndex] ?? COLORS[colorIndex]?.css ?? '#ffffff';
}

function createPassengerIcon(document, colorIndex) {
  const icon = document.createElement('span');
  icon.className = 'order-passenger-icon';
  icon.style.setProperty('--order-passenger-color', getIconColor(colorIndex));
  icon.setAttribute('aria-hidden', 'true');

  const head = document.createElement('span');
  head.className = 'order-passenger-icon-head';
  const body = document.createElement('span');
  body.className = 'order-passenger-icon-body';
  icon.append(head, body);
  return icon;
}

function createOrderItem(document, item) {
  const element = document.createElement('li');
  element.className = 'order-passenger-item';
  element.dataset.colorIndex = String(item.colorIndex);

  const icon = createPassengerIcon(document, item.colorIndex);
  const count = document.createElement('strong');
  count.className = 'order-passenger-count';
  count.textContent = String(item.remainingPassengers ?? 0);
  count.setAttribute('aria-label', `${getColorName(item.colorIndex)} remaining`);

  const check = document.createElement('span');
  check.className = 'order-passenger-check';
  check.textContent = '✓';
  check.setAttribute('aria-hidden', 'true');

  element.append(icon, count, check);
  return { element, count, check };
}

export function createOrderPassengerHud({ stage } = {}) {
  let root = null;
  let list = null;
  const itemViews = new Map();

  function ensureRoot() {
    if (root || !stage) return root;

    root = document.createElement('section');
    root.id = 'order-passenger-hud';
    root.className = 'order-passenger-hud';
    root.hidden = true;
    root.setAttribute('aria-label', 'Order passengers');
    root.setAttribute('aria-live', 'polite');

    list = document.createElement('ul');
    list.className = 'order-passenger-list';
    root.append(list);
    stage.append(root);
    return root;
  }

  function renderItems(items = []) {
    if (!list) return;
    const ownerDocument = root.ownerDocument;
    const activeColors = new Set(items.map((item) => String(item.colorIndex)));

    for (const item of items) {
      let view = itemViews.get(item.colorIndex);
      if (!view) {
        view = createOrderItem(ownerDocument, item);
        itemViews.set(item.colorIndex, view);
        list.append(view.element);
      }

      const isComplete = (item.remainingPassengers ?? 0) <= 0;
      view.count.textContent = String(item.remainingPassengers ?? 0);
      view.count.hidden = isComplete;
      view.check.hidden = !isComplete;
      view.element.classList.toggle('is-complete', isComplete);
    }

    for (const [colorIndex, view] of itemViews) {
      if (activeColors.has(String(colorIndex))) continue;
      view.element.remove();
      itemViews.delete(colorIndex);
    }
  }

  function hide() {
    if (root) root.hidden = true;
  }

  return {
    reset() {
      for (const view of itemViews.values()) {
        view.element.classList.remove('is-complete');
        view.count.hidden = false;
        view.check.hidden = true;
      }
    },

    sync({ state, mechanic }) {
      if (mechanic?.id !== 'order-passenger') {
        hide();
        return;
      }

      if (!ensureRoot()) return;
      root.hidden = false;
      renderItems(state.orderPassenger?.items ?? []);
    }
  };
}
