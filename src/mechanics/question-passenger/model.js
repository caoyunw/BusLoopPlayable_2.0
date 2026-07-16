const DEFAULT_CHANCE = 0.3;

function normalizeChance(value) {
  const chance = Number(value);

  if (!Number.isFinite(chance)) {
    return DEFAULT_CHANCE;
  }

  return Math.min(1, Math.max(0, chance));
}

function getAuthoredMasks(level) {
  const authoredMasks = level?.mechanics?.['question-passenger']?.authoredMasks;
  return Array.isArray(authoredMasks) ? authoredMasks : [];
}

function summarizeAuthoredMasks(authoredMasks, passengerQueues) {
  let authoredMarked = 0;
  let authoredTotal = 0;

  for (const [queueIndex, row] of authoredMasks.entries()) {
    if (!Array.isArray(row)) {
      continue;
    }

    const passengerQueue = Array.isArray(passengerQueues) ? passengerQueues[queueIndex] : null;
    const relevantRow = Array.isArray(passengerQueues)
      ? row.slice(0, Array.isArray(passengerQueue) ? passengerQueue.length : 0)
      : row;
    authoredTotal += relevantRow.length;
    authoredMarked += relevantRow.filter((value) => value === true).length;
  }

  return { authoredMarked, authoredTotal };
}

export function createQuestionPassengerRuntime({ random = Math.random, level, options = {} } = {}) {
  const mode = options.mode === 'authored' ? 'authored' : 'chance';
  const chance = normalizeChance(options.chance);
  const authoredMasks = getAuthoredMasks(level);
  const authoredSummary = summarizeAuthoredMasks(authoredMasks, level?.passengerQueues);

  return {
    id: 'question-passenger',
    createState() {
      return {
        questionPassenger: {
          mode,
          chance,
          ...authoredSummary
        }
      };
    },
    createQueueItemData({ queueIndex, sourceIndex }) {
      const authoredRow = authoredMasks[queueIndex];
      const hidden = mode === 'authored'
        ? Array.isArray(authoredRow) && authoredRow[sourceIndex] === true
        : random() < chance;

      return {
        questionPassenger: {
          hidden,
          wasHidden: hidden,
          revealVersion: 0
        }
      };
    },
    createSlotData() {
      return { questionPassenger: null };
    },
    cloneQueueItemSnapshot(item) {
      return {
        questionPassenger: item?.questionPassenger
          ? { ...item.questionPassenger }
          : null
      };
    },
    cloneSlotSnapshot(slot) {
      return {
        questionPassenger: slot?.questionPassenger
          ? { ...slot.questionPassenger }
          : null
      };
    },
    decorateSnapshot(game) {
      return {
        questionPassenger: { ...game.mechanicState.questionPassenger }
      };
    },
    onPassengerEnteredBelt({ slot, passenger }) {
      if (!passenger.questionPassenger) {
        slot.questionPassenger = null;
        return;
      }

      const questionPassenger = { ...passenger.questionPassenger };
      questionPassenger.hidden = false;

      if (questionPassenger.wasHidden) {
        questionPassenger.revealVersion += 1;
      }

      slot.questionPassenger = questionPassenger;
    },
    clearSlotData({ slot }) {
      slot.questionPassenger = null;
    }
  };
}
