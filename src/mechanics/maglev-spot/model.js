const DEFAULT_MAGLEV_VEHICLE_IDS = Object.freeze([28, 35, 33, 50, 39, 58, 41, 52]);
const ELEVATED_STATES = new Set(['parked', 'colliding']);

function normalizeVehicleIds(ids) {
  return [...new Set((ids ?? DEFAULT_MAGLEV_VEHICLE_IDS)
    .map((id) => Math.round(Number(id)))
    .filter((id) => Number.isFinite(id)))];
}

function isMaglevVehicle(state, vehicle) {
  return Boolean(vehicle && state?.vehicleIdsSet?.has(vehicle.id));
}

function isElevatedVehicle(state, vehicle) {
  return Boolean(state?.raised && isMaglevVehicle(state, vehicle) && ELEVATED_STATES.has(vehicle.state));
}

function createMaglevSpotState(vehicleIds, initialRaised = false) {
  return {
    raised: Boolean(initialRaised),
    vehicleIds,
    vehicleIdsSet: new Set(vehicleIds),
    toggleCount: 0,
    lastToggledAt: null
  };
}

export function createMaglevSpotRuntime({ options = {} } = {}) {
  const vehicleIds = normalizeVehicleIds(options.vehicleIds);
  const initialRaised = Boolean(options.initialRaised);
  const elevation = Math.max(0.1, Number(options.elevation) || 0.62);

  function getState(game) {
    return game.mechanicState.maglevSpot;
  }

  return {
    id: 'maglev-spot',

    createState() {
      return {
        maglevSpot: createMaglevSpotState(vehicleIds, initialRaised)
      };
    },

    canVehicleDispatch({ game, vehicle }) {
      return !isElevatedVehicle(getState(game), vehicle);
    },

    isVehicleBlocking({ game, candidate }) {
      return !isElevatedVehicle(getState(game), candidate);
    },

    onVehicleDispatched({ game }) {
      const state = getState(game);
      if (!state) return false;
      state.raised = !state.raised;
      state.toggleCount += 1;
      state.lastToggledAt = game.time;
      return true;
    },

    decorateSnapshot(game) {
      const state = getState(game);
      if (!state) return {};
      const elevatedVehicleIds = game.vehicles
        .filter((vehicle) => isElevatedVehicle(state, vehicle))
        .map((vehicle) => vehicle.id);
      return {
        maglevSpot: {
          raised: state.raised,
          elevation,
          vehicleIds: [...state.vehicleIds],
          elevatedVehicleIds,
          toggleCount: state.toggleCount,
          lastToggledAt: state.lastToggledAt
        }
      };
    }
  };
}
