const DEFAULT_WALL_THICKNESS = 0.18;
const DEFAULT_TUNNEL_DEPTH = 0.36;
const DEFAULT_ALIGNMENT_TOLERANCE_DEGREES = 12;
const EPSILON = 1e-6;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const cleanNumber = (value) => Math.abs(value) <= EPSILON ? 0 : value;

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeEndpoint(value, distanceKey) {
  if (!value || typeof value !== 'object') return null;
  const x = finiteNumber(value.x);
  const z = finiteNumber(value.z);
  const yaw = finiteNumber(value.yaw);
  const width = finiteNumber(value.width);
  const distance = finiteNumber(value[distanceKey]);
  if (
    x == null
    || z == null
    || yaw == null
    || width == null
    || width <= 0
    || distance == null
    || distance <= 0
  ) return null;
  return { x, z, yaw, width, [distanceKey]: distance };
}

export function normalizeTransportTunnelPairs(value = {}) {
  const pairs = [];
  const usedIds = new Set();
  let invalidPairCount = 0;
  const source = Array.isArray(value?.pairs) ? value.pairs : [];

  for (let index = 0; index < source.length; index += 1) {
    const candidate = source[index];
    const id = String(candidate?.id ?? '').trim();
    const entrance = normalizeEndpoint(candidate?.entrance, 'approachDistance');
    const exit = normalizeEndpoint(candidate?.exit, 'spawnDistance');
    if (!id || usedIds.has(id) || !entrance || !exit) {
      invalidPairCount += 1;
      continue;
    }
    usedIds.add(id);
    pairs.push({
      id,
      label: String(candidate.label ?? index + 1),
      color: typeof candidate.color === 'string' && candidate.color.trim()
        ? candidate.color.trim()
        : '#9a67ff',
      entrance,
      exit
    });
  }

  return { pairs, invalidPairCount };
}

function forwardFromYaw(yaw) {
  const radians = yaw * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

function rightFromForward(forward) {
  return { x: forward.z, z: -forward.x };
}

function dot(left, right) {
  return left.x * right.x + left.z * right.z;
}

function rayOrientedRectDistance({
  origin,
  direction,
  center,
  right,
  forward,
  halfWidth,
  halfDepth,
  maximumDistance
}) {
  const relative = { x: origin.x - center.x, z: origin.z - center.z };
  const localOrigin = { x: dot(relative, right), z: dot(relative, forward) };
  const localDirection = { x: dot(direction, right), z: dot(direction, forward) };
  let minimum = 0;
  let maximum = maximumDistance;
  for (const [position, velocity, extent] of [
    [localOrigin.x, localDirection.x, halfWidth],
    [localOrigin.z, localDirection.z, halfDepth]
  ]) {
    if (Math.abs(velocity) <= EPSILON) {
      if (Math.abs(position) > extent) return null;
      continue;
    }
    const first = (-extent - position) / velocity;
    const second = (extent - position) / velocity;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return null;
  }
  return minimum <= maximumDistance ? minimum : null;
}

export function classifyTransportTunnelApproach(
  vehicle,
  pair,
  dimensions,
  {
    wallThickness = DEFAULT_WALL_THICKNESS,
    tunnelDepth = DEFAULT_TUNNEL_DEPTH,
    alignmentToleranceDegrees = DEFAULT_ALIGNMENT_TOLERANCE_DEGREES
  } = {}
) {
  if (!vehicle || !pair?.entrance) return null;
  const vehicleForward = forwardFromYaw(vehicle.yaw);
  const entranceForward = forwardFromYaw(pair.entrance.yaw);
  const entranceRight = rightFromForward(entranceForward);
  const delta = {
    x: pair.entrance.x - vehicle.x,
    z: pair.entrance.z - vehicle.z
  };
  const denominator = dot(vehicleForward, entranceForward);
  const planeDistance = denominator > EPSILON ? dot(delta, entranceForward) / denominator : null;
  const halfVehicleWidth = Math.max(0, Number(dimensions?.width) || 0) / 2;
  const halfVehicleLength = Math.max(0, Number(dimensions?.length) || 0) / 2;
  const apertureHalfWidth = pair.entrance.width / 2;
  const maximumDistance = pair.entrance.approachDistance;
  let planeLateral = null;
  if (planeDistance != null && planeDistance >= 0 && planeDistance <= maximumDistance) {
    const hit = {
      x: vehicle.x + vehicleForward.x * planeDistance,
      z: vehicle.z + vehicleForward.z * planeDistance
    };
    planeLateral = dot({
      x: hit.x - pair.entrance.x,
      z: hit.z - pair.entrance.z
    }, entranceRight);
    const angle = Math.acos(clamp(denominator, -1, 1)) * 180 / Math.PI;
    const fitsAperture = Math.abs(planeLateral) + halfVehicleWidth <= apertureHalfWidth;
    if (angle <= alignmentToleranceDegrees && fitsAperture) {
      return { type: 'passage', pairId: pair.id, distance: planeDistance };
    }
  }

  const expandedHalfWidth = wallThickness / 2 + halfVehicleWidth;
  const expandedHalfDepth = tunnelDepth / 2 + halfVehicleLength;
  const wallHits = [-1, 1].map((side) => {
    const centerOffset = side * (apertureHalfWidth + wallThickness / 2);
    const center = {
      x: pair.entrance.x + entranceRight.x * centerOffset,
      z: pair.entrance.z + entranceRight.z * centerOffset
    };
    return {
      side,
      distance: rayOrientedRectDistance({
        origin: vehicle,
        direction: vehicleForward,
        center,
        right: entranceRight,
        forward: entranceForward,
        halfWidth: expandedHalfWidth,
        halfDepth: expandedHalfDepth,
        maximumDistance
      })
    };
  }).filter(({ distance }) => distance != null);

  const crossesPortal = planeLateral != null
    && Math.abs(planeLateral) - halfVehicleWidth <= apertureHalfWidth + wallThickness;
  if (!crossesPortal && wallHits.length === 0) return null;
  wallHits.sort((left, right) => left.distance - right.distance);
  const side = wallHits[0]?.side ?? Math.sign(planeLateral || 1);
  return {
    type: 'wall',
    pairId: pair.id,
    wallSide: side < 0 ? 'left' : 'right',
    distance: wallHits[0]?.distance ?? planeDistance
  };
}

export function getTransportTunnelExitPose(pair) {
  const forward = forwardFromYaw(pair.exit.yaw);
  return {
    x: cleanNumber(pair.exit.x + forward.x * pair.exit.spawnDistance),
    z: cleanNumber(pair.exit.z + forward.z * pair.exit.spawnDistance),
    yaw: pair.exit.yaw
  };
}

export const TRANSPORT_TUNNEL_GEOMETRY = Object.freeze({
  wallThickness: DEFAULT_WALL_THICKNESS,
  tunnelDepth: DEFAULT_TUNNEL_DEPTH,
  alignmentToleranceDegrees: DEFAULT_ALIGNMENT_TOLERANCE_DEGREES
});
