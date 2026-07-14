import {
  obbOverlaps,
  poseToObb,
  segmentRoadObb,
  segmentsIntersect
} from './geometry.js';

const FORMAT = 'level.rotary.v1';
const ADAPTER = 'busloop-level-data.v1';
const SEAT_COUNTS = new Set([4, 6, 10]);
const TOP_LEVEL_KEYS = [
  'format',
  'documentId',
  'target',
  'coordinates',
  'vehicles',
  'rotaryLanes',
  'context'
];
const TARGET_KEYS = ['levelId', 'adapter', 'contextFingerprint'];
const COORDINATE_KEYS = ['plane', 'unit', 'yaw', 'geometryProfile'];
const VEHICLE_KEYS = ['id', 'colorIndex', 'seats', 'placement'];
const LANE_KEYS = ['id', 'slots'];
const SLOT_KEYS = ['id', 'x', 'z', 'yaw'];
const FIELD_KEYS = ['kind', 'x', 'z', 'yaw'];
const ROTARY_SLOT_KEYS = ['kind', 'laneId', 'slotId'];
const GARAGE_PLACEMENT_KEYS = [
  'kind',
  'garageId',
  'stockOrder',
  'storedPose'
];
const POSE_KEYS = ['x', 'z', 'yaw'];
const CONTEXT_KEYS = [
  'garages',
  'parkingSpots',
  'conveyors',
  'passengerQueues',
  'protectedGeometry',
  'vehicleFootprints',
  'rotaryRoadWidth',
  'allowedColorIndexes'
];
const GARAGE_KEYS = ['id', 'x', 'z', 'yaw', 'width', 'length'];
const CONTEXT_OBB_KEYS = [
  'id',
  'kind',
  'label',
  'x',
  'z',
  'yaw',
  'width',
  'length',
  'protected'
];
const SUMMARY_KEYS = ['id', 'label', 'count'];
const FOOTPRINT_KEYS = ['width', 'length'];
const EPSILON = 1e-6;

function issue(severity, code, path, objectType, objectId, message) {
  return { severity, code, path, objectType, objectId, message };
}

function add(result, severity, code, path, objectType, objectId, message) {
  result[severity === 'error' ? 'errors' : 'warnings'].push(
    issue(severity, code, path, objectType, objectId, message)
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function reportUnknownKeys(
  value,
  allowed,
  result,
  code,
  path,
  objectType,
  objectId
) {
  if (!isRecord(value)) return;
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value).sort()) {
    if (!allowedSet.has(key)) {
      add(
        result,
        'error',
        code,
        `${path}/${escapePointer(key)}`,
        objectType,
        objectId,
        `Unknown property: ${key}`
      );
    }
  }
}

function reportMissingKeys(
  value,
  required,
  result,
  code,
  path,
  objectType,
  objectId
) {
  if (!isRecord(value)) return;
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      add(
        result,
        'error',
        code,
        `${path}/${escapePointer(key)}`,
        objectType,
        objectId,
        `Missing required property: ${key}`
      );
    }
  }
}

function requireFinite(value, result, path, objectType, objectId) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    add(
      result,
      'error',
      'value.non-finite',
      path,
      objectType,
      objectId,
      'Expected a finite number'
    );
    return false;
  }
  return true;
}

function validatePoseShape(pose, result, path, objectType, objectId) {
  if (!isRecord(pose)) {
    add(
      result,
      'error',
      `${objectType}.invalid-pose`,
      path,
      objectType,
      objectId,
      'Expected a pose object'
    );
    return;
  }
  reportUnknownKeys(
    pose,
    POSE_KEYS,
    result,
    `${objectType}.pose.unknown-key`,
    path,
    objectType,
    objectId
  );
  reportMissingKeys(
    pose,
    POSE_KEYS,
    result,
    `${objectType}.pose.missing-key`,
    path,
    objectType,
    objectId
  );
  for (const key of POSE_KEYS) {
    if (Object.hasOwn(pose, key)) {
      requireFinite(pose[key], result, `${path}/${key}`, objectType, objectId);
    }
  }
}

function validateVehicleShape(vehicle, index, result) {
  const path = `/vehicles/${index}`;
  const objectId = isRecord(vehicle) ? vehicle.id ?? null : null;
  if (!isRecord(vehicle)) {
    add(
      result,
      'error',
      'vehicle.invalid-type',
      path,
      'vehicle',
      objectId,
      'Expected a vehicle object'
    );
    return;
  }
  reportUnknownKeys(
    vehicle,
    VEHICLE_KEYS,
    result,
    'vehicle.unknown-key',
    path,
    'vehicle',
    objectId
  );
  reportMissingKeys(
    vehicle,
    VEHICLE_KEYS,
    result,
    'vehicle.missing-key',
    path,
    'vehicle',
    objectId
  );
  if (Object.hasOwn(vehicle, 'id')) {
    requireFinite(vehicle.id, result, `${path}/id`, 'vehicle', objectId);
  }
  if (Object.hasOwn(vehicle, 'colorIndex')) {
    requireFinite(
      vehicle.colorIndex,
      result,
      `${path}/colorIndex`,
      'vehicle',
      objectId
    );
  }
  if (Object.hasOwn(vehicle, 'seats')) {
    requireFinite(vehicle.seats, result, `${path}/seats`, 'vehicle', objectId);
  }

  const placement = vehicle.placement;
  if (!isRecord(placement)) {
    if (Object.hasOwn(vehicle, 'placement')) {
      add(
        result,
        'error',
        'vehicle.invalid-placement',
        `${path}/placement`,
        'vehicle',
        objectId,
        'Expected a placement object'
      );
    }
    return;
  }

  const placementPath = `${path}/placement`;
  const allowedKeys = placement.kind === 'field'
    ? FIELD_KEYS
    : placement.kind === 'rotary-slot'
      ? ROTARY_SLOT_KEYS
      : placement.kind === 'garage'
        ? GARAGE_PLACEMENT_KEYS
        : ['kind'];
  reportUnknownKeys(
    placement,
    allowedKeys,
    result,
    'vehicle.placement.unknown-key',
    placementPath,
    'vehicle',
    objectId
  );

  if (placement.kind === 'field') {
    reportMissingKeys(
      placement,
      FIELD_KEYS,
      result,
      'vehicle.placement.missing-key',
      placementPath,
      'vehicle',
      objectId
    );
    for (const key of ['x', 'z', 'yaw']) {
      if (Object.hasOwn(placement, key)) {
        requireFinite(
          placement[key],
          result,
          `${placementPath}/${key}`,
          'vehicle',
          objectId
        );
      }
    }
  } else if (placement.kind === 'rotary-slot') {
    reportMissingKeys(
      placement,
      ROTARY_SLOT_KEYS,
      result,
      'vehicle.placement.missing-key',
      placementPath,
      'vehicle',
      objectId
    );
  } else if (placement.kind === 'garage') {
    reportMissingKeys(
      placement,
      GARAGE_PLACEMENT_KEYS,
      result,
      'vehicle.placement.missing-key',
      placementPath,
      'vehicle',
      objectId
    );
    if (Object.hasOwn(placement, 'garageId')) {
      requireFinite(
        placement.garageId,
        result,
        `${placementPath}/garageId`,
        'vehicle',
        objectId
      );
    }
    if (Object.hasOwn(placement, 'stockOrder')) {
      requireFinite(
        placement.stockOrder,
        result,
        `${placementPath}/stockOrder`,
        'vehicle',
        objectId
      );
    }
    if (Object.hasOwn(placement, 'storedPose')) {
      validatePoseShape(
        placement.storedPose,
        result,
        `${placementPath}/storedPose`,
        'vehicle',
        objectId
      );
    }
  } else {
    add(
      result,
      'error',
      'vehicle.unknown-placement-kind',
      `${placementPath}/kind`,
      'vehicle',
      objectId,
      'Placement kind must be field, rotary-slot, or garage'
    );
  }
}

function validateLaneShape(lane, laneIndex, result) {
  const path = `/rotaryLanes/${laneIndex}`;
  const objectId = isRecord(lane) ? lane.id ?? null : null;
  if (!isRecord(lane)) {
    add(
      result,
      'error',
      'lane.invalid-type',
      path,
      'lane',
      objectId,
      'Expected a lane object'
    );
    return;
  }
  reportUnknownKeys(
    lane,
    LANE_KEYS,
    result,
    'lane.unknown-key',
    path,
    'lane',
    objectId
  );
  reportMissingKeys(
    lane,
    LANE_KEYS,
    result,
    'lane.missing-key',
    path,
    'lane',
    objectId
  );
  if (!Array.isArray(lane.slots)) {
    add(
      result,
      'error',
      'lane.invalid-slots',
      `${path}/slots`,
      'lane',
      objectId,
      'Expected a slots array'
    );
    return;
  }
  lane.slots.forEach((slot, slotIndex) => {
    const slotPath = `${path}/slots/${slotIndex}`;
    const slotId = isRecord(slot) ? slot.id ?? null : null;
    if (!isRecord(slot)) {
      add(
        result,
        'error',
        'slot.invalid-type',
        slotPath,
        'slot',
        slotId,
        'Expected a slot object'
      );
      return;
    }
    reportUnknownKeys(
      slot,
      SLOT_KEYS,
      result,
      'slot.unknown-key',
      slotPath,
      'slot',
      slotId
    );
    reportMissingKeys(
      slot,
      SLOT_KEYS,
      result,
      'slot.missing-key',
      slotPath,
      'slot',
      slotId
    );
    for (const key of ['x', 'z', 'yaw']) {
      if (Object.hasOwn(slot, key)) {
        requireFinite(
          slot[key],
          result,
          `${slotPath}/${key}`,
          'slot',
          slotId
        );
      }
    }
  });
}

function validateContextObbShape(value, result, path, objectType) {
  if (!isRecord(value)) {
    add(
      result,
      'error',
      'context.invalid-object',
      path,
      objectType,
      null,
      'Expected an object'
    );
    return;
  }
  const objectId = value.id ?? null;
  reportUnknownKeys(
    value,
    CONTEXT_OBB_KEYS,
    result,
    'context.unknown-key',
    path,
    objectType,
    objectId
  );
  reportMissingKeys(
    value,
    CONTEXT_OBB_KEYS,
    result,
    'context.missing-key',
    path,
    objectType,
    objectId
  );
  for (const key of ['x', 'z', 'yaw', 'width', 'length']) {
    if (Object.hasOwn(value, key)) {
      requireFinite(value[key], result, `${path}/${key}`, objectType, objectId);
    }
  }
}

function validateSummaryShape(value, result, path, objectType) {
  if (!isRecord(value)) {
    add(
      result,
      'error',
      'context.invalid-summary',
      path,
      objectType,
      null,
      'Expected a read-only summary object'
    );
    return;
  }
  const objectId = value.id ?? null;
  reportUnknownKeys(
    value,
    SUMMARY_KEYS,
    result,
    'context.unknown-key',
    path,
    objectType,
    objectId
  );
  reportMissingKeys(
    value,
    SUMMARY_KEYS,
    result,
    'context.missing-key',
    path,
    objectType,
    objectId
  );
  if (Object.hasOwn(value, 'count')
    && (!Number.isInteger(value.count) || value.count < 0)) {
    add(
      result,
      'error',
      'context.invalid-count',
      `${path}/count`,
      objectType,
      objectId,
      'Count must be a non-negative integer'
    );
  }
}

function validateContextShape(context, result) {
  const path = '/context';
  if (!isRecord(context)) return;
  reportUnknownKeys(
    context,
    CONTEXT_KEYS,
    result,
    'context.unknown-key',
    path,
    'context',
    null
  );
  reportMissingKeys(
    context,
    CONTEXT_KEYS,
    result,
    'context.missing-key',
    path,
    'context',
    null
  );

  const garageList = Array.isArray(context.garages) ? context.garages : [];
  garageList.forEach((garage, index) => {
    const garagePath = `${path}/garages/${index}`;
    const garageId = isRecord(garage) ? garage.id ?? null : null;
    if (!isRecord(garage)) {
      add(
        result,
        'error',
        'garage.invalid-type',
        garagePath,
        'garage',
        garageId,
        'Expected a garage object'
      );
      return;
    }
    reportUnknownKeys(
      garage,
      GARAGE_KEYS,
      result,
      'garage.unknown-key',
      garagePath,
      'garage',
      garageId
    );
    reportMissingKeys(
      garage,
      GARAGE_KEYS,
      result,
      'garage.missing-key',
      garagePath,
      'garage',
      garageId
    );
    for (const key of ['id', 'x', 'z', 'yaw', 'width', 'length']) {
      if (Object.hasOwn(garage, key)) {
        requireFinite(
          garage[key],
          result,
          `${garagePath}/${key}`,
          'garage',
          garageId
        );
      }
    }
  });

  for (const collection of ['parkingSpots', 'protectedGeometry']) {
    const values = Array.isArray(context[collection]) ? context[collection] : [];
    values.forEach((value, index) => validateContextObbShape(
      value,
      result,
      `${path}/${collection}/${index}`,
      collection === 'parkingSpots' ? 'parking-spot' : 'protected-geometry'
    ));
  }

  const conveyors = Array.isArray(context.conveyors) ? context.conveyors : [];
  conveyors.forEach((value, index) => {
    const conveyorPath = `${path}/conveyors/${index}`;
    if (isRecord(value) && Object.hasOwn(value, 'count')) {
      validateSummaryShape(value, result, conveyorPath, 'conveyor');
    } else {
      validateContextObbShape(value, result, conveyorPath, 'conveyor');
    }
  });

  const queues = Array.isArray(context.passengerQueues)
    ? context.passengerQueues
    : [];
  queues.forEach((value, index) => validateSummaryShape(
    value,
    result,
    `${path}/passengerQueues/${index}`,
    'passenger-queue'
  ));

  const footprints = context.vehicleFootprints;
  if (isRecord(footprints)) {
    reportUnknownKeys(
      footprints,
      ['4', '6', '10'],
      result,
      'context.footprints.unknown-key',
      `${path}/vehicleFootprints`,
      'context',
      null
    );
    reportMissingKeys(
      footprints,
      ['4', '6', '10'],
      result,
      'context.footprints.missing-key',
      `${path}/vehicleFootprints`,
      'context',
      null
    );
    for (const seatCount of ['4', '6', '10']) {
      const footprint = footprints[seatCount];
      const footprintPath = `${path}/vehicleFootprints/${seatCount}`;
      if (!isRecord(footprint)) continue;
      reportUnknownKeys(
        footprint,
        FOOTPRINT_KEYS,
        result,
        'context.footprint.unknown-key',
        footprintPath,
        'context',
        seatCount
      );
      reportMissingKeys(
        footprint,
        FOOTPRINT_KEYS,
        result,
        'context.footprint.missing-key',
        footprintPath,
        'context',
        seatCount
      );
      for (const key of FOOTPRINT_KEYS) {
        if (Object.hasOwn(footprint, key)) {
          requireFinite(
            footprint[key],
            result,
            `${footprintPath}/${key}`,
            'context',
            seatCount
          );
        }
      }
    }
  }
  if (Object.hasOwn(context, 'rotaryRoadWidth')) {
    requireFinite(
      context.rotaryRoadWidth,
      result,
      `${path}/rotaryRoadWidth`,
      'context',
      null
    );
  }
}

function validateTopLevel(document, result) {
  if (!isRecord(document)) {
    add(
      result,
      'error',
      'document.invalid-type',
      '',
      'document',
      null,
      'Expected a JSON object'
    );
    return;
  }
  reportUnknownKeys(
    document,
    TOP_LEVEL_KEYS,
    result,
    'document.unknown-key',
    '',
    'document',
    document.documentId ?? null
  );
  reportMissingKeys(
    document,
    TOP_LEVEL_KEYS,
    result,
    'document.missing-key',
    '',
    'document',
    document.documentId ?? null
  );
  if (document.format !== FORMAT) {
    add(
      result,
      'error',
      'document.unsupported-format',
      '/format',
      'document',
      document.documentId ?? null,
      `Format must be ${FORMAT}`
    );
  }
  if (typeof document.documentId !== 'string' || !document.documentId) {
    add(
      result,
      'error',
      'document.invalid-id',
      '/documentId',
      'document',
      document.documentId ?? null,
      'Document ID must be a non-empty string'
    );
  }

  if (!isRecord(document.target)) {
    add(
      result,
      'error',
      'document.invalid-target',
      '/target',
      'document',
      document.documentId ?? null,
      'Expected a target object'
    );
  } else {
    reportUnknownKeys(
      document.target,
      TARGET_KEYS,
      result,
      'target.unknown-key',
      '/target',
      'target',
      document.target.levelId ?? null
    );
    reportMissingKeys(
      document.target,
      TARGET_KEYS,
      result,
      'target.missing-key',
      '/target',
      'target',
      document.target.levelId ?? null
    );
    if (document.target.adapter !== ADAPTER) {
      add(
        result,
        'error',
        'target.unsupported-adapter',
        '/target/adapter',
        'target',
        document.target.levelId ?? null,
        `Adapter must be ${ADAPTER}`
      );
    }
    if (typeof document.target.contextFingerprint !== 'string'
      || !/^sha256:[0-9a-f]{64}$/.test(document.target.contextFingerprint)) {
      add(
        result,
        'error',
        'target.invalid-context-fingerprint',
        '/target/contextFingerprint',
        'target',
        document.target.levelId ?? null,
        'Context fingerprint must be a lowercase SHA-256 digest'
      );
    }
  }

  if (!isRecord(document.coordinates)) {
    add(
      result,
      'error',
      'document.invalid-coordinates',
      '/coordinates',
      'document',
      document.documentId ?? null,
      'Expected a coordinates object'
    );
  } else {
    reportUnknownKeys(
      document.coordinates,
      COORDINATE_KEYS,
      result,
      'coordinates.unknown-key',
      '/coordinates',
      'coordinates',
      null
    );
    reportMissingKeys(
      document.coordinates,
      COORDINATE_KEYS,
      result,
      'coordinates.missing-key',
      '/coordinates',
      'coordinates',
      null
    );
    if (document.coordinates.plane !== 'xz'
      || document.coordinates.unit !== 'level-unit'
      || document.coordinates.yaw !== 'degrees'
      || typeof document.coordinates.geometryProfile !== 'string'
      || !document.coordinates.geometryProfile) {
      add(
        result,
        'error',
        'coordinates.invalid-convention',
        '/coordinates',
        'coordinates',
        null,
        'Coordinates must use the v1 xz/level-unit/degrees convention'
      );
    }
  }

  if (!Array.isArray(document.vehicles)) {
    add(
      result,
      'error',
      'document.invalid-vehicles',
      '/vehicles',
      'document',
      document.documentId ?? null,
      'Expected a vehicles array'
    );
  }
  if (!Array.isArray(document.rotaryLanes)) {
    add(
      result,
      'error',
      'document.invalid-lanes',
      '/rotaryLanes',
      'document',
      document.documentId ?? null,
      'Expected a rotaryLanes array'
    );
  }
  if (!isRecord(document.context)) {
    add(
      result,
      'error',
      'document.invalid-context',
      '/context',
      'document',
      document.documentId ?? null,
      'Expected a context object'
    );
  }

  if (Array.isArray(document.vehicles)) {
    document.vehicles.forEach((vehicle, index) => {
      validateVehicleShape(vehicle, index, result);
    });
  }
  if (Array.isArray(document.rotaryLanes)) {
    document.rotaryLanes.forEach((lane, index) => {
      validateLaneShape(lane, index, result);
    });
  }
  validateContextShape(document.context, result);
}

function slotKey(laneId, slotId) {
  return `${String(laneId)}\u0000${String(slotId)}`;
}

function buildDocumentIndex(document, result) {
  const index = {
    vehicles: new Map(),
    lanes: new Map(),
    slots: new Map(),
    garages: new Map(),
    occupants: new Map()
  };

  document.vehicles.forEach((vehicle, vehicleIndex) => {
    if (!isRecord(vehicle) || !Number.isFinite(vehicle.id)) return;
    if (index.vehicles.has(vehicle.id)) {
      add(
        result,
        'error',
        'vehicle.duplicate-id',
        `/vehicles/${vehicleIndex}/id`,
        'vehicle',
        vehicle.id,
        `Vehicle ID ${vehicle.id} is duplicated`
      );
    } else {
      index.vehicles.set(vehicle.id, { vehicle, vehicleIndex });
    }
  });

  document.rotaryLanes.forEach((lane, laneIndex) => {
    if (!isRecord(lane)) return;
    if (typeof lane.id === 'string' && lane.id) {
      if (index.lanes.has(lane.id)) {
        add(
          result,
          'error',
          'lane.duplicate-id',
          `/rotaryLanes/${laneIndex}/id`,
          'lane',
          lane.id,
          `Lane ID ${lane.id} is duplicated`
        );
      } else {
        index.lanes.set(lane.id, { lane, laneIndex });
      }
    }
    const slots = Array.isArray(lane.slots) ? lane.slots : [];
    slots.forEach((slot, slotIndex) => {
      if (!isRecord(slot) || typeof slot.id !== 'string' || !slot.id) return;
      const key = slotKey(lane.id, slot.id);
      if (index.slots.has(key)) {
        add(
          result,
          'error',
          'slot.duplicate-id',
          `/rotaryLanes/${laneIndex}/slots/${slotIndex}/id`,
          'slot',
          slot.id,
          `Slot ID ${slot.id} is duplicated in lane ${lane.id}`
        );
      } else {
        index.slots.set(key, { lane, laneIndex, slot, slotIndex });
      }
    });
  });

  document.context.garages.forEach((garage, garageIndex) => {
    if (!isRecord(garage) || !Number.isFinite(garage.id)) return;
    if (index.garages.has(garage.id)) {
      add(
        result,
        'error',
        'garage.duplicate-id',
        `/context/garages/${garageIndex}/id`,
        'garage',
        garage.id,
        `Garage ID ${garage.id} is duplicated`
      );
    } else {
      index.garages.set(garage.id, { garage, garageIndex });
    }
  });

  document.vehicles.forEach((vehicle, vehicleIndex) => {
    const placement = isRecord(vehicle) ? vehicle.placement : null;
    if (!isRecord(placement) || placement.kind !== 'rotary-slot') return;
    const key = slotKey(placement.laneId, placement.slotId);
    if (index.occupants.has(key)) {
      add(
        result,
        'error',
        'slot.multiple-occupants',
        `/vehicles/${vehicleIndex}/placement`,
        'vehicle',
        vehicle.id ?? null,
        `Slot ${placement.laneId}/${placement.slotId} has multiple vehicles`
      );
    } else {
      index.occupants.set(key, { vehicle, vehicleIndex });
    }
  });

  return index;
}

function validateVehicles(document, index, result) {
  const allowedColors = new Set(
    Array.isArray(document.context.allowedColorIndexes)
      ? document.context.allowedColorIndexes
      : []
  );
  document.vehicles.forEach((vehicle, vehicleIndex) => {
    if (!isRecord(vehicle)) return;
    const path = `/vehicles/${vehicleIndex}`;
    if (!Number.isInteger(vehicle.colorIndex)
      || !allowedColors.has(vehicle.colorIndex)) {
      add(
        result,
        'error',
        'vehicle.color-not-allowed',
        `${path}/colorIndex`,
        'vehicle',
        vehicle.id ?? null,
        `Color index ${vehicle.colorIndex} is not allowed`
      );
    }
    if (!SEAT_COUNTS.has(vehicle.seats)
      || !isRecord(document.context.vehicleFootprints?.[vehicle.seats])) {
      add(
        result,
        'error',
        'vehicle.unsupported-seats',
        `${path}/seats`,
        'vehicle',
        vehicle.id ?? null,
        `Seat count ${vehicle.seats} has no supported footprint`
      );
    }

    const placement = vehicle.placement;
    if (!isRecord(placement)) return;
    if (placement.kind === 'rotary-slot') {
      if (!index.lanes.has(placement.laneId)) {
        add(
          result,
          'error',
          'vehicle.unknown-lane',
          `${path}/placement/laneId`,
          'vehicle',
          vehicle.id ?? null,
          `Unknown lane: ${placement.laneId}`
        );
      } else if (!index.slots.has(slotKey(placement.laneId, placement.slotId))) {
        add(
          result,
          'error',
          'vehicle.unknown-slot',
          `${path}/placement/slotId`,
          'vehicle',
          vehicle.id ?? null,
          `Unknown slot: ${placement.laneId}/${placement.slotId}`
        );
      }
    } else if (placement.kind === 'garage') {
      if (!index.garages.has(placement.garageId)) {
        add(
          result,
          'error',
          'vehicle.unknown-garage',
          `${path}/placement/garageId`,
          'vehicle',
          vehicle.id ?? null,
          `Unknown garage: ${placement.garageId}`
        );
      }
      if (!Number.isInteger(placement.stockOrder) || placement.stockOrder < 0) {
        add(
          result,
          'error',
          'garage.invalid-stock-order',
          `${path}/placement/stockOrder`,
          'vehicle',
          vehicle.id ?? null,
          'Garage stock order must be a non-negative integer'
        );
      }
    }
  });
}

function pointIsFinite(point) {
  return isRecord(point)
    && Number.isFinite(point.x)
    && Number.isFinite(point.z);
}

function validateLanes(document, index, result) {
  document.rotaryLanes.forEach((lane, laneIndex) => {
    if (!isRecord(lane) || !Array.isArray(lane.slots)) return;
    const slots = lane.slots;
    if (slots.length < 3) {
      add(
        result,
        'error',
        'lane.too-few-slots',
        `/rotaryLanes/${laneIndex}/slots`,
        'lane',
        lane.id ?? null,
        'A closed lane requires at least three slots'
      );
      return;
    }

    for (let edgeIndex = 0; edgeIndex < slots.length; edgeIndex += 1) {
      const from = slots[edgeIndex];
      const to = slots[(edgeIndex + 1) % slots.length];
      if (!pointIsFinite(from) || !pointIsFinite(to)) continue;
      if (Math.hypot(to.x - from.x, to.z - from.z) <= EPSILON) {
        add(
          result,
          'error',
          'lane.zero-length-edge',
          `/rotaryLanes/${laneIndex}/slots/${edgeIndex}`,
          'lane',
          lane.id ?? null,
          `Lane edge ${edgeIndex} has zero length`
        );
      }
    }

    let selfIntersectionReported = false;
    for (let first = 0; first < slots.length && !selfIntersectionReported; first += 1) {
      const firstNext = (first + 1) % slots.length;
      if (!pointIsFinite(slots[first]) || !pointIsFinite(slots[firstNext])) {
        continue;
      }
      for (let second = first + 1; second < slots.length; second += 1) {
        const secondNext = (second + 1) % slots.length;
        const adjacent = first === second
          || firstNext === second
          || secondNext === first;
        if (adjacent
          || !pointIsFinite(slots[second])
          || !pointIsFinite(slots[secondNext])) {
          continue;
        }
        if (segmentsIntersect(
          slots[first],
          slots[firstNext],
          slots[second],
          slots[secondNext]
        )) {
          add(
            result,
            'error',
            'lane.self-intersection',
            `/rotaryLanes/${laneIndex}/slots/${second}`,
            'lane',
            lane.id ?? null,
            `Lane edges ${first} and ${second} intersect`
          );
          selfIntersectionReported = true;
          break;
        }
      }
    }
  });

  const slotEntries = [];
  for (const [key, entry] of index.slots) {
    if (!pointIsFinite(entry.slot) || !Number.isFinite(entry.slot.yaw)) continue;
    const occupant = index.occupants.get(key)?.vehicle;
    const footprint = document.context.vehicleFootprints?.[occupant?.seats]
      ?? largestFootprint(document.context.vehicleFootprints);
    if (!validFootprint(footprint)) continue;
    slotEntries.push({
      ...entry,
      key,
      obb: poseToObb({ ...entry.slot, ...footprint })
    });
  }
  for (let first = 0; first < slotEntries.length; first += 1) {
    for (let second = first + 1; second < slotEntries.length; second += 1) {
      if (!obbOverlaps(slotEntries[first].obb, slotEntries[second].obb)) continue;
      const entry = slotEntries[second];
      add(
        result,
        'error',
        'geometry.slot-overlap',
        `/rotaryLanes/${entry.laneIndex}/slots/${entry.slotIndex}`,
        'slot',
        entry.slot.id,
        'Vehicle occupancy areas for two slots overlap'
      );
    }
  }
}

function validateGarageOrders(document, index, result) {
  const byGarage = new Map();
  document.vehicles.forEach((vehicle, vehicleIndex) => {
    const placement = isRecord(vehicle) ? vehicle.placement : null;
    if (!isRecord(placement) || placement.kind !== 'garage') return;
    const entries = byGarage.get(placement.garageId) ?? [];
    entries.push({ vehicle, vehicleIndex, order: placement.stockOrder });
    byGarage.set(placement.garageId, entries);
  });

  for (const [garageId, entries] of byGarage) {
    const sorted = [...entries].sort((a, b) => a.order - b.order);
    const seen = new Set();
    sorted.forEach((entry, expectedOrder) => {
      if (seen.has(entry.order)) {
        add(
          result,
          'error',
          'garage.duplicate-stock-order',
          `/vehicles/${entry.vehicleIndex}/placement/stockOrder`,
          'vehicle',
          entry.vehicle.id ?? null,
          `Garage ${garageId} repeats stock order ${entry.order}`
        );
      }
      seen.add(entry.order);
      if (Number.isInteger(entry.order) && entry.order !== expectedOrder) {
        add(
          result,
          'error',
          'garage.non-contiguous-stock-order',
          `/vehicles/${entry.vehicleIndex}/placement/stockOrder`,
          'vehicle',
          entry.vehicle.id ?? null,
          `Garage ${garageId} stock order must be contiguous from zero`
        );
      }
    });
  }
}

function validFootprint(footprint) {
  return isRecord(footprint)
    && Number.isFinite(footprint.width)
    && footprint.width > 0
    && Number.isFinite(footprint.length)
    && footprint.length > 0;
}

function largestFootprint(footprints) {
  if (!isRecord(footprints)) return null;
  return Object.values(footprints)
    .filter(validFootprint)
    .sort((a, b) => b.width * b.length - a.width * a.length)[0] ?? null;
}

function getVehicleGeometry(document, index) {
  const entries = [];
  document.vehicles.forEach((vehicle, vehicleIndex) => {
    if (!isRecord(vehicle) || !isRecord(vehicle.placement)) return;
    const footprint = document.context.vehicleFootprints?.[vehicle.seats];
    if (!validFootprint(footprint)) return;
    let pose = null;
    let ownerSlotKey = null;
    if (vehicle.placement.kind === 'field') {
      pose = vehicle.placement;
    } else if (vehicle.placement.kind === 'rotary-slot') {
      ownerSlotKey = slotKey(
        vehicle.placement.laneId,
        vehicle.placement.slotId
      );
      pose = index.slots.get(ownerSlotKey)?.slot ?? null;
    }
    if (!pointIsFinite(pose) || !Number.isFinite(pose.yaw)) return;
    entries.push({
      vehicle,
      vehicleIndex,
      pose,
      footprint,
      ownerSlotKey,
      obb: poseToObb({ ...pose, ...footprint })
    });
  });
  return entries;
}

function getProtectedContextGeometry(document) {
  const entries = [];
  document.context.garages.forEach((garage, garageIndex) => {
    if (!isRecord(garage)
      || !pointIsFinite(garage)
      || !Number.isFinite(garage.yaw)
      || !validFootprint(garage)) return;
    entries.push({
      objectType: 'garage',
      objectId: garage.id ?? null,
      path: `/context/garages/${garageIndex}`,
      obb: poseToObb(garage)
    });
  });
  for (const collection of ['parkingSpots', 'conveyors', 'protectedGeometry']) {
    const values = Array.isArray(document.context[collection])
      ? document.context[collection]
      : [];
    values.forEach((value, valueIndex) => {
      if (!isRecord(value)
        || value.protected !== true
        || !pointIsFinite(value)
        || !Number.isFinite(value.yaw)
        || !validFootprint(value)) return;
      entries.push({
        objectType: value.kind ?? collection,
        objectId: value.id ?? null,
        path: `/context/${collection}/${valueIndex}`,
        obb: poseToObb(value)
      });
    });
  }
  return entries;
}

function validateOccupiedGeometry(document, index, result) {
  const vehicles = getVehicleGeometry(document, index);
  for (let first = 0; first < vehicles.length; first += 1) {
    for (let second = first + 1; second < vehicles.length; second += 1) {
      if (!obbOverlaps(vehicles[first].obb, vehicles[second].obb)) continue;
      add(
        result,
        'error',
        'geometry.vehicle-overlap',
        `/vehicles/${vehicles[second].vehicleIndex}/placement`,
        'vehicle',
        vehicles[second].vehicle.id ?? null,
        `Vehicle overlaps vehicle ${vehicles[first].vehicle.id}`
      );
    }
  }
}

function forEachRoadSegment(document, callback) {
  const width = document.context.rotaryRoadWidth;
  if (!Number.isFinite(width) || width <= 0) return;
  document.rotaryLanes.forEach((lane, laneIndex) => {
    if (!isRecord(lane) || !Array.isArray(lane.slots) || lane.slots.length < 2) {
      return;
    }
    for (let segmentIndex = 0; segmentIndex < lane.slots.length; segmentIndex += 1) {
      const from = lane.slots[segmentIndex];
      const to = lane.slots[(segmentIndex + 1) % lane.slots.length];
      if (!pointIsFinite(from) || !pointIsFinite(to)) continue;
      const roadObb = segmentRoadObb(from, to, width);
      if (!roadObb) continue;
      callback({ lane, laneIndex, segmentIndex, from, to, width, roadObb });
    }
  });
}

function validateRoadGeometry(document, index, result) {
  const vehicles = getVehicleGeometry(document, index);
  const protectedEntries = getProtectedContextGeometry(document);
  forEachRoadSegment(document, (segment) => {
    const endpointKeys = new Set([
      slotKey(segment.lane.id, segment.from.id),
      slotKey(segment.lane.id, segment.to.id)
    ]);
    for (const vehicle of vehicles) {
      if (vehicle.ownerSlotKey && endpointKeys.has(vehicle.ownerSlotKey)) continue;
      if (!obbOverlaps(segment.roadObb, vehicle.obb)) continue;
      add(
        result,
        'error',
        'geometry.road-vehicle-overlap',
        `/rotaryLanes/${segment.laneIndex}/slots/${segment.segmentIndex}`,
        'lane',
        segment.lane.id ?? null,
        `Road overlaps vehicle ${vehicle.vehicle.id}`
      );
    }
    for (const contextEntry of protectedEntries) {
      if (!obbOverlaps(segment.roadObb, contextEntry.obb)) continue;
      add(
        result,
        'error',
        'geometry.road-context-overlap',
        `/rotaryLanes/${segment.laneIndex}/slots/${segment.segmentIndex}`,
        'lane',
        segment.lane.id ?? null,
        `Road overlaps protected ${contextEntry.objectType} ${contextEntry.objectId}`
      );
    }
  });
}

function addDesignWarnings(document, index, result) {
  for (const [laneId, { lane, laneIndex }] of index.lanes) {
    const slots = Array.isArray(lane.slots) ? lane.slots : [];
    if (slots.length > 0 && slots.every((slot) => (
      index.occupants.has(slotKey(laneId, slot.id))
    ))) {
      add(
        result,
        'warning',
        'lane.no-empty-slot',
        `/rotaryLanes/${laneIndex}/slots`,
        'lane',
        laneId,
        'Lane has no empty slot at startup'
      );
    }
  }

  for (const [garageId, { garageIndex }] of index.garages) {
    const occupied = document.vehicles.some((vehicle) => (
      isRecord(vehicle)
      && isRecord(vehicle.placement)
      && vehicle.placement.kind === 'garage'
      && vehicle.placement.garageId === garageId
    ));
    if (!occupied) {
      add(
        result,
        'warning',
        'garage.empty',
        `/context/garages/${garageIndex}`,
        'garage',
        garageId,
        'Garage has no vehicles'
      );
    }
  }

  const fieldVehicles = document.vehicles.filter((vehicle) => (
    isRecord(vehicle)
    && isRecord(vehicle.placement)
    && vehicle.placement.kind === 'field'
  ));
  if (fieldVehicles.length === 0) {
    add(
      result,
      'warning',
      'design.no-field-vehicle',
      '/vehicles',
      'document',
      document.documentId,
      'Level has no ordinary field vehicles'
    );
  }
  if (fieldVehicles.length < 2) {
    add(
      result,
      'warning',
      'design.low-initial-movable-count',
      '/vehicles',
      'document',
      document.documentId,
      'Static approximation finds fewer than two initially movable vehicles'
    );
  }

  const vehicles = getVehicleGeometry(document, index);
  const clearanceMargin = Math.max(0.05, document.context.rotaryRoadWidth * 0.15);
  const tightPairs = new Set();
  forEachRoadSegment(document, (segment) => {
    const expandedRoad = segmentRoadObb(
      segment.from,
      segment.to,
      segment.width + clearanceMargin * 2
    );
    const endpointKeys = new Set([
      slotKey(segment.lane.id, segment.from.id),
      slotKey(segment.lane.id, segment.to.id)
    ]);
    for (const vehicle of vehicles) {
      if (vehicle.ownerSlotKey && endpointKeys.has(vehicle.ownerSlotKey)) continue;
      if (obbOverlaps(segment.roadObb, vehicle.obb)
        || !obbOverlaps(expandedRoad, vehicle.obb)) continue;
      const key = `${segment.lane.id}\u0000${vehicle.vehicle.id}`;
      if (tightPairs.has(key)) continue;
      tightPairs.add(key);
      add(
        result,
        'warning',
        'geometry.tight-clearance',
        `/vehicles/${vehicle.vehicleIndex}/placement`,
        'vehicle',
        vehicle.vehicle.id ?? null,
        `Vehicle has tight clearance from lane ${segment.lane.id}`
      );
    }
  });

  const laneVehicles = vehicles.filter(({ ownerSlotKey }) => ownerSlotKey);
  for (const fieldEntry of vehicles.filter(({ vehicle }) => (
    vehicle.placement.kind === 'field'
  ))) {
    const radians = fieldEntry.pose.yaw * Math.PI / 180;
    const forward = { x: Math.sin(radians), z: Math.cos(radians) };
    const right = { x: Math.cos(radians), z: -Math.sin(radians) };
    const mayMeetLaneVehicle = laneVehicles.some((laneEntry) => {
      const dx = laneEntry.pose.x - fieldEntry.pose.x;
      const dz = laneEntry.pose.z - fieldEntry.pose.z;
      const forwardDistance = dx * forward.x + dz * forward.z;
      const lateralDistance = Math.abs(dx * right.x + dz * right.z);
      return forwardDistance > 0
        && forwardDistance < 3
        && lateralDistance
          < (fieldEntry.footprint.width + laneEntry.footprint.width) / 2
            + clearanceMargin;
    });
    if (mayMeetLaneVehicle) {
      add(
        result,
        'warning',
        'design.field-forward-ray-meets-lane-vehicle',
        `/vehicles/${fieldEntry.vehicleIndex}/placement`,
        'vehicle',
        fieldEntry.vehicle.id ?? null,
        'Initial forward ray may meet a rotary-lane vehicle'
      );
    }
  }
}

export function validateLevelDocument(document) {
  const result = { errors: [], warnings: [] };
  try {
    validateTopLevel(document, result);
    if (result.errors.some(({ code }) => code.startsWith('document.'))) {
      return result;
    }
    const index = buildDocumentIndex(document, result);
    validateVehicles(document, index, result);
    validateLanes(document, index, result);
    validateGarageOrders(document, index, result);
    validateOccupiedGeometry(document, index, result);
    validateRoadGeometry(document, index, result);
    addDesignWarnings(document, index, result);
  } catch (error) {
    add(
      result,
      'error',
      'document.validation-failed',
      '',
      'document',
      isRecord(document) ? document.documentId ?? null : null,
      `Validation could not continue: ${error.message}`
    );
  }
  return result;
}
