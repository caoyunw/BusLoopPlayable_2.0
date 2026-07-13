const DEFAULT_CONFIG = Object.freeze({
  initialEntryIndex: 0
});

function getQueueCount(game) {
  return Math.max(0, game.queues?.length ?? game.level?.queueCount ?? 0);
}

function getQueueHead(game, entryIndex) {
  return game.queues?.[entryIndex]?.[0] ?? null;
}

function hasQueueSupply(game, entryIndex) {
  return Boolean(game.queues?.[entryIndex]?.length || game.sourceQueues?.[entryIndex]?.length);
}

function getNextEntryIndex(game, currentEntryIndex) {
  const count = getQueueCount(game);
  if (count <= 0) return 0;
  for (let offset = 1; offset <= count; offset += 1) {
    const index = (currentEntryIndex + offset) % count;
    if (hasQueueSupply(game, index)) return index;
  }
  return currentEntryIndex;
}

function countVisibleRun(game, entryIndex, colorIndex) {
  if (colorIndex == null) return 0;
  let count = 0;
  for (const item of game.queues?.[entryIndex] ?? []) {
    if (item.colorIndex !== colorIndex) break;
    count += 1;
  }
  return count;
}

function createValveState(initialEntryIndex) {
  return {
    started: false,
    activeEntryIndex: initialEntryIndex,
    activeColorIndex: null,
    switchCount: 0,
    lastSwitchAt: 0
  };
}

export function createValveRuntime({ options = {} } = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const initialEntryIndex = Math.max(0, Math.round(config.initialEntryIndex ?? 0));

  function getState(game) {
    return game.mechanicState.valve;
  }

  function setActiveEntry(game, entryIndex, countSwitch = false) {
    const state = getState(game);
    const count = Math.max(1, getQueueCount(game));
    state.activeEntryIndex = ((entryIndex % count) + count) % count;
    state.activeColorIndex = getQueueHead(game, state.activeEntryIndex)?.colorIndex ?? null;
    if (countSwitch) {
      state.switchCount += 1;
      state.lastSwitchAt = game.time;
    }
  }

  function startValveSwitching(game) {
    const state = getState(game);
    if (!state || state.started) return;
    state.started = true;
    const nextEntryIndex = hasQueueSupply(game, state.activeEntryIndex)
      ? state.activeEntryIndex
      : getNextEntryIndex(game, state.activeEntryIndex);
    setActiveEntry(game, nextEntryIndex, false);
  }

  function ensureActiveValve(game) {
    startValveSwitching(game);
    const state = getState(game);
    if (!state) return;
    const activeHead = getQueueHead(game, state.activeEntryIndex);
    if (activeHead && state.activeColorIndex == null) {
      state.activeColorIndex = activeHead.colorIndex;
      return;
    }
    if (activeHead && activeHead.colorIndex === state.activeColorIndex) return;
    setActiveEntry(game, getNextEntryIndex(game, state.activeEntryIndex), activeHead != null);
  }

  function switchAfterRunIfNeeded(game, entryIndex) {
    startValveSwitching(game);
    const state = getState(game);
    if (!state || entryIndex !== state.activeEntryIndex) return;
    const head = getQueueHead(game, entryIndex);
    if (head?.colorIndex === state.activeColorIndex) return;
    setActiveEntry(game, getNextEntryIndex(game, entryIndex), true);
  }

  return {
    id: 'valve',

    createState() {
      return { valve: createValveState(initialEntryIndex) };
    },

    afterReset({ game }) {
      setActiveEntry(game, initialEntryIndex, false);
    },

    update({ game }) {
      if (game.initialFillActive) return false;
      const state = getState(game);
      if (state?.started) return false;
      startValveSwitching(game);
      return true;
    },

    canPassengerEnterBelt({ game, entry }) {
      if (game.initialFillActive) return true;
      ensureActiveValve(game);
      const state = getState(game);
      const entryIndex = entry.index;
      if (!state || entryIndex !== state.activeEntryIndex) return false;
      const head = getQueueHead(game, entryIndex);
      return Boolean(head && head.colorIndex === state.activeColorIndex);
    },

    onPassengerEnteredBelt({ game, slot }) {
      if (game.initialFillActive) return;
      switchAfterRunIfNeeded(game, slot.entryIndex);
    },

    decorateSnapshot(game) {
      const state = getState(game);
      if (!state) return {};
      const queueCount = getQueueCount(game);
      const initialFillOpen = Boolean(game.initialFillActive || !state.started);
      return {
        valve: {
          started: state.started,
          initialFillOpen,
          activeEntryIndex: state.activeEntryIndex,
          activeColorIndex: state.activeColorIndex,
          switchCount: state.switchCount,
          lastSwitchAt: state.lastSwitchAt,
          entries: Array.from({ length: queueCount }, (_, index) => {
            const headColorIndex = getQueueHead(game, index)?.colorIndex ?? null;
            const open = initialFillOpen || index === state.activeEntryIndex;
            return {
              index,
              open,
              headColorIndex,
              activeColorIndex: initialFillOpen ? headColorIndex : (open ? state.activeColorIndex : null),
              visibleRunRemaining: open
                ? countVisibleRun(game, index, initialFillOpen ? headColorIndex : state.activeColorIndex)
                : 0
            };
          })
        }
      };
    }
  };
}
