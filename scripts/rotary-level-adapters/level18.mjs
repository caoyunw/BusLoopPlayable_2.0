import { COLORS, LEVEL_1 } from '../../src/level-data.js';
import { SCENE_TUNING } from '../../src/scene-tuning.js';
import { computeContextFingerprint } from '../../tools/rotary-level-contract/fingerprint.js';

export const LEVEL18_ID = 'GameSceneDualQueue2/18';
export const LEVEL18_OUTPUT = new URL(
  '../../src/levels/generated/level18-rotary-layout.js',
  import.meta.url
);

const FORMAT = 'level.rotary.v1';
const ADAPTER = 'busloop-level-data.v1';
const GEOMETRY_PROFILE = 'busloop-level18-rotary.v1';
const ROTARY_ROAD_WIDTH = 0.42;

function clone(value) {
  return structuredClone(value);
}

function isGarageVehicle(vehicle) {
  return Number(vehicle.containerType) === 2;
}

function garageContexts() {
  const footprint = LEVEL_1.collision.garageSize;
  return LEVEL_1.containers
    .filter(({ type }) => Number(type) === 2)
    .map((container) => ({
      id: container.id,
      x: container.x,
      z: container.z,
      yaw: container.yaw,
      width: footprint.width,
      length: footprint.length
    }));
}

function parkingSpotContexts() {
  const count = Number(LEVEL_1.spotCount ?? SCENE_TUNING.parkingSpots.count);
  const motion = LEVEL_1.vehicleMotion;
  const footprint = LEVEL_1.collision.maxVehicleSize;
  return Array.from({ length: count }, (_, index) => ({
    id: `parking-${String(index + 1).padStart(2, '0')}`,
    kind: 'parking-spot',
    label: `Parking spot ${index + 1}`,
    x: motion.spotStartX + motion.spotSpacing * index,
    z: motion.spotZ,
    yaw: motion.spotYaw,
    width: footprint.width,
    length: footprint.length,
    protected: false
  }));
}

function passengerQueueSummaries() {
  return (LEVEL_1.passengerQueues ?? []).map((queue, index) => ({
    id: `passenger-queue-${index + 1}`,
    label: `Passenger queue ${index + 1}`,
    count: queue.length
  }));
}

function allowedColorIndexes() {
  return Object.keys(COLORS)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 9)
    .sort((a, b) => a - b);
}

export function getCurrentLevel18ContextPayload() {
  return {
    target: {
      levelId: LEVEL18_ID,
      adapter: ADAPTER
    },
    coordinates: {
      plane: 'xz',
      unit: 'level-unit',
      yaw: 'degrees',
      geometryProfile: GEOMETRY_PROFILE
    },
    context: {
      garages: garageContexts(),
      parkingSpots: parkingSpotContexts(),
      conveyors: [{
        id: 'passenger-conveyor',
        label: 'Passenger conveyor',
        count: Number(LEVEL_1.conveyorCapacity)
      }],
      passengerQueues: passengerQueueSummaries(),
      protectedGeometry: [],
      vehicleFootprints: clone(LEVEL_1.collision.vehicleSizes),
      rotaryRoadWidth: ROTARY_ROAD_WIDTH,
      allowedColorIndexes: allowedColorIndexes()
    }
  };
}

function exportRotaryLanes() {
  return (LEVEL_1.mechanics?.['rotary-lane']?.lanes ?? []).map((lane) => ({
    id: lane.id,
    slots: lane.slots.map((slot, index) => ({
      id: `slot-${String(index + 1).padStart(2, '0')}`,
      x: slot.x,
      z: slot.z,
      yaw: slot.yaw
    }))
  }));
}

function rotaryOwnership() {
  const ownership = new Map();
  (LEVEL_1.mechanics?.['rotary-lane']?.lanes ?? []).forEach((lane) => {
    lane.slots.forEach((slot, index) => {
      if (slot.vehicleId === null || slot.vehicleId === undefined) return;
      ownership.set(slot.vehicleId, {
        kind: 'rotary-slot',
        laneId: lane.id,
        slotId: `slot-${String(index + 1).padStart(2, '0')}`
      });
    });
  });
  return ownership;
}

function garageOwnership() {
  const ownership = new Map();
  for (const garage of garageContexts()) {
    LEVEL_1.vehicles
      .filter((vehicle) => isGarageVehicle(vehicle)
        && Number(vehicle.containerId) === Number(garage.id))
      .forEach((vehicle, stockOrder) => {
        ownership.set(vehicle.id, {
          kind: 'garage',
          garageId: garage.id,
          stockOrder,
          storedPose: {
            x: vehicle.x,
            z: vehicle.z,
            yaw: vehicle.yaw
          }
        });
      });
  }
  return ownership;
}

function exportVehicle(vehicle, placement) {
  return {
    id: vehicle.id,
    colorIndex: vehicle.colorIndex,
    seats: vehicle.seats,
    placement: clone(placement)
  };
}

export async function exportLevel18Document() {
  const payload = getCurrentLevel18ContextPayload();
  const lanes = exportRotaryLanes();
  const rotary = rotaryOwnership();
  const garages = garageOwnership();
  const byId = new Map(LEVEL_1.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const fieldVehicles = LEVEL_1.vehicles
    .filter((vehicle) => !rotary.has(vehicle.id) && !garages.has(vehicle.id))
    .map((vehicle) => exportVehicle(vehicle, {
      kind: 'field',
      x: vehicle.x,
      z: vehicle.z,
      yaw: vehicle.yaw
    }));
  const rotaryVehicles = [...rotary]
    .map(([vehicleId, placement]) => exportVehicle(byId.get(vehicleId), placement));
  const garageVehicles = LEVEL_1.vehicles
    .filter((vehicle) => garages.has(vehicle.id))
    .map((vehicle) => exportVehicle(vehicle, garages.get(vehicle.id)));

  const document = {
    format: FORMAT,
    documentId: 'level18-current',
    target: {
      ...payload.target,
      contextFingerprint: `sha256:${'0'.repeat(64)}`
    },
    coordinates: payload.coordinates,
    vehicles: [...fieldVehicles, ...rotaryVehicles, ...garageVehicles],
    rotaryLanes: lanes,
    context: payload.context
  };
  document.target.contextFingerprint = await computeContextFingerprint(document);
  return document;
}

function runtimeVehicle(vehicle, document) {
  let pose;
  const runtime = {
    id: vehicle.id,
    seats: vehicle.seats,
    colorIndex: vehicle.colorIndex
  };
  if (vehicle.placement.kind === 'field') {
    pose = vehicle.placement;
  } else if (vehicle.placement.kind === 'garage') {
    pose = vehicle.placement.storedPose;
    runtime.containerType = 2;
    runtime.containerId = vehicle.placement.garageId;
  } else {
    pose = document.rotaryLanes
      .find(({ id }) => id === vehicle.placement.laneId)
      ?.slots.find(({ id }) => id === vehicle.placement.slotId);
    if (!pose) {
      throw new Error(
        `Unknown slot ${vehicle.placement.laneId}/${vehicle.placement.slotId}`
      );
    }
  }
  return { ...runtime, x: pose.x, z: pose.z, yaw: pose.yaw };
}

export function convertDocumentToRuntimeLayout(document) {
  const nonGarage = document.vehicles.filter(({ placement }) => (
    placement.kind !== 'garage'
  ));
  const garageVehicles = [];
  for (const garage of document.context.garages) {
    garageVehicles.push(...document.vehicles
      .filter(({ placement }) => placement.kind === 'garage'
        && Number(placement.garageId) === Number(garage.id))
      .sort((a, b) => a.placement.stockOrder - b.placement.stockOrder));
  }
  const occupantBySlot = new Map(
    document.vehicles
      .filter(({ placement }) => placement.kind === 'rotary-slot')
      .map((vehicle) => [
        `${vehicle.placement.laneId}\u0000${vehicle.placement.slotId}`,
        vehicle.id
      ])
  );
  return {
    vehicles: [...nonGarage, ...garageVehicles]
      .map((vehicle) => runtimeVehicle(vehicle, document)),
    rotaryLane: {
      lanes: document.rotaryLanes.map((lane) => ({
        id: lane.id,
        slots: lane.slots.map((slot) => ({
          x: slot.x,
          z: slot.z,
          yaw: slot.yaw,
          vehicleId: occupantBySlot.get(`${lane.id}\u0000${slot.id}`) ?? null
        }))
      }))
    }
  };
}
