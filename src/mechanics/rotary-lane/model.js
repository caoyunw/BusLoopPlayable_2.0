import { evaluatePath, evaluateUnityCurve } from '../../vehicle-motion.js';

const MIN_SLOT_COUNT = 3;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeVehicleId(value) {
  if (value == null) return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : undefined;
}

function normalizeSlot(slot, vehicleIds) {
  const x = finiteNumber(slot?.x);
  const z = finiteNumber(slot?.z);
  const yaw = finiteNumber(slot?.yaw);
  const vehicleId = normalizeVehicleId(slot?.vehicleId);
  if (x == null || z == null || yaw == null || vehicleId === undefined) return null;
  if (vehicleId != null && !vehicleIds.has(vehicleId)) return null;
  return Object.freeze({ x, z, yaw, vehicleId });
}

export function rotateLaneOccupants(occupants) {
  if (!Array.isArray(occupants) || occupants.length === 0) return [];
  return [occupants.at(-1), ...occupants.slice(0, -1)];
}

export function normalizeRotaryLanes(config = {}, vehicles = []) {
  const vehicleIds = new Set(vehicles.map(({ id }) => id));
  const acceptedLaneIds = new Set();
  const claimedVehicleIds = new Set();
  const lanes = [];
  let invalidLaneCount = 0;

  for (const source of config?.lanes ?? []) {
    const id = typeof source?.id === 'string' ? source.id.trim() : '';
    const slots = Array.isArray(source?.slots)
      ? source.slots.map((slot) => normalizeSlot(slot, vehicleIds))
      : [];
    const localIds = slots
      .filter(Boolean)
      .map(({ vehicleId }) => vehicleId)
      .filter((vehicleId) => vehicleId != null);
    const invalid = !id
      || acceptedLaneIds.has(id)
      || slots.length < MIN_SLOT_COUNT
      || slots.some((slot) => slot == null)
      || new Set(localIds).size !== localIds.length
      || localIds.some((vehicleId) => claimedVehicleIds.has(vehicleId));
    if (invalid) {
      invalidLaneCount += 1;
      continue;
    }
    acceptedLaneIds.add(id);
    for (const vehicleId of localIds) claimedVehicleIds.add(vehicleId);
    lanes.push(Object.freeze({ id, slots: Object.freeze(slots) }));
  }

  return Object.freeze({
    lanes: Object.freeze(lanes),
    invalidLaneCount
  });
}

function cloneLane(lane) {
  return {
    id: lane.id,
    slots: lane.slots.map((slot) => ({ ...slot })),
    occupants: [...lane.occupants]
  };
}

function getState(game) {
  return game.mechanicState.rotaryLane;
}

function findOccupant(state, vehicleId) {
  for (const lane of state.lanes) {
    const slotIndex = lane.occupants.indexOf(vehicleId);
    if (slotIndex >= 0) return { lane, slotIndex };
  }
  return null;
}

function clearedOrigin(game, state, clearanceDistance) {
  const vehicle = game.getVehicle(state.waitingVehicleId);
  if (!vehicle || vehicle.state !== 'moving-to-spot') return true;
  const data = vehicle.motionData;
  if (!data?.path || !data?.curve) return vehicle.motion > 0;
  const curveValue = evaluateUnityCurve(data.curve, vehicle.motion);
  const sample = evaluatePath(data.path, data.path.length * curveValue);
  return Math.hypot(
    sample.position.x - state.waitingOrigin.x,
    sample.position.z - state.waitingOrigin.z
  ) >= clearanceDistance;
}

function startShift(game, state, duration) {
  state.phase = 'shifting';
  state.shiftProgress = 0;
  state.waitingVehicleId = null;
  state.waitingOrigin = null;
  state.triggerVersion += 1;
  state.startedAt = game.time;
  for (const lane of state.lanes) {
    const previous = [...lane.occupants];
    lane.occupants = rotateLaneOccupants(previous);
    lane.moves = [];
    for (let targetIndex = 0; targetIndex < lane.occupants.length; targetIndex += 1) {
      const vehicleId = lane.occupants[targetIndex];
      if (vehicleId == null) continue;
      const sourceIndex = (targetIndex - 1 + lane.slots.length) % lane.slots.length;
      const from = lane.slots[sourceIndex];
      const to = lane.slots[targetIndex];
      const vehicle = game.getVehicle(vehicleId);
      if (!vehicle || !['parked', 'colliding'].includes(vehicle.state)) continue;
      const motionData = {
        duration,
        laneId: lane.id,
        from: { x: from.x, z: from.z, yaw: from.yaw },
        to: { x: to.x, z: to.z, yaw: to.yaw }
      };
      Object.assign(vehicle, {
        state: 'rotary-lane-shifting',
        motion: 0,
        motionData,
        collision: null,
        useDynamicBlockers: true
      });
      lane.moves.push({ vehicleId, targetIndex });
    }
  }
}

export function createRotaryLaneRuntime({ level = null, options = {} } = {}) {
  const shiftDuration = Math.max(0.05, Number(options.shiftDuration) || 0.45);

  return {
    id: 'rotary-lane',

    createState(game) {
      const activeLevel = game?.level ?? level ?? {};
      const normalized = normalizeRotaryLanes(
        activeLevel.mechanics?.['rotary-lane'],
        activeLevel.vehicles
      );
      if (normalized.invalidLaneCount > 0) {
        console.warn(
          `[rotary-lane] ignored ${normalized.invalidLaneCount} invalid lane configuration(s)`
        );
      }
      return {
        rotaryLane: {
          phase: 'idle',
          invalidLaneCount: normalized.invalidLaneCount,
          waitingVehicleId: null,
          waitingOrigin: null,
          shiftProgress: 0,
          triggerVersion: 0,
          startedAt: null,
          lanes: normalized.lanes.map((lane) => ({
            id: lane.id,
            slots: lane.slots.map((slot) => ({ ...slot })),
            occupants: lane.slots.map(({ vehicleId }) => vehicleId),
            moves: []
          }))
        }
      };
    },

    afterReset({ game }) {
      const state = getState(game);
      for (const lane of state.lanes) {
        lane.occupants = lane.slots.map(({ vehicleId }) => vehicleId);
        lane.moves = [];
        lane.slots.forEach((slot) => {
          if (slot.vehicleId == null) return;
          const vehicle = game.getVehicle(slot.vehicleId);
          if (!vehicle) return;
          Object.assign(vehicle, {
            x: slot.x,
            z: slot.z,
            yaw: slot.yaw,
            useDynamicBlockers: true
          });
        });
      }
    },

    canVehicleDispatch({ game }) {
      return getState(game)?.phase === 'idle';
    },

    onVehicleDispatched({ game, vehicle }) {
      const state = getState(game);
      if (!state || state.phase !== 'idle' || state.lanes.length === 0) return false;
      const occupant = findOccupant(state, vehicle.id);
      if (occupant) {
        const origin = occupant.lane.slots[occupant.slotIndex];
        occupant.lane.occupants[occupant.slotIndex] = null;
        state.phase = 'waiting-clearance';
        state.waitingVehicleId = vehicle.id;
        state.waitingOrigin = { x: origin.x, z: origin.z };
      } else {
        startShift(game, state, shiftDuration);
      }
      return true;
    },

    hasPendingVehicles(game) {
      return getState(game)?.phase !== 'idle';
    },

    decorateSnapshot(game) {
      const state = getState(game);
      return {
        rotaryLane: {
          phase: state.phase,
          invalidLaneCount: state.invalidLaneCount,
          triggerVersion: state.triggerVersion,
          startedAt: state.startedAt,
          shiftProgress: state.shiftProgress,
          lanes: state.lanes.map(cloneLane)
        }
      };
    },

    update({ game, delta }) {
      const state = getState(game);
      if (!state || state.phase === 'idle') return false;
      if (state.phase === 'waiting-clearance') {
        const clearance = game.level.vehicleSize.length / game.level.mapScale * 0.55;
        if (!clearedOrigin(game, state, clearance)) return false;
        startShift(game, state, shiftDuration);
        return true;
      }
      state.shiftProgress = Math.min(
        1,
        state.shiftProgress + Math.max(0, delta) / shiftDuration
      );
      for (const lane of state.lanes) {
        for (const { vehicleId } of lane.moves) {
          const vehicle = game.getVehicle(vehicleId);
          if (vehicle?.state === 'rotary-lane-shifting') {
            vehicle.motion = state.shiftProgress;
          }
        }
      }
      if (state.shiftProgress < 1) return true;
      for (const lane of state.lanes) {
        for (const { vehicleId, targetIndex } of lane.moves) {
          const vehicle = game.getVehicle(vehicleId);
          const target = lane.slots[targetIndex];
          if (!vehicle) continue;
          Object.assign(vehicle, {
            state: 'parked',
            x: target.x,
            z: target.z,
            yaw: target.yaw,
            motion: 0,
            motionData: null,
            useDynamicBlockers: true
          });
        }
        lane.moves = [];
      }
      state.phase = 'idle';
      state.shiftProgress = 0;
      game.lastEvent = {
        type: 'rotary-lane-complete',
        version: state.triggerVersion
      };
      return true;
    }
  };
}
