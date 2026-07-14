export const TRAIN_SIZE = 4;
export const TRAIN_CARRIAGE_SEATS = 10;
export const MAX_TRAIN_CARRIAGES = 12;

export function normalizeTrainMode(value) {
  return value === 'authored' ? 'authored' : 'chance';
}

export function normalizeTrainChance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.3;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100) / 100;
}

export function planTrainCarriages({
  vehicles = [],
  mode = 'chance',
  chance = 0.3,
  authoredGroups = [],
  random = Math.random
} = {}) {
  const normalizedMode = normalizeTrainMode(mode);
  const normalizedChance = normalizeTrainChance(chance);
  const eligible = vehicles.filter(({ seats }) => seats === TRAIN_CARRIAGE_SEATS);
  if (normalizedMode === 'authored') {
    const eligibleIds = new Set(eligible.map(({ id }) => id));
    const usedIds = new Set();
    const vehicleIds = [];
    let authoredGroupCount = 0;
    let invalidAuthoredGroupCount = 0;

    for (const group of Array.isArray(authoredGroups) ? authoredGroups : []) {
      const uniqueIds = Array.isArray(group) ? new Set(group) : new Set();
      const isValid = (
        Array.isArray(group)
        && group.length === TRAIN_SIZE
        && uniqueIds.size === TRAIN_SIZE
        && group.every((id) => eligibleIds.has(id) && !usedIds.has(id))
        && vehicleIds.length + TRAIN_SIZE <= MAX_TRAIN_CARRIAGES
      );
      if (!isValid) {
        invalidAuthoredGroupCount += 1;
        continue;
      }
      authoredGroupCount += 1;
      for (const id of group) {
        usedIds.add(id);
        vehicleIds.push(id);
      }
    }

    return {
      mode: normalizedMode,
      chance: normalizedChance,
      vehicleIds,
      authoredGroupCount,
      authoredCarriageCount: vehicleIds.length,
      invalidAuthoredGroupCount
    };
  }
  const maximum = Math.min(
    MAX_TRAIN_CARRIAGES,
    Math.floor(eligible.length / TRAIN_SIZE) * TRAIN_SIZE
  );
  const requested = Math.round(eligible.length * normalizedChance / TRAIN_SIZE) * TRAIN_SIZE;
  const count = Math.max(0, Math.min(maximum, requested));
  const vehicleIds = eligible
    .map((vehicle, index) => ({ id: vehicle.id, index, score: Number(random()) || 0 }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, count)
    .map(({ id }) => id);

  return {
    mode: normalizedMode,
    chance: normalizedChance,
    vehicleIds,
    authoredGroupCount: 0,
    authoredCarriageCount: 0,
    invalidAuthoredGroupCount: 0
  };
}
