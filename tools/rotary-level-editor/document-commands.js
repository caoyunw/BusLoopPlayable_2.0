import { normalizeYaw } from '../rotary-level-contract/document.js';

function clone(value) {
  return structuredClone(value);
}

function smallestUnusedPositive(values) {
  const used = new Set(values);
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

function nextPrefixedId(values, prefix) {
  const used = new Set(values);
  let suffix = 1;
  while (used.has(`${prefix}-${suffix}`)) suffix += 1;
  return `${prefix}-${suffix}`;
}

function findLane(document, laneId) {
  return document.rotaryLanes.find(({ id }) => id === laneId);
}

function findSlot(document, laneId, slotId) {
  return findLane(document, laneId)?.slots.find(({ id }) => id === slotId);
}

function visiblePose(document, vehicle) {
  if (vehicle.placement.kind === 'field') return vehicle.placement;
  if (vehicle.placement.kind === 'garage') return vehicle.placement.storedPose;
  if (vehicle.placement.kind === 'rotary-slot') {
    return findSlot(
      document,
      vehicle.placement.laneId,
      vehicle.placement.slotId
    );
  }
  return null;
}

function compactGarageOrders(document, garageId, excludedVehicleId = null) {
  document.vehicles
    .filter(({ id, placement }) => (
      id !== excludedVehicleId
      && placement.kind === 'garage'
      && placement.garageId === garageId
    ))
    .sort((a, b) => a.placement.stockOrder - b.placement.stockOrder)
    .forEach((vehicle, stockOrder) => {
      vehicle.placement.stockOrder = stockOrder;
    });
}

export function createNewFromTemplate(template, documentId) {
  return {
    format: template.format,
    documentId,
    target: clone(template.target),
    coordinates: clone(template.coordinates),
    vehicles: [],
    rotaryLanes: [],
    context: clone(template.context)
  };
}

export function nextVehicleId(document) {
  return smallestUnusedPositive(document.vehicles.map(({ id }) => id));
}

export function nextLaneId(document) {
  return nextPrefixedId(document.rotaryLanes.map(({ id }) => id), 'lane');
}

export function nextSlotId(source) {
  const lanes = Array.isArray(source.rotaryLanes)
    ? source.rotaryLanes
    : [source];
  return nextPrefixedId(
    lanes.flatMap((lane) => lane?.slots?.map(({ id }) => id) ?? []),
    'slot'
  );
}

export function addVehicle(source, values = {}) {
  const document = clone(source);
  const {
    id = nextVehicleId(document),
    colorIndex = document.context?.allowedColorIndexes?.[0] ?? 0,
    seats = 4,
    x = 0,
    z = 0,
    yaw = 0
  } = values;
  document.vehicles.push({
    id,
    colorIndex,
    seats,
    placement: { kind: 'field', x, z, yaw: normalizeYaw(yaw) }
  });
  return document;
}

export function duplicateVehicle(source, vehicleId, gridStep = 0.25) {
  const document = clone(source);
  const vehicle = document.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`);
  const pose = visiblePose(document, vehicle);
  if (!pose) throw new Error(`Vehicle ${vehicleId} has no visible pose`);
  document.vehicles.push({
    id: nextVehicleId(document),
    colorIndex: vehicle.colorIndex,
    seats: vehicle.seats,
    placement: {
      kind: 'field',
      x: pose.x + gridStep,
      z: pose.z + gridStep,
      yaw: normalizeYaw(pose.yaw)
    }
  });
  return document;
}

export function updateVehicle(source, vehicleId, changes) {
  if (Object.hasOwn(changes, 'placement')) {
    throw new Error('Use assignVehicle to change vehicle ownership');
  }
  const document = clone(source);
  const vehicle = document.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`);
  Object.assign(vehicle, clone(changes));
  return document;
}

function selectionSlotKey(selection, vehicle) {
  if (selection.type === 'slot') {
    return {
      laneId: selection.laneId,
      slotId: selection.slotId ?? selection.id
    };
  }
  if (vehicle?.placement.kind === 'rotary-slot') {
    return {
      laneId: vehicle.placement.laneId,
      slotId: vehicle.placement.slotId
    };
  }
  return null;
}

function selectedTargets(document, selection) {
  const fieldVehicleIds = new Set();
  const slots = new Map();
  for (const selected of selection) {
    if (selected.type === 'vehicle') {
      const vehicle = document.vehicles.find(({ id }) => id === selected.id);
      if (!vehicle) continue;
      if (vehicle.placement.kind === 'field') fieldVehicleIds.add(vehicle.id);
      const slot = selectionSlotKey(selected, vehicle);
      if (slot) slots.set(`${slot.laneId}\u0000${slot.slotId}`, slot);
    } else if (selected.type === 'slot') {
      const slot = selectionSlotKey(selected);
      slots.set(`${slot.laneId}\u0000${slot.slotId}`, slot);
    } else if (selected.type === 'lane') {
      const lane = findLane(document, selected.id);
      lane?.slots.forEach(({ id }) => {
        slots.set(`${lane.id}\u0000${id}`, { laneId: lane.id, slotId: id });
      });
    }
  }
  return { fieldVehicleIds, slots: [...slots.values()] };
}

export function moveSelection(source, selection, deltaX, deltaZ) {
  const document = clone(source);
  const targets = selectedTargets(document, selection);
  for (const vehicle of document.vehicles) {
    if (targets.fieldVehicleIds.has(vehicle.id)) {
      vehicle.placement.x += deltaX;
      vehicle.placement.z += deltaZ;
    }
  }
  for (const { laneId, slotId } of targets.slots) {
    const slot = findSlot(document, laneId, slotId);
    if (!slot) continue;
    slot.x += deltaX;
    slot.z += deltaZ;
  }
  return document;
}

export function rotateSelection(source, selection, deltaYaw) {
  const document = clone(source);
  const targets = selectedTargets(document, selection);
  for (const vehicle of document.vehicles) {
    if (targets.fieldVehicleIds.has(vehicle.id)) {
      vehicle.placement.yaw = normalizeYaw(vehicle.placement.yaw + deltaYaw);
    }
  }
  for (const { laneId, slotId } of targets.slots) {
    const slot = findSlot(document, laneId, slotId);
    if (!slot) continue;
    slot.yaw = normalizeYaw(slot.yaw + deltaYaw);
  }
  return document;
}

export function assignVehicle(source, vehicleId, placement) {
  const document = clone(source);
  const vehicle = document.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`);
  const previous = vehicle.placement;
  if (placement.kind === 'rotary-slot') {
    const occupied = document.vehicles.some((candidate) => (
      candidate.id !== vehicleId
      && candidate.placement.kind === 'rotary-slot'
      && candidate.placement.laneId === placement.laneId
      && candidate.placement.slotId === placement.slotId
    ));
    if (occupied) {
      throw new Error(`Occupied slot ${placement.laneId}/${placement.slotId}`);
    }
  }
  if (previous.kind === 'garage') {
    compactGarageOrders(document, previous.garageId, vehicleId);
  }
  if (placement.kind === 'garage') {
    const peers = document.vehicles
      .filter((candidate) => (
        candidate.id !== vehicleId
        && candidate.placement.kind === 'garage'
        && candidate.placement.garageId === placement.garageId
      ))
      .sort((a, b) => a.placement.stockOrder - b.placement.stockOrder);
    const stockOrder = Math.max(
      0,
      Math.min(Number(placement.stockOrder) || 0, peers.length)
    );
    peers.splice(stockOrder, 0, vehicle);
    vehicle.placement = { ...clone(placement), stockOrder };
    peers.forEach((candidate, index) => {
      candidate.placement.stockOrder = index;
    });
  } else {
    vehicle.placement = clone(placement);
  }
  return document;
}

export function deleteVehicle(source, vehicleId) {
  const document = clone(source);
  const vehicle = document.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) return document;
  document.vehicles = document.vehicles.filter(({ id }) => id !== vehicleId);
  if (vehicle.placement.kind === 'garage') {
    compactGarageOrders(document, vehicle.placement.garageId);
  }
  return document;
}

export function addLane(source, values = {}) {
  const document = clone(source);
  document.rotaryLanes.push({
    id: values.id ?? nextLaneId(document),
    slots: clone(values.slots ?? [])
  });
  return document;
}

export function addLaneSlot(source, laneId, values = {}) {
  const document = clone(source);
  const lane = findLane(document, laneId);
  if (!lane) throw new Error(`Unknown lane ${laneId}`);
  lane.slots.push({
    id: values.id ?? nextSlotId(document),
    x: values.x ?? 0,
    z: values.z ?? 0,
    yaw: normalizeYaw(values.yaw ?? 0)
  });
  return document;
}

export function deleteLaneSlot(source, laneId, slotId) {
  const document = clone(source);
  const lane = findLane(document, laneId);
  if (!lane) return document;
  const slot = lane.slots.find(({ id }) => id === slotId);
  if (!slot) return document;
  for (const vehicle of document.vehicles) {
    if (vehicle.placement.kind === 'rotary-slot'
      && vehicle.placement.laneId === laneId
      && vehicle.placement.slotId === slotId) {
      vehicle.placement = {
        kind: 'field',
        x: slot.x,
        z: slot.z,
        yaw: slot.yaw
      };
    }
  }
  lane.slots = lane.slots.filter(({ id }) => id !== slotId);
  return document;
}

export function deleteLane(source, laneId) {
  const document = clone(source);
  const lane = findLane(document, laneId);
  if (!lane) return document;
  const slots = new Map(lane.slots.map((slot) => [slot.id, slot]));
  for (const vehicle of document.vehicles) {
    if (vehicle.placement.kind !== 'rotary-slot'
      || vehicle.placement.laneId !== laneId) continue;
    const slot = slots.get(vehicle.placement.slotId);
    if (!slot) continue;
    vehicle.placement = {
      kind: 'field',
      x: slot.x,
      z: slot.z,
      yaw: slot.yaw
    };
  }
  document.rotaryLanes = document.rotaryLanes.filter(({ id }) => id !== laneId);
  return document;
}
