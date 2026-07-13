const DEFAULT_CONFIG = Object.freeze({
  outDuration: 1.2,
  outStartOffset: Object.freeze({ x: 0, z: -0.1748478 }),
  parkOffset: Object.freeze({ x: 0, z: 0.70000005 })
});

function isGarageType(value) {
  if (value === 2) return true;
  return String(value ?? '').trim().toLowerCase() === 'garage';
}

function getPosition(config = {}) {
  const position = config.position ?? config;
  return {
    x: Number(position.x ?? 0),
    y: Number(position.y ?? 0),
    z: Number(position.z ?? 0)
  };
}

function yawFromQuaternion(rotation = null) {
  if (!rotation || typeof rotation !== 'object') return null;
  const { x = 0, y = 0, z = 0, w = 1 } = rotation;
  const siny = 2 * (w * y + x * z);
  const cosy = 1 - 2 * (y * y + z * z);
  return Math.atan2(siny, cosy) * 180 / Math.PI;
}

function getYaw(config = {}) {
  return Number(
    config.yaw
    ?? config.yawDegrees
    ?? config.rotationYDegrees
    ?? yawFromQuaternion(config.rotation)
    ?? 0
  );
}

function cloneGarage(garage) {
  const displayCount = getDisplayCount(garage);
  return {
    id: garage.id,
    type: 'garage',
    position: { ...garage.position },
    yaw: garage.yaw,
    vehicleIds: [...garage.vehicleIds],
    exitingVehicleId: garage.exitingVehicleId,
    lastOutVehicleId: garage.lastOutVehicleId,
    remainingCount: garage.vehicleIds.length,
    displayCount,
    hidden: garage.hidden
  };
}

function getDisplayCount(garage) {
  return Math.max(0, garage.vehicleIds.length - (garage.exitingVehicleId == null ? 0 : 1));
}

function removeVehicleId(ids, vehicleId) {
  const index = ids.indexOf(vehicleId);
  if (index >= 0) ids.splice(index, 1);
}

function isGarageVehicle(vehicle, garageId) {
  return isGarageType(vehicle.containerType) && Number(vehicle.containerId) === Number(garageId);
}

export function createGarageRuntime({ options = {} } = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  function transformLocalPoint(garage, offset = {}) {
    const yaw = garage.yaw * Math.PI / 180;
    const localX = Number(offset.x ?? 0);
    const localZ = Number(offset.z ?? 0);
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    return {
      x: garage.position.x + right.x * localX + forward.x * localZ,
      z: garage.position.z + right.z * localX + forward.z * localZ,
      yaw: garage.yaw
    };
  }

  function getGarages(level) {
    return (level.containers ?? [])
      .filter((container) => isGarageType(container.type))
      .map((container) => {
        const vehicleIds = [];
        for (let index = level.vehicles.length - 1; index >= 0; index -= 1) {
          const vehicle = level.vehicles[index];
          if (isGarageVehicle(vehicle, container.id)) vehicleIds.push(vehicle.id);
        }
        return {
          id: container.id,
          type: 'garage',
          position: getPosition(container),
          yaw: getYaw(container),
          vehicleIds,
          exitingVehicleId: null,
          lastOutVehicleId: null,
          hidden: vehicleIds.length === 0
        };
      });
  }

  function getGarageForVehicle(state, vehicleId) {
    return state.garages.find((garage) => (
      garage.vehicleIds.includes(vehicleId) || garage.exitingVehicleId === vehicleId
    ));
  }

  function isGarageDoorClear(game, garage) {
    if (garage.lastOutVehicleId == null) return true;
    const lastVehicle = game.getVehicle(garage.lastOutVehicleId);
    return !lastVehicle || !['parked', 'colliding'].includes(lastVehicle.state);
  }

  function startDriveOut(game, garage, vehicle) {
    const from = transformLocalPoint(garage, config.outStartOffset);
    const to = transformLocalPoint(garage, config.parkOffset);
    garage.exitingVehicleId = vehicle.id;
    garage.lastOutVehicleId = vehicle.id;
    if (getDisplayCount(garage) === 0) garage.hidden = true;
    vehicle.state = 'leaving-garage';
    vehicle.motion = 0;
    vehicle.spotIndex = null;
    vehicle.garageId = garage.id;
    vehicle.motionData = {
      duration: Math.max(0.1, Number(config.outDuration ?? DEFAULT_CONFIG.outDuration)),
      from,
      to
    };
    game.lastEvent = {
      type: 'garage-out',
      garageId: garage.id,
      vehicleId: vehicle.id,
      remainingCount: Math.max(0, garage.vehicleIds.length - 1)
    };
  }

  function updateDriveOut(game, garage, vehicle, delta) {
    const duration = Math.max(0.1, vehicle.motionData?.duration ?? config.outDuration);
    vehicle.motion = Math.min(1, vehicle.motion + delta / duration);
    if (vehicle.motion < 1) return false;

    removeVehicleId(garage.vehicleIds, vehicle.id);
    garage.exitingVehicleId = null;
    vehicle.x = vehicle.motionData.to.x;
    vehicle.z = vehicle.motionData.to.z;
    vehicle.yaw = vehicle.motionData.to.yaw;
    vehicle.useDynamicBlockers = true;
    vehicle.state = 'parked';
    vehicle.motion = 0;
    vehicle.motionData = null;
    game.lastEvent = {
      type: 'garage-vehicle-released',
      garageId: garage.id,
      vehicleId: vehicle.id,
      remainingCount: garage.vehicleIds.length
    };
    return true;
  }

  function maybeHideClearedGarage(game, garage) {
    if (garage.hidden || garage.vehicleIds.length > 0 || garage.exitingVehicleId != null) return false;
    const lastVehicle = game.getVehicle(garage.lastOutVehicleId);
    if (lastVehicle?.state !== 'done') return false;
    garage.hidden = true;
    game.lastEvent = {
      type: 'garage-clear',
      garageId: garage.id,
      vehicleId: lastVehicle.id
    };
    return true;
  }

  return {
    id: 'garage',

    createState(game) {
      return { garages: getGarages(game.level) };
    },

    afterReset({ game }) {
      for (const garage of game.mechanicState.garages) {
        for (const vehicleId of garage.vehicleIds) {
          const vehicle = game.getVehicle(vehicleId);
          if (!vehicle) continue;
          vehicle.state = 'in-garage';
          vehicle.garageId = garage.id;
          vehicle.motion = 0;
          vehicle.motionData = null;
          vehicle.spotIndex = null;
        }
      }
    },

    decorateSnapshot(game) {
      return { garages: game.mechanicState.garages.map(cloneGarage) };
    },

    update({ game, delta }) {
      let changed = false;
      for (const garage of game.mechanicState.garages) {
        if (garage.exitingVehicleId != null) {
          const vehicle = game.getVehicle(garage.exitingVehicleId);
          if (vehicle) changed = updateDriveOut(game, garage, vehicle, delta) || changed;
        }

        if (garage.exitingVehicleId == null && garage.vehicleIds.length > 0 && isGarageDoorClear(game, garage)) {
          const nextVehicleId = garage.vehicleIds.at(-1);
          const vehicle = game.getVehicle(nextVehicleId);
          if (vehicle) {
            startDriveOut(game, garage, vehicle);
            changed = true;
          }
        }

        changed = maybeHideClearedGarage(game, garage) || changed;
      }
      return changed;
    },

    hasPendingVehicles(game) {
      return game.mechanicState.garages.some((garage) => (
        garage.vehicleIds.length > 0 || garage.exitingVehicleId != null
      ));
    },

    getGarageForVehicle(game, vehicleId) {
      return getGarageForVehicle(game.mechanicState, vehicleId);
    }
  };
}
