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

function summarizeAuthoredMasks(authoredMasks) {
  let authoredMarked = 0;
  let authoredTotal = 0;

  for (const row of authoredMasks) {
    if (!Array.isArray(row)) {
      continue;
    }

    authoredTotal += row.length;
    authoredMarked += row.filter((value) => value === true).length;
  }

  return { authoredMarked, authoredTotal };
}

export function createQuestionPassengerRuntime({ random = Math.random, level, options = {} } = {}) {
  const mode = options.mode === 'authored' ? 'authored' : 'chance';
  const chance = normalizeChance(options.chance);
  const authoredMasks = getAuthoredMasks(level);
  const authoredSummary = summarizeAuthoredMasks(authoredMasks);

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
    }
  };
}
