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
