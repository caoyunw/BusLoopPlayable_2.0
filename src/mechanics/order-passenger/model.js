const DEFAULT_TARGET_COLOR_INDICES = Object.freeze([4, 5, 8]);

function normalizeTargetColorIndices(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_TARGET_COLOR_INDICES;
  return [...new Set(source.map((colorIndex) => Number(colorIndex)).filter(Number.isFinite))];
}

function countTargetGroups(level, targetColorIndices) {
  const targetSet = new Set(targetColorIndices);
  const counts = Object.fromEntries(targetColorIndices.map((colorIndex) => [colorIndex, 0]));
  const queues = level?.passengerQueues ?? [level?.passengerSequence ?? []];

  for (const queue of queues) {
    for (const colorIndex of queue ?? []) {
      if (!targetSet.has(colorIndex)) continue;
      counts[colorIndex] = (counts[colorIndex] ?? 0) + 1;
    }
  }

  return counts;
}

function makeOrderItems(level, targetColorIndices) {
  const groupSize = Math.max(1, Math.round(level?.groupSize ?? 4));
  const totalsByColor = countTargetGroups(level, targetColorIndices);
  return targetColorIndices.map((colorIndex) => {
    const totalGroups = totalsByColor[colorIndex] ?? 0;
    return {
      colorIndex,
      totalGroups,
      remainingGroups: totalGroups,
      totalPassengers: totalGroups * groupSize,
      remainingPassengers: totalGroups * groupSize
    };
  });
}

function cloneItem(item) {
  return { ...item };
}

function isComplete(state) {
  return state.items.every((item) => item.remainingGroups <= 0);
}

export function createOrderPassengerRuntime({ level, options = {} } = {}) {
  const targetColorIndices = normalizeTargetColorIndices(options.targetColorIndices);
  const groupSize = Math.max(1, Math.round(level?.groupSize ?? 4));

  function createOrderState() {
    const items = makeOrderItems(level, targetColorIndices);
    return {
      targetColorIndices: [...targetColorIndices],
      groupSize,
      items,
      completed: isComplete({ items })
    };
  }

  function getOrderItem(game, colorIndex) {
    return game.mechanicState.orderPassenger?.items
      .find((item) => item.colorIndex === colorIndex) ?? null;
  }

  function refreshCompletion(game) {
    const order = game.mechanicState.orderPassenger;
    order.completed = isComplete(order);
    return order.completed;
  }

  return {
    id: 'order-passenger',

    createState() {
      return { orderPassenger: createOrderState() };
    },

    decorateSnapshot(game) {
      const order = game.mechanicState.orderPassenger;
      return {
        orderPassenger: {
          targetColorIndices: [...order.targetColorIndices],
          groupSize: order.groupSize,
          completed: order.completed,
          items: order.items.map(cloneItem)
        }
      };
    },

    onPassengerBoarded({ game, slot }) {
      const item = getOrderItem(game, slot.colorIndex);
      if (!item || item.remainingGroups <= 0) {
        return { orderPassengerMatched: false };
      }

      item.remainingGroups = Math.max(0, item.remainingGroups - 1);
      item.remainingPassengers = item.remainingGroups * groupSize;
      const orderPassengerCompleted = refreshCompletion(game);

      return {
        orderPassengerMatched: true,
        orderPassengerColorIndex: item.colorIndex,
        orderPassengerRemaining: item.remainingPassengers,
        orderPassengerCompleted
      };
    },

    hasWon(game) {
      return Boolean(game.mechanicState.orderPassenger?.completed);
    }
  };
}
