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

const FIELD_BLOCKING_STATES = new Set(['parked', 'colliding']);
const TRANSFER_STATES = new Set([
  'entering-tunnel',
  'hidden-in-tunnel',
  'exiting-tunnel'
]);

function getVehicleDimensions(level) {
  const scale = Math.max(EPSILON, Number(level?.mapScale) || 1);
  return {
    width: Math.max(0, Number(level?.vehicleSize?.width) || 0) / scale,
    length: Math.max(0, Number(level?.vehicleSize?.length) || 0) / scale
  };
}

function makeBox(pose, dimensions) {
  const forward = forwardFromYaw(pose.yaw);
  const right = rightFromForward(forward);
  return {
    center: { x: pose.x, z: pose.z },
    forward,
    right,
    halfLength: dimensions.length / 2,
    halfWidth: dimensions.width / 2
  };
}

function projectedRadius(box, axis) {
  return Math.abs(dot(box.forward, axis)) * box.halfLength
    + Math.abs(dot(box.right, axis)) * box.halfWidth;
}

function boxesOverlap(left, right) {
  const delta = {
    x: right.center.x - left.center.x,
    z: right.center.z - left.center.z
  };
  return [left.forward, left.right, right.forward, right.right].every((axis) => (
    Math.abs(dot(delta, axis)) <= projectedRadius(left, axis) + projectedRadius(right, axis)
  ));
}

export function isTransportTunnelExitOccupied(game, pair, movingVehicle = null) {
  const dimensions = getVehicleDimensions(game.level);
  const exitBox = makeBox(getTransportTunnelExitPose(pair), dimensions);
  return game.vehicles.some((candidate) => (
    candidate.id !== movingVehicle?.id
    && FIELD_BLOCKING_STATES.has(candidate.state)
    && boxesOverlap(exitBox, makeBox(candidate, dimensions))
  ));
}

function findNearestInteraction(game, vehicle, pairs) {
  const dimensions = getVehicleDimensions(game.level);
  return pairs
    .map((pair) => ({
      pair,
      interaction: classifyTransportTunnelApproach(vehicle, pair, dimensions)
    }))
    .filter(({ interaction }) => Boolean(interaction))
    .sort((left, right) => left.interaction.distance - right.interaction.distance)[0] ?? null;
}

function duration(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0.01, numeric) : fallback;
}

function clonePair(pair) {
  return {
    ...pair,
    entrance: { ...pair.entrance },
    exit: { ...pair.exit },
    feedback: pair.feedback ? { ...pair.feedback } : null
  };
}

export function createTransportTunnelRuntime({ level = null, options = {} } = {}) {
  const entryDuration = duration(options.entryDuration, 0.55);
  const hiddenDuration = duration(options.hiddenDuration, 0.15);
  const exitDuration = duration(options.exitDuration, 0.5);

  function state(game) {
    return game.mechanicState.transportTunnel;
  }

  function block(game, vehicle, pair, reason, wallSide = null) {
    pair.feedbackVersion += 1;
    pair.feedback = {
      reason,
      wallSide,
      startedAt: game.time,
      version: pair.feedbackVersion
    };
    return {
      handled: true,
      result: { ok: false, reason },
      event: {
        type: 'transport-tunnel-blocked',
        reason,
        pairId: pair.id,
        vehicleId: vehicle.id,
        wallSide,
        version: pair.feedbackVersion
      }
    };
  }

  return {
    id: 'transport-tunnel',

    createState(game) {
      const activeLevel = game?.level ?? level ?? {};
      const normalized = normalizeTransportTunnelPairs(
        activeLevel.mechanics?.['transport-tunnel']
      );
      return {
        transportTunnel: {
          invalidPairCount: normalized.invalidPairCount,
          pairs: normalized.pairs.map((pair) => ({
            ...pair,
            busyVehicleId: null,
            feedbackVersion: 0,
            feedback: null
          }))
        }
      };
    },

    decorateSnapshot(game) {
      const tunnel = state(game);
      return {
        transportTunnel: {
          invalidPairCount: tunnel.invalidPairCount,
          pairs: tunnel.pairs.map(clonePair)
        }
      };
    },

    hasVehicleDestination({ game, vehicle }) {
      return Boolean(findNearestInteraction(game, vehicle, state(game).pairs));
    },

    dispatchVehicle({ game, vehicle }) {
      const nearest = findNearestInteraction(game, vehicle, state(game).pairs);
      if (!nearest) return null;
      const { pair, interaction } = nearest;
      if (interaction.type === 'wall') {
        return block(game, vehicle, pair, 'tunnel-wall-blocked', interaction.wallSide);
      }
      if (pair.busyVehicleId != null) {
        return block(game, vehicle, pair, 'tunnel-busy');
      }
      if (isTransportTunnelExitOccupied(game, pair, vehicle)) {
        return block(game, vehicle, pair, 'tunnel-exit-blocked');
      }

      const dimensions = getVehicleDimensions(game.level);
      const forward = forwardFromYaw(pair.entrance.yaw);
      const entryOffset = TRANSPORT_TUNNEL_GEOMETRY.tunnelDepth / 2
        + dimensions.length / 2
        + 0.02;
      pair.busyVehicleId = vehicle.id;
      Object.assign(vehicle, {
        state: 'entering-tunnel',
        spotIndex: null,
        motion: 0,
        tunnelPairId: pair.id,
        motionData: {
          duration: entryDuration,
          from: { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw },
          to: {
            x: pair.entrance.x + forward.x * entryOffset,
            z: pair.entrance.z + forward.z * entryOffset,
            yaw: pair.entrance.yaw
          }
        }
      });
      return {
        handled: true,
        result: { ok: true, pairId: pair.id },
        destination: { kind: 'transport-tunnel', pairId: pair.id },
        event: {
          type: 'vehicle-dispatched',
          vehicleId: vehicle.id,
          transportTunnelPairId: pair.id
        }
      };
    },

    hasPendingVehicles(game) {
      return state(game).pairs.some(({ busyVehicleId }) => busyVehicleId != null);
    },

    hasOpenVehicleDestination(game) {
      const pairs = state(game).pairs;
      return game.vehicles.some((vehicle) => {
        if (vehicle.state !== 'parked' || game.getBlockers(vehicle.id).length > 0) return false;
        const nearest = findNearestInteraction(game, vehicle, pairs);
        return Boolean(
          nearest?.interaction.type === 'passage'
          && nearest.pair.busyVehicleId == null
          && !isTransportTunnelExitOccupied(game, nearest.pair, vehicle)
        );
      });
    },

    update({ game, delta }) {
      let changed = false;
      const dimensions = getVehicleDimensions(game.level);
      for (const pair of state(game).pairs) {
        if (pair.busyVehicleId == null) continue;
        const vehicle = game.getVehicle(pair.busyVehicleId);
        if (!vehicle || !TRANSFER_STATES.has(vehicle.state)) {
          pair.busyVehicleId = null;
          changed = true;
          continue;
        }

        const travelDuration = duration(vehicle.motionData?.duration, 0.1);
        vehicle.motion = Math.min(1, vehicle.motion + Math.max(0, delta) / travelDuration);
        changed = true;
        if (vehicle.motion < 1) continue;

        if (vehicle.state === 'entering-tunnel') {
          Object.assign(vehicle, {
            state: 'hidden-in-tunnel',
            motion: 0,
            motionData: { duration: hiddenDuration }
          });
          game.lastEvent = {
            type: 'transport-tunnel-hidden',
            pairId: pair.id,
            vehicleId: vehicle.id
          };
          continue;
        }

        if (vehicle.state === 'hidden-in-tunnel') {
          const forward = forwardFromYaw(pair.exit.yaw);
          const hiddenOffset = TRANSPORT_TUNNEL_GEOMETRY.tunnelDepth / 2
            + dimensions.length / 2
            + 0.02;
          const exitPose = getTransportTunnelExitPose(pair);
          Object.assign(vehicle, {
            state: 'exiting-tunnel',
            motion: 0,
            motionData: {
              duration: exitDuration,
              from: {
                x: pair.exit.x - forward.x * hiddenOffset,
                z: pair.exit.z - forward.z * hiddenOffset,
                yaw: pair.exit.yaw
              },
              to: exitPose
            }
          });
          game.lastEvent = {
            type: 'transport-tunnel-exiting',
            pairId: pair.id,
            vehicleId: vehicle.id
          };
          continue;
        }

        const exitPose = vehicle.motionData.to;
        Object.assign(vehicle, {
          state: 'parked',
          x: exitPose.x,
          z: exitPose.z,
          yaw: exitPose.yaw,
          motion: 0,
          motionData: null,
          tunnelPairId: null,
          useDynamicBlockers: true
        });
        pair.busyVehicleId = null;
        game.lastEvent = {
          type: 'transport-tunnel-complete',
          pairId: pair.id,
          vehicleId: vehicle.id
        };
      }
      return changed;
    }
  };
}
