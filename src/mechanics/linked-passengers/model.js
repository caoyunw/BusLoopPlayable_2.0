const DEFAULT_CHANCE = 0.3;
const MIN_CHAIN_LENGTH = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeChance(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : DEFAULT_CHANCE;
}

function getMaxVehicleSeats(level) {
  return Math.max(
    MIN_CHAIN_LENGTH,
    ...((level?.vehicles ?? []).map((vehicle) => Number(vehicle.seats) || 0))
  );
}

function normalizeMaxLength(value, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return maximum;
  return clamp(Math.trunc(numeric), MIN_CHAIN_LENGTH, maximum);
}

function makeMetadata(queueIndex, sourceIndex, length, memberIndex) {
  return Object.freeze({
    chainId: `linked-${queueIndex}-${sourceIndex}`,
    length,
    memberIndex,
    isHead: memberIndex === 0
  });
}

function claimChain(row, queueIndex, sourceIndex, length) {
  for (let memberIndex = 0; memberIndex < length; memberIndex += 1) {
    row[sourceIndex + memberIndex] = makeMetadata(
      queueIndex,
      sourceIndex,
      length,
      memberIndex
    );
  }
}

function getSameColorRunLength(queue, sourceIndex) {
  const colorIndex = queue[sourceIndex];
  let length = 0;
  while (sourceIndex + length < queue.length && queue[sourceIndex + length] === colorIndex) {
    length += 1;
  }
  return length;
}

function buildChancePlan(queues, chance, maxLength, random) {
  return queues.map((queue, queueIndex) => {
    const row = Array(queue.length).fill(null);
    let sourceIndex = 0;
    while (sourceIndex < queue.length) {
      const allowed = Math.min(maxLength, getSameColorRunLength(queue, sourceIndex));
      if (allowed >= MIN_CHAIN_LENGTH && random() < chance) {
        const length = MIN_CHAIN_LENGTH + Math.floor(random() * (allowed - 1));
        claimChain(row, queueIndex, sourceIndex, length);
        sourceIndex += length;
      } else {
        sourceIndex += 1;
      }
    }
    return row;
  });
}

function buildAuthoredPlan(queues, authoredStarts, maxVehicleSeats) {
  let invalidAuthoredCount = 0;
  const plan = queues.map((queue, queueIndex) => {
    const row = Array(queue.length).fill(null);
    const authoredRow = Array.isArray(authoredStarts?.[queueIndex])
      ? authoredStarts[queueIndex]
      : [];
    for (let sourceIndex = 0; sourceIndex < authoredRow.length; sourceIndex += 1) {
      const value = authoredRow[sourceIndex];
      if (value === 0 || value == null) continue;
      const validLength = Number.isFinite(value)
        && Number.isInteger(value)
        && value >= MIN_CHAIN_LENGTH
        && value <= maxVehicleSeats;
      const inBounds = validLength && sourceIndex + value <= queue.length;
      const sameColor = inBounds
        && queue.slice(sourceIndex, sourceIndex + value).every((color) => color === queue[sourceIndex]);
      const unclaimed = sameColor
        && row.slice(sourceIndex, sourceIndex + value).every((metadata) => metadata === null);
      if (!unclaimed) {
        invalidAuthoredCount += 1;
        continue;
      }
      claimChain(row, queueIndex, sourceIndex, value);
    }
    return row;
  });
  return { plan, invalidAuthoredCount };
}

function summarizePlan(plan) {
  let chainCount = 0;
  let linkedGroupCount = 0;
  for (const row of plan) {
    for (const metadata of row) {
      if (!metadata) continue;
      linkedGroupCount += 1;
      if (metadata.isHead) chainCount += 1;
    }
  }
  return { chainCount, linkedGroupCount };
}

function cloneLinkedPassenger(value) {
  return value ? { ...value } : null;
}

export function createLinkedPassengerRuntime({
  random = Math.random,
  level = {},
  options = {},
  warn = (...args) => console.warn(...args)
} = {}) {
  const queues = Array.isArray(level.passengerQueues) ? level.passengerQueues : [];
  const mode = options.mode === 'authored' ? 'authored' : 'chance';
  const chance = normalizeChance(options.chance);
  const maxVehicleSeats = getMaxVehicleSeats(level);
  const maxLength = normalizeMaxLength(options.maxLength, maxVehicleSeats);
  const authoredStarts = level?.mechanics?.['linked-passengers']?.authoredStarts;
  const authoredBuilt = buildAuthoredPlan(queues, authoredStarts, maxVehicleSeats);
  const authoredSummary = summarizePlan(authoredBuilt.plan);
  let activePlan = queues.map((queue) => Array(queue.length).fill(null));
  let warned = false;

  const metadataAt = (queueIndex, sourceIndex) => (
    activePlan[queueIndex]?.[sourceIndex] ?? null
  );

  return {
    id: 'linked-passengers',
    createState() {
      const built = mode === 'authored'
        ? authoredBuilt
        : {
            plan: buildChancePlan(queues, chance, maxLength, random),
            invalidAuthoredCount: 0
          };
      activePlan = built.plan;
      if (built.invalidAuthoredCount > 0 && !warned) {
        warned = true;
        warn(`linked-passengers ignored ${built.invalidAuthoredCount} invalid authored chain starts`);
      }
      return {
        linkedPassenger: {
          mode,
          chance,
          maxLength,
          maxVehicleSeats,
          ...summarizePlan(activePlan),
          invalidAuthoredCount: built.invalidAuthoredCount,
          authoredChainCount: authoredSummary.chainCount,
          authoredLinkedGroupCount: authoredSummary.linkedGroupCount,
          authoredInvalidAuthoredCount: authoredBuilt.invalidAuthoredCount
        }
      };
    },
    createQueueItemData({ queueIndex, sourceIndex }) {
      return { linkedPassenger: cloneLinkedPassenger(metadataAt(queueIndex, sourceIndex)) };
    },
    createSlotData: () => ({ linkedPassenger: null }),
    cloneQueueItemSnapshot: (item) => ({
      linkedPassenger: cloneLinkedPassenger(item?.linkedPassenger)
    }),
    cloneSlotSnapshot: (slot) => ({
      linkedPassenger: cloneLinkedPassenger(slot?.linkedPassenger)
    }),
    decorateSnapshot: (game) => ({
      linkedPassenger: { ...game.mechanicState.linkedPassenger }
    }),
    getQueueAdmissionBatchSize({ queueIndex, sourceIndex }) {
      const metadata = metadataAt(queueIndex, sourceIndex);
      return metadata?.isHead ? metadata.length : 1;
    },
    getBeltEntryBatch({ queue }) {
      const head = queue[0];
      if (!head) return [];
      const metadata = head.linkedPassenger;
      if (!metadata) return [head];
      if (!metadata.isHead) return [];
      const batch = queue.slice(0, metadata.length);
      const valid = batch.length === metadata.length && batch.every((item, memberIndex) => (
        item.linkedPassenger?.chainId === metadata.chainId
        && item.linkedPassenger.memberIndex === memberIndex
      ));
      return valid ? batch : [];
    },
    getBoardingBatch({ slot, slots }) {
      const metadata = slot.linkedPassenger;
      if (!metadata) return [slot];
      if (!metadata.isHead) return [];
      const batch = slots
        .filter((candidate) => candidate.linkedPassenger?.chainId === metadata.chainId)
        .sort((left, right) => (
          left.linkedPassenger.memberIndex - right.linkedPassenger.memberIndex
        ));
      const valid = batch.length === metadata.length && batch.every((candidate, memberIndex) => (
        candidate.linkedPassenger.memberIndex === memberIndex
      ));
      return valid ? batch : [];
    },
    onPassengerEnteredBelt({ slot, passenger }) {
      slot.linkedPassenger = cloneLinkedPassenger(passenger.linkedPassenger);
    },
    onPassengerBatchBoarded({ slots }) {
      const metadata = slots[0]?.linkedPassenger;
      return metadata ? {
        linkedPassenger: { chainId: metadata.chainId, length: metadata.length }
      } : {};
    },
    clearSlotData({ slot }) {
      slot.linkedPassenger = null;
    }
  };
}
