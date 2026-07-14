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

function cloneTrackSlot(slot) {
  return slot ? { ...slot } : null;
}

export function createTrainRuntime({
  level = null,
  options = {},
  random = Math.random
} = {}) {
  const duration = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0.01, numeric) : fallback;
  };
  const dispatchDuration = Math.max(0.1, Number(options.dispatchDuration) || 0.9);
  const fullLoadDelay = duration(options.fullLoadDelay, 0.25);
  const departureDuration = duration(options.departureDuration, 1.4);
  const locomotiveEntryDuration = duration(options.locomotiveEntryDuration, 1.2);

  function getTrackVehicles(game) {
    return game.mechanicState.train.trackSlots
      .map((slot) => slot && game.getVehicle(slot.vehicleId))
      .filter(Boolean);
  }

  return {
    id: 'train',

    createState(game) {
      const activeLevel = game?.level ?? level ?? {};
      const plan = planTrainCarriages({
        vehicles: activeLevel.vehicles,
        mode: options.mode,
        chance: options.chance,
        authoredGroups: activeLevel.mechanics?.train?.authoredGroups,
        random
      });
      return {
        train: {
          mode: plan.mode,
          chance: plan.chance,
          carriageVehicleIds: [...plan.vehicleIds],
          trackSlots: Array.from({ length: TRAIN_SIZE }, () => null),
          locomotive: { phase: 'ready', motion: 1, cycle: 0 },
          departurePendingAt: null,
          authoredGroupCount: plan.authoredGroupCount,
          authoredCarriageCount: plan.authoredCarriageCount,
          invalidAuthoredGroupCount: plan.invalidAuthoredGroupCount
        }
      };
    },

    afterReset({ game }) {
      const selectedIds = new Set(game.mechanicState.train.carriageVehicleIds);
      for (const vehicle of game.vehicles) {
        vehicle.trainCarriage = selectedIds.has(vehicle.id);
        vehicle.trackSlotIndex = null;
      }
    },

    decorateSnapshot(game) {
      const train = game.mechanicState.train;
      return {
        train: {
          ...train,
          carriageVehicleIds: [...train.carriageVehicleIds],
          trackSlots: train.trackSlots.map(cloneTrackSlot),
          locomotive: { ...train.locomotive }
        }
      };
    },

    dispatchVehicle({ game, vehicle }) {
      if (!vehicle.trainCarriage) return null;
      const train = game.mechanicState.train;
      if (train.locomotive.phase !== 'ready') {
        return {
          handled: true,
          result: { ok: false, reason: 'train-transition' },
          event: { type: 'train-transition', vehicleId: vehicle.id }
        };
      }
      const trackSlotIndex = train.trackSlots.findIndex((slot) => slot === null);
      if (trackSlotIndex < 0) {
        return {
          handled: true,
          result: { ok: false, reason: 'train-track-full' },
          event: { type: 'train-track-full', vehicleId: vehicle.id }
        };
      }

      train.trackSlots[trackSlotIndex] = {
        index: trackSlotIndex,
        vehicleId: vehicle.id
      };
      Object.assign(vehicle, {
        state: 'moving-to-track',
        spotIndex: null,
        trackSlotIndex,
        motion: 0,
        motionData: { duration: dispatchDuration }
      });
      const event = {
        type: 'vehicle-dispatched',
        vehicleId: vehicle.id,
        trackSlotIndex
      };
      return {
        handled: true,
        result: { ok: true, trackSlotIndex },
        destination: { kind: 'train-track', trackSlotIndex },
        event
      };
    },

    findBoardableVehicle({ game, colorIndex, requiredGroups = 1 }) {
      for (const slot of game.mechanicState.train.trackSlots) {
        if (!slot) continue;
        const vehicle = game.getVehicle(slot.vehicleId);
        const freeGroups = vehicle ? vehicle.seats - vehicle.boardedGroups : 0;
        if (
          vehicle?.state === 'at-track'
          && vehicle.colorIndex === colorIndex
          && freeGroups >= requiredGroups
        ) return vehicle;
      }
      return null;
    },

    onPassengerBatchBoarded({ vehicle }) {
      return vehicle.trainCarriage
        ? { trainTrackSlotIndex: vehicle.trackSlotIndex }
        : {};
    },

    onVehicleFilled({ game, vehicle }) {
      if (!vehicle.trainCarriage || vehicle.trackSlotIndex == null) return false;
      Object.assign(vehicle, { state: 'train-full', motion: 0, motionData: null });
      game.lastEvent = {
        type: 'train-carriage-full',
        vehicleId: vehicle.id,
        trackSlotIndex: vehicle.trackSlotIndex
      };
      const train = game.mechanicState.train;
      const trackVehicles = getTrackVehicles(game);
      if (
        train.trackSlots.every(Boolean)
        && trackVehicles.length === TRAIN_SIZE
        && trackVehicles.every((candidate) => candidate.state === 'train-full')
      ) {
        train.departurePendingAt = game.time + fullLoadDelay;
      }
      return true;
    },

    hasOpenVehicleDestination(game) {
      const train = game.mechanicState.train;
      if (train.locomotive.phase !== 'ready' || train.trackSlots.every(Boolean)) return false;
      return train.carriageVehicleIds.some((id) => game.getVehicle(id)?.state === 'parked');
    },

    hasPendingVehicles(game) {
      const train = game.mechanicState.train;
      return (
        train.departurePendingAt != null
        || train.locomotive.phase === 'departing'
        || train.locomotive.phase === 'entering'
        || train.trackSlots.some((slot) => (
          slot && game.getVehicle(slot.vehicleId)?.state === 'moving-to-track'
        ))
      );
    },

    update({ game, delta }) {
      const train = game.mechanicState.train;
      let changed = false;
      for (const vehicle of game.vehicles) {
        if (vehicle.state !== 'moving-to-track') continue;
        const travelDuration = Math.max(0.01, vehicle.motionData?.duration ?? dispatchDuration);
        vehicle.motion = Math.min(1, vehicle.motion + Math.max(0, delta) / travelDuration);
        if (vehicle.motion < 1) continue;
        Object.assign(vehicle, { state: 'at-track', motion: 0, motionData: null });
        game.lastEvent = {
          type: 'vehicle-arrived',
          vehicleId: vehicle.id,
          trackSlotIndex: vehicle.trackSlotIndex
        };
        changed = true;
      }

      if (
        train.departurePendingAt != null
        && game.time >= train.departurePendingAt
        && train.locomotive.phase === 'ready'
      ) {
        const vehicleIds = train.trackSlots.map((slot) => slot.vehicleId);
        train.departurePendingAt = null;
        train.locomotive = {
          ...train.locomotive,
          phase: 'departing',
          motion: 0
        };
        for (const vehicle of getTrackVehicles(game)) {
          Object.assign(vehicle, {
            state: 'train-departing',
            motion: 0,
            motionData: { duration: departureDuration }
          });
        }
        game.lastEvent = {
          type: 'train-full',
          cycle: train.locomotive.cycle,
          vehicleIds
        };
        return true;
      }

      if (train.locomotive.phase === 'departing') {
        train.locomotive.motion = Math.min(
          1,
          train.locomotive.motion + Math.max(0, delta) / departureDuration
        );
        for (const vehicle of getTrackVehicles(game)) {
          vehicle.motion = train.locomotive.motion;
        }
        if (train.locomotive.motion >= 1) {
          const departingVehicles = getTrackVehicles(game);
          for (const vehicle of departingVehicles) {
            Object.assign(vehicle, {
              state: 'done',
              motion: 0,
              motionData: null,
              trackSlotIndex: null
            });
          }
          train.trackSlots = Array.from({ length: TRAIN_SIZE }, () => null);
          const hasRemainingCarriages = train.carriageVehicleIds.some((id) => (
            game.getVehicle(id)?.state !== 'done'
          ));
          train.locomotive = {
            ...train.locomotive,
            phase: hasRemainingCarriages ? 'entering' : 'complete',
            motion: hasRemainingCarriages ? 0 : 1
          };
          game.lastEvent = {
            type: 'train-finished',
            cycle: train.locomotive.cycle,
            vehicleIds: departingVehicles.map(({ id }) => id)
          };
        }
        return true;
      }

      if (train.locomotive.phase === 'entering') {
        train.locomotive.motion = Math.min(
          1,
          train.locomotive.motion + Math.max(0, delta) / locomotiveEntryDuration
        );
        if (train.locomotive.motion >= 1) {
          train.locomotive = {
            phase: 'ready',
            motion: 1,
            cycle: train.locomotive.cycle + 1
          };
          game.lastEvent = {
            type: 'train-locomotive-arrived',
            cycle: train.locomotive.cycle
          };
        }
        return true;
      }

      return changed;
    }
  };
}
