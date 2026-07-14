import { LEVEL_1 } from './level-data.js';
import { SCENE_TUNING } from './scene-tuning.js';
import {
  UNITY_CURVES,
  UNITY_VEHICLE_MOTION,
  buildOutStationPoints,
  buildRoundedPath,
  buildToStationPoints,
  evaluateUnityCurve,
  getCollisionDistance,
  getCollisionMotion,
  getHitDirection,
  getStationMotion
} from './vehicle-motion.js';
import {
  createMechanicRuntime,
  resolvePlayableMechanicId
} from './mechanics/index.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const wrap01 = (value) => ((value % 1) + 1) % 1;
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const INITIAL_ENTRY_OFFSET_PERCENT = 0.0001;
const PASSENGER_READY_DISTANCE_THRESHOLD = 0.02;

function normalizeQueueCapacity(value, maximum) {
  const fallback = Number.isFinite(maximum) ? Math.max(0, Math.floor(maximum)) : 0;
  const numeric = Number(value);
  return clampNumber(
    Number.isFinite(numeric) ? Math.floor(numeric) : fallback,
    0,
    fallback
  );
}

function isDenseQueuePrefix(queue, batch) {
  if (!Array.isArray(queue) || !Array.isArray(batch) || batch.length === 0 || batch.length > queue.length) {
    return false;
  }
  for (let index = 0; index < batch.length; index += 1) {
    if (!Object.hasOwn(batch, index) || batch[index] !== queue[index]) return false;
  }
  return true;
}

function isDenseSlotBatch(slots, batch, headSlot) {
  if (!Array.isArray(batch) || batch.length === 0 || batch[0] !== headSlot) return false;
  const seen = new Set();
  for (let index = 0; index < batch.length; index += 1) {
    if (!Object.hasOwn(batch, index)) return false;
    const candidate = batch[index];
    if (
      !candidate
      || !Number.isInteger(candidate.index)
      || slots[candidate.index] !== candidate
      || seen.has(candidate)
    ) return false;
    seen.add(candidate);
  }
  return true;
}

function cloneSnapshotValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    for (const item of value) clone.push(cloneSnapshotValue(item, seen));
    return clone;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const clone = Object.create(prototype);
  seen.set(value, clone);
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneSnapshotValue(item, seen);
  }
  return clone;
}

function visualToVehicleAreaPoint(x, z) {
  const area = SCENE_TUNING.vehicleArea;
  const unitScale = area.positionUnitScale ?? LEVEL_1.mapScale;
  const rotation = -(area.rotationDegrees || 0) * Math.PI / 180;
  const dx = x - area.pivotX;
  const dz = z - area.pivotZ;
  const unrotatedX = area.pivotX + dx * Math.cos(rotation) - dz * Math.sin(rotation);
  const unrotatedZ = area.pivotZ + dx * Math.sin(rotation) + dz * Math.cos(rotation);
  const unityX = (unrotatedX - area.offsetX) / area.unityToWorldScale - area.sourceRootX;
  const unityZ = (
    (unrotatedZ - area.offsetZ)
    / (area.unityToWorldScale * (area.mirrorZ ? -1 : 1))
  ) - area.sourceRootZ;
  return {
    x: (unityX - area.positionPivotX) / unitScale + area.positionPivotX,
    z: (unityZ - area.positionPivotZ) / unitScale + area.positionPivotZ
  };
}

function visualYawToVehicleAreaYaw(yawDegrees) {
  const area = SCENE_TUNING.vehicleArea;
  const local = yawDegrees - (area.rotationDegrees || 0);
  return area.mirrorZ ? 180 - local : local;
}

function vehicleForward(vehicle) {
  const yaw = vehicle.yaw * Math.PI / 180;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

function vehicleRight(forward) {
  return { x: forward.z, z: -forward.x };
}

function dot(a, b) {
  return a.x * b.x + a.z * b.z;
}

function makeVehicleBox(vehicle, dimensions, scanForward = false) {
  const forward = vehicleForward(vehicle);
  const right = vehicleRight(forward);
  const length = scanForward ? 500 : dimensions.length;
  const centerOffset = scanForward ? (length - dimensions.length) * 0.5 : 0;
  return {
    center: {
      x: vehicle.x + forward.x * centerOffset,
      z: vehicle.z + forward.z * centerOffset
    },
    forward,
    right,
    halfLength: length * 0.5,
    halfWidth: dimensions.width * 0.5
  };
}

function projectedRadius(box, axis) {
  return Math.abs(dot(box.forward, axis)) * box.halfLength
    + Math.abs(dot(box.right, axis)) * box.halfWidth;
}

function overlapsOnAxis(a, b, axis) {
  const delta = { x: b.center.x - a.center.x, z: b.center.z - a.center.z };
  return Math.abs(dot(delta, axis)) <= projectedRadius(a, axis) + projectedRadius(b, axis);
}

function blocksVehicleExit(attacker, candidate, dimensions) {
  const exitBox = makeVehicleBox(attacker, dimensions, true);
  const candidateBox = makeVehicleBox(candidate, dimensions);
  return [
    exitBox.right,
    exitBox.forward,
    candidateBox.right,
    candidateBox.forward
  ].every((axis) => overlapsOnAxis(exitBox, candidateBox, axis));
}


export class BusLoopGame {
  constructor(level = LEVEL_1, options = {}) {
    this.level = level;
    this.listeners = new Set();
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.mechanicOptions = {
      ...(options.mechanics ?? {}),
      ...(options.starPassenger ? { 'star-passenger': options.starPassenger } : {})
    };
    this.resetVersion = 0;
    this.configureMechanic(options.mechanicId);
    this.reset();
  }

  getMechanicId() {
    return this.mechanicId;
  }

  setMechanic(id) {
    const next = resolvePlayableMechanicId(id);
    if (next === this.mechanicId) return false;
    this.configureMechanic(next);
    this.reset();
    return true;
  }

  setMechanicOptions(id, options = {}) {
    this.mechanicOptions[id] = {
      ...(this.mechanicOptions[id] ?? {}),
      ...options
    };
    if (id !== this.mechanicId) return false;
    this.configureMechanic(id);
    this.reset();
    return true;
  }

  configureMechanic(id) {
    this.mechanicId = resolvePlayableMechanicId(id);
    this.mechanicRuntime = createMechanicRuntime(this.mechanicId, {
      level: this.level,
      random: this.random,
      level: this.level,
      mechanicOptions: this.mechanicOptions,
      options: this.mechanicOptions[this.mechanicId] ?? {}
    });
  }

  reset() {
    this.resetVersion += 1;
    this.time = 0;
    this.status = 'playing';
    this.speedMultiplier = 1;
    this.boardingEventId = 0;
    this.boardingEvents = [];
    this.nextPassengerId = 1;
    this.initialFillActive = true;
    this.initialFilledSlotIndices = new Set();
    this.mechanicState = this.mechanicRuntime.createState?.(this) ?? {};
    this.conveyorPathLength = Math.max(0.0001, this.level.conveyorPathLength ?? 1);
    const authoredQueues = this.level.passengerQueues ?? [this.level.passengerSequence];
    this.queueSpacing = this.level.passengerQueue?.spacing ?? 0.4;
    this.queueAvailableLengths = authoredQueues.map(() => Math.max(0, (this.level.queueCapacity - 1) * this.queueSpacing));
    const queueCapacities = authoredQueues.map(() => this.level.queueCapacity);
    this.queueCapacities = queueCapacities.map((capacity) => (
      normalizeQueueCapacity(capacity, this.level.queueCapacity)
    ));
    this.queues = authoredQueues.map(() => []);
    this.sourceQueues = authoredQueues.map((queue) => queue.slice());
    this.sourceQueueIndices = authoredQueues.map(() => 0);
    for (let queueIndex = 0; queueIndex < authoredQueues.length; queueIndex += 1) {
      this.fillQueueFromSource(queueIndex, { initial: true });
    }
    this.vehicles = this.level.vehicles.map((vehicle) => ({
      ...vehicle, state: 'parked', spotIndex: null, boardedGroups: 0, motion: 0,
      motionData: null, collision: null, hit: null
    }));
    const spotCount = SCENE_TUNING.parkingSpots.count ?? this.level.spotCount;
    this.spots = Array.from({ length: spotCount }, (_, index) => ({
      index, vehicleId: null
    }));
    this.slots = Array.from({ length: this.level.conveyorCapacity }, (_, index) => ({
      index,
      progress: wrap01(index / this.level.conveyorCapacity),
      previousProgress: wrap01(index / this.level.conveyorCapacity),
      colorIndex: null,
      passengerId: null,
      entryIndex: null,
      entryMotion: null,
      ...this.createMechanicSlotData()
    }));
    this.mechanicRuntime.afterReset?.({ game: this });
    this.lastEvent = { type: 'reset' };
    this.emit();
  }

  initializeQueues(queueCapacities = [], queueSpacing = this.queueSpacing, queueLengths = [], conveyorPathLength = this.conveyorPathLength) {
    const authoredQueues = this.level.passengerQueues ?? [this.level.passengerSequence];
    this.queueSpacing = Math.max(0.01, queueSpacing ?? this.level.passengerQueue?.spacing ?? 0.4);
    this.conveyorPathLength = Math.max(0.0001, conveyorPathLength ?? this.conveyorPathLength ?? 1);
    this.queueAvailableLengths = authoredQueues.map((_, index) => Math.max(
      0,
      queueLengths[index] ?? ((this.level.queueCapacity - 1) * this.queueSpacing)
    ));
    this.queueCapacities = authoredQueues.map((_, index) => normalizeQueueCapacity(
      queueCapacities?.[index] ?? this.level.queueCapacity,
      this.level.queueCapacity
    ));
    this.queues = authoredQueues.map(() => []);
    this.sourceQueues = authoredQueues.map((queue) => queue.slice());
    this.sourceQueueIndices = authoredQueues.map(() => 0);
    for (let queueIndex = 0; queueIndex < authoredQueues.length; queueIndex += 1) {
      this.fillQueueFromSource(queueIndex, { initial: true });
    }
    this.lastEvent = { type: 'queues-initialized' };
    this.emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  snapshot() {
    return {
      time: this.time,
      resetVersion: this.resetVersion,
      status: this.status,
      speedMultiplier: this.speedMultiplier,
      initialFillActive: this.initialFillActive,
      sourceRemaining: this.sourceQueues.reduce((sum, queue) => sum + queue.length, 0),
      queues: this.queues.map((queue) => queue.map((item) => item.colorIndex)),
      queueItems: this.queues.map((queue) => queue.map((item) => ({
        ...item,
        ...this.cloneMechanicQueueItemSnapshot(item)
      }))),
      queueRemaining: this.queues.map((queue) => queue.length),
      vehicles: this.vehicles.map((vehicle) => ({
        ...vehicle,
        motionData: vehicle.motionData ? { ...vehicle.motionData } : null,
        collision: vehicle.collision ? { ...vehicle.collision } : null,
        hit: vehicle.hit ? { ...vehicle.hit } : null
      })),
      spots: this.spots.map((spot) => ({ ...spot })),
      slots: this.slots.map((slot) => ({
        ...slot,
        entryMotion: slot.entryMotion ? { ...slot.entryMotion } : null,
        ...this.cloneMechanicSlotSnapshot(slot)
      })),
      boardingEvents: cloneSnapshotValue(this.boardingEvents),
      ...this.decorateMechanicSnapshot(),
      lastEvent: cloneSnapshotValue(this.lastEvent),
      remainingGroups: this.getRemainingGroups(),
      remainingByColor: this.getRemainingByColor()
    };
  }

  setSpeedMultiplier(multiplier) {
    const next = multiplier >= this.level.longPressMultiplier
      ? this.level.longPressMultiplier : 1;
    if (next === this.speedMultiplier) return;
    this.speedMultiplier = next;
    this.lastEvent = { type: 'speed', multiplier: next };
    this.emit();
  }

  getVehicle(id) {
    return this.vehicles.find((vehicle) => vehicle.id === id);
  }

  getBlockers(id) {
    const vehicle = this.getVehicle(id);
    if (!vehicle || !['parked', 'in-garage'].includes(vehicle.state)) return [];
    if (this.level.vehicleDepthes && !vehicle.useDynamicBlockers) {
      const authoredBlockers = this.level.vehicleDepthes[id] ?? [];
      return authoredBlockers.filter((blockerId) => {
        const candidate = this.getVehicle(blockerId);
        return candidate && ['parked', 'colliding'].includes(candidate.state);
      });
    }
    // Unity scales both positions and Vehicle.Size by mapScale. The authored
    // level plane is equivalent when both are left unscaled.
    const dimensions = {
      width: this.level.vehicleSize.width / this.level.mapScale,
      length: this.level.vehicleSize.length / this.level.mapScale
    };
    return this.vehicles.filter((candidate) => {
      if (candidate.id === id || !['parked', 'colliding'].includes(candidate.state)) return false;
      return blocksVehicleExit(vehicle, candidate, dimensions);
    }).map((candidate) => candidate.id);
  }

  clickVehicle(id) {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    const vehicle = this.getVehicle(id);
    if (!vehicle || vehicle.state !== 'parked') return { ok: false, reason: 'unavailable' };
    const blockers = this.getBlockers(id);
    if (blockers.length > 0) {
      // Level positions are authored before GameScene.VehicleScale is applied.
      // Convert the scaled Unity collider dimensions back into that same plane.
      const collisionSize = {
        width: this.level.vehicleSize.width / this.level.mapScale,
        length: this.level.vehicleSize.length / this.level.mapScale
      };
      const targets = blockers.map((blockerId) => this.getVehicle(blockerId));
      const target = targets.sort((a, b) => (
        getCollisionDistance(vehicle, a, collisionSize)
        - getCollisionDistance(vehicle, b, collisionSize)
      ))[0];
      const distance = getCollisionDistance(vehicle, target, collisionSize);
      const motion = getCollisionMotion(distance);
      Object.assign(vehicle, {
        state: 'colliding', motion: 0,
        collision: {
          ...motion, targetId: target.id, elapsed: 0, offset: 0,
          contactTriggered: false, hitDirection: getHitDirection(vehicle, target)
        }
      });
      this.lastEvent = { type: 'blocked', vehicleId: id, blockers, targetId: target.id };
      this.emit();
      return { ok: false, reason: 'blocked', blockers };
    }
    const mechanicDispatch = this.mechanicRuntime.dispatchVehicle?.({
      game: this,
      vehicle
    });
    if (mechanicDispatch?.handled) {
      if (mechanicDispatch.event) this.lastEvent = mechanicDispatch.event;
      if (mechanicDispatch.result?.ok) {
        this.mechanicRuntime.onVehicleDispatched?.({
          game: this,
          vehicle,
          destination: mechanicDispatch.destination
        });
      }
      this.emit();
      return mechanicDispatch.result;
    }
    const spot = this.spots.find((candidate) => candidate.vehicleId === null);
    if (!spot) {
      this.lastEvent = { type: 'spots-full', vehicleId: id };
      this.checkEndState();
      this.emit();
      return { ok: false, reason: 'spots-full' };
    }
    spot.vehicleId = id;
    const target = this.getSpotPosition(spot.index);
    const path = buildRoundedPath(buildToStationPoints(vehicle, target, SCENE_TUNING.vehiclePath), SCENE_TUNING.vehiclePath);
    const stationMotion = getStationMotion(path.length);
    Object.assign(vehicle, {
      state: 'moving-to-spot', spotIndex: spot.index, motion: 0,
      motionData: { path, duration: stationMotion.duration, curve: stationMotion.curve }
    });
    this.lastEvent = { type: 'vehicle-dispatched', vehicleId: id, spotIndex: spot.index };
    this.mechanicRuntime.onVehicleDispatched?.({ game: this, vehicle, spot });
    this.emit();
    return { ok: true, spotIndex: spot.index };
  }

  update(deltaSeconds) {
    if (this.status !== 'playing') return;
    const delta = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.time += delta;
    let changed = false;

    for (const vehicle of this.vehicles) {
      if (vehicle.hit && this.time - vehicle.hit.startedAt >= UNITY_VEHICLE_MOTION.hitDuration) {
        vehicle.hit = null;
      }
    }

    for (const vehicle of this.vehicles) {
      if (vehicle.state === 'moving-to-spot') {
        vehicle.motion = clamp01(vehicle.motion + delta / vehicle.motionData.duration);
        if (vehicle.motion >= 1) {
          Object.assign(vehicle, { state: 'at-spot', motion: 0, motionData: null });
          this.lastEvent = { type: 'vehicle-arrived', vehicleId: vehicle.id, spotIndex: vehicle.spotIndex };
          changed = true;
        }
      } else if (vehicle.state === 'colliding') {
        const collision = vehicle.collision;
        collision.elapsed += delta;
        const contactTime = collision.forwardDuration;
        const returnStart = contactTime + collision.delay;
        const finishTime = returnStart + collision.backwardDuration;
        if (collision.elapsed < contactTime) {
          const t = clamp01(collision.elapsed / collision.forwardDuration);
          collision.offset = collision.distance * evaluateUnityCurve(collision.forwardCurve, t);
        } else if (collision.elapsed < returnStart) {
          collision.offset = collision.distance;
        } else {
          const t = clamp01((collision.elapsed - returnStart) / collision.backwardDuration);
          collision.offset = collision.distance * (1 - evaluateUnityCurve(collision.backwardCurve, t));
        }
        vehicle.motion = collision.distance > 0 ? collision.offset / collision.distance : 0;
        if (!collision.contactTriggered && collision.elapsed >= contactTime) {
          collision.contactTriggered = true;
          const target = this.getVehicle(collision.targetId);
          if (target) target.hit = { startedAt: this.time, ...collision.hitDirection };
          this.lastEvent = { type: 'vehicle-collision-contact', vehicleId: vehicle.id, targetId: collision.targetId };
          changed = true;
        }
        if (collision.elapsed >= finishTime) {
          Object.assign(vehicle, { state: 'parked', motion: 0, collision: null });
          this.lastEvent = { type: 'vehicle-collision-finished', vehicleId: vehicle.id };
          changed = true;
        }
      } else if (vehicle.state === 'boarding-final') {
        const fullLoadDelay = SCENE_TUNING.vehicleDeparturePath?.fullLoadDelay ?? this.level.boardingDepartureDelay;
        vehicle.motion = fullLoadDelay <= 0 ? 1 : clamp01(vehicle.motion + delta / fullLoadDelay);
        if (vehicle.motion >= 1) {
          const spot = this.spots[vehicle.spotIndex];
          if (spot?.vehicleId === vehicle.id) spot.vehicleId = null;
          const target = this.getSpotPosition(vehicle.spotIndex);
          const departure = SCENE_TUNING.vehicleDeparturePath ?? {};
          const backwardPath = buildRoundedPath(buildOutStationPoints(target, departure), departure);
          const forwardStart = backwardPath.segments.at(-1)?.p1 ?? target;
          const forwardPath = buildRoundedPath([
            forwardStart,
            {
              x: departure.exitTargetX ?? 4.2,
              z: forwardStart.z + (departure.exitTargetZOffset ?? 0)
            }
          ], departure);
          Object.assign(vehicle, {
            state: 'departing', motion: 0,
            motionData: {
              backwardPath,
              forwardPath,
              backwardDuration: backwardPath.length / Math.max(0.001, departure.backwardSpeed ?? 2.5),
              forwardDuration: forwardPath.length / Math.max(0.001, departure.forwardSpeed ?? 10)
            }
          });
          this.lastEvent = { type: 'vehicle-full', vehicleId: vehicle.id };
          changed = true;
        }
      } else if (vehicle.state === 'departing') {
        const totalDuration = vehicle.motionData.backwardDuration + vehicle.motionData.forwardDuration;
        vehicle.motion = clamp01(vehicle.motion + delta / totalDuration);
        if (vehicle.motion >= 1) {
          Object.assign(vehicle, { state: 'done', motion: 0, motionData: null });
          this.lastEvent = { type: 'vehicle-finished', vehicleId: vehicle.id };
          changed = true;
        }
      }
    }

    changed = Boolean(this.mechanicRuntime.update?.({ game: this, delta })) || changed;

    this.updateQueues(delta);

    const entryMotion = this.level.passengerEntryMotion ?? {};
    const activeConveyorSpeed = this.initialFillActive
      ? (entryMotion.passengerSpeed ?? this.level.conveyorSpeed)
      : this.level.conveyorSpeed;
    const progressDelta = delta * activeConveyorSpeed / this.conveyorPathLength * this.speedMultiplier;
    let initialFillClamp = 0;
    let initialFillHoldSlot = null;
    let initialFillHoldProgress = 0;
    for (const slot of this.slots) {
      slot.previousProgress = slot.progress;
      slot.progress = wrap01(slot.progress + progressDelta);
    }

    for (const slot of this.slots) {
      if (slot.colorIndex !== null) continue;
      const entry = this.getFirstPassedEntry(slot.previousProgress, slot.progress);
      if (!entry) continue;
      if (!this.canPassengerEnterBelt(entry)) continue;
      const waitingBatch = this.peekPassengerBatch(entry.index);
      if (!waitingBatch) {
        if (this.initialFillActive) {
          const holdProgress = wrap01(entry.percent - INITIAL_ENTRY_OFFSET_PERCENT);
          const clamp = wrap01(slot.progress - holdProgress);
          if (clamp > initialFillClamp) {
            initialFillClamp = clamp;
            initialFillHoldSlot = slot;
            initialFillHoldProgress = holdProgress;
          }
        }
        continue;
      }
      if (!this.tryEnterPassengerBatch(slot, entry)) {
        if (this.initialFillActive) {
          this.initialFillActive = false;
          changed = true;
        }
        continue;
      }
      changed = true;
    }

    if (this.initialFillActive && initialFillClamp > 0) {
      for (const slot of this.slots) {
        slot.progress = wrap01(slot.progress - initialFillClamp);
        slot.previousProgress = wrap01(slot.previousProgress - initialFillClamp);
      }
      if (initialFillHoldSlot) initialFillHoldSlot.progress = initialFillHoldProgress;
    }

    if (
      this.initialFillActive
      && this.initialFilledSlotIndices.size >= this.level.conveyorCapacity
      && !this.hasEnteringSlots()
    ) {
      this.initialFillActive = false;
    }

    for (const slot of this.slots) {
      if (slot.colorIndex === null) continue;
      const crossedExit = this.crossedPoint(slot.previousProgress, slot.progress, this.level.exitStart);
      const inExit = this.inExitRange(slot.progress);
      if (inExit && this.tryBoardPassengerBatch(slot)) {
        changed = true;
        continue;
      }
      if (crossedExit) {
        changed = Boolean(this.mechanicRuntime.onPassengerExitPassed?.({ game: this, slot })) || changed;
      }
    }

    const previousStatus = this.status;
    this.checkEndState();
    if (changed || this.status !== previousStatus) this.emit();
  }

  crossedPoint(previous, current, point) {
    if (previous <= current) return point > previous && point <= current;
    return point > previous || point <= current;
  }

  getFirstPassedEntry(previous, current) {
    let best = null;
    for (let index = 0; index < this.level.entryPercents.length; index += 1) {
      const percent = this.level.entryPercents[index];
      if (!this.crossedPoint(previous, current, percent)) continue;
      const distance = wrap01(percent - previous);
      if (!best || distance < best.distance) best = { index, percent, distance };
    }
    return best;
  }

  tryEnterPassengerBatch(headSlot, entry) {
    if (
      !headSlot
      || !Number.isInteger(headSlot.index)
      || this.slots[headSlot.index] !== headSlot
      || !entry
      || !Number.isInteger(entry.index)
    ) return false;
    const passengerBatch = this.peekPassengerBatch(entry.index);
    if (!passengerBatch || passengerBatch.length > this.slots.length) return false;
    const slotBatch = Array.from({ length: passengerBatch.length }, (_, memberIndex) => (
      this.slots[(headSlot.index - memberIndex + this.slots.length) % this.slots.length]
    ));
    if (
      new Set(slotBatch).size !== slotBatch.length
      || slotBatch.some((slot) => !slot || slot.colorIndex !== null)
    ) return false;

    const dequeued = this.dequeuePassengerBatch(entry.index, true, passengerBatch);
    if (!dequeued || dequeued.length !== slotBatch.length) return false;
    dequeued.forEach((passenger, memberIndex) => {
      const slot = slotBatch[memberIndex];
      slot.colorIndex = passenger.colorIndex;
      slot.passengerId = passenger.id;
      slot.entryIndex = entry.index;
      slot.entryMotion = this.createEntryMotion(entry.index, passenger);
      this.mechanicRuntime.onPassengerEnteredBelt?.({ game: this, slot, passenger });
      if (this.initialFillActive) this.initialFilledSlotIndices.add(slot.index);
    });
    this.lastEvent = {
      type: 'group-entered-belt',
      colorIndex: dequeued[0].colorIndex,
      entryIndex: entry.index,
      passengerId: dequeued[0].id,
      passengerIds: dequeued.map((passenger) => passenger.id),
      slotIndex: slotBatch[0].index,
      slotIndices: slotBatch.map((slot) => slot.index),
      groupCount: dequeued.length
    };
    return true;
  }

  hasEnteringSlots() {
    const duration = Math.max(0.1, this.level.passengerEntryMotion?.initialFillCatchUpDuration ?? 0.2);
    return this.slots.some((slot) => (
      slot.entryMotion && this.time - slot.entryMotion.startedAt < duration
    ));
  }

  getSpotPosition(index) {
    const spots = SCENE_TUNING.parkingSpots;
    const visualYaw = SCENE_TUNING.facing.parkingSpotYawDegrees ?? this.level.vehicleMotion.spotYaw;
    const sourceYaw = visualYawToVehicleAreaYaw(visualYaw);
    const approachOffset = SCENE_TUNING.vehicleDeparturePath?.backDistance ?? this.level.vehicleMotion.spotApproachOffsetZ;
    const visualCenter = {
      x: spots.startX + spots.spacing * index,
      z: spots.z
    };
    const visualForward = {
      x: Math.sin(visualYaw * Math.PI / 180),
      z: Math.cos(visualYaw * Math.PI / 180)
    };
    const approachDirection = this.level.vehicleMotion.spotApproachDirection === 'screen-down'
      ? { x: 0, z: 1 }
      : { x: -visualForward.x, z: -visualForward.z };
    const visualApproach = approachOffset == null ? null : {
      x: visualCenter.x + approachDirection.x * approachOffset,
      z: visualCenter.z + approachDirection.z * approachOffset
    };
    const center = visualToVehicleAreaPoint(visualCenter.x, visualCenter.z);
    const approach = visualApproach ? visualToVehicleAreaPoint(visualApproach.x, visualApproach.z) : null;
    return {
      x: center.x,
      z: center.z,
      yaw: sourceYaw,
      visualX: visualCenter.x,
      visualZ: visualCenter.z,
      visualYaw,
      approachX: approach?.x ?? null,
      approachZ: approach?.z ?? null,
      visualApproachX: visualApproach?.x ?? null,
      visualApproachZ: visualApproach?.z ?? null
    };
  }

  getQueueAdmissionBatchSize(queueIndex) {
    const source = this.sourceQueues[queueIndex] ?? [];
    if (source.length === 0) return 0;
    const sourceIndex = this.sourceQueueIndices[queueIndex] ?? 0;
    const requested = this.mechanicRuntime.getQueueAdmissionBatchSize?.({
      game: this,
      queueIndex,
      sourceIndex,
      sourceColors: source
    }) ?? 1;
    return Number.isInteger(requested) && requested >= 1 && requested <= source.length
      ? requested
      : 1;
  }

  fillQueueFromSource(queueIndex, { initial = false } = {}) {
    const queue = this.queues[queueIndex];
    const source = this.sourceQueues[queueIndex];
    const capacity = this.queueCapacities[queueIndex] ?? this.level.queueCapacity;
    if (!queue || !source) return;

    while (source.length > 0) {
      const batchSize = this.getQueueAdmissionBatchSize(queueIndex);
      if (batchSize < 1 || queue.length + batchSize > capacity) break;
      const sourceIndex = this.sourceQueueIndices[queueIndex];
      const colors = source.splice(0, batchSize);
      const availableLength = this.queueAvailableLengths[queueIndex] ?? 0;
      const lastDistance = queue.at(-1)?.distanceFromHead;
      const startDistance = initial
        ? queue.length * this.queueSpacing
        : (Number.isFinite(lastDistance) ? lastDistance + this.queueSpacing : availableLength);
      queue.push(...this.createQueueItems(
        colors,
        queueIndex,
        sourceIndex,
        startDistance
      ));
      this.sourceQueueIndices[queueIndex] += batchSize;
    }
  }

  peekPassengerBatch(queueIndex) {
    const queue = this.queues[queueIndex];
    if (!queue?.length) return null;
    if (queue[0].distanceFromHead > PASSENGER_READY_DISTANCE_THRESHOLD) return null;
    const batch = this.mechanicRuntime.getBeltEntryBatch?.({
      game: this,
      queueIndex,
      queue
    }) ?? [queue[0]];
    return isDenseQueuePrefix(queue, batch) ? batch.slice() : null;
  }

  dequeuePassengerBatch(queueIndex, includeDetails = false, expectedBatch = undefined) {
    const queue = this.queues[queueIndex];
    const batch = expectedBatch === undefined
      ? this.peekPassengerBatch(queueIndex)
      : expectedBatch;
    if (!isDenseQueuePrefix(queue, batch)) return null;
    queue.splice(0, batch.length);
    this.fillQueueFromSource(queueIndex);
    return includeDetails
      ? batch.map((passenger) => ({
          ...passenger,
          ...this.cloneMechanicQueueItemSnapshot(passenger)
        }))
      : batch;
  }

  dequeuePassenger(queueIndex, includeDetails = false) {
    const batch = this.dequeuePassengerBatch(queueIndex, includeDetails);
    if (!batch) return null;
    return includeDetails ? batch[0] : batch[0].colorIndex;
  }

  createQueueItems(colors, queueIndex, startIndex = 0, startDistance = 0) {
    const availableLength = this.queueAvailableLengths?.[queueIndex]
      ?? Math.max(0, (this.level.queueCapacity - 1) * (this.queueSpacing ?? 0.4));
    return colors.map((colorIndex, index) => ({
      id: this.nextPassengerId++,
      sourceIndex: startIndex + index,
      colorIndex,
      createdAt: this.time,
      distanceFromHead: clampNumber(
        startDistance + index * (this.queueSpacing ?? 0.4),
        0,
        availableLength
      ),
      ...this.createMechanicQueueItemData({ queueIndex, sourceIndex: startIndex + index })
    }));
  }

  createMechanicQueueItemData(context = {}) {
    return this.mechanicRuntime.createQueueItemData?.({ game: this, ...context }) ?? {};
  }

  createMechanicSlotData() {
    return this.mechanicRuntime.createSlotData?.({ game: this }) ?? {};
  }

  cloneMechanicQueueItemSnapshot(item) {
    return this.mechanicRuntime.cloneQueueItemSnapshot?.(item) ?? {};
  }

  cloneMechanicSlotSnapshot(slot) {
    return this.mechanicRuntime.cloneSlotSnapshot?.(slot) ?? {};
  }

  decorateMechanicSnapshot() {
    return this.mechanicRuntime.decorateSnapshot?.(this) ?? {};
  }

  canPassengerEnterBelt(entry) {
    return this.mechanicRuntime.canPassengerEnterBelt?.({ game: this, entry }) ?? true;
  }

  updateQueues(delta) {
    const speed = Math.max(0.01, this.level.passengerEntryMotion?.passengerSpeed ?? this.level.conveyorSpeed);
    const step = speed * Math.max(0, delta) * this.speedMultiplier;
    for (let queueIndex = 0; queueIndex < this.queues.length; queueIndex += 1) {
      const queue = this.queues[queueIndex];
      const availableLength = this.queueAvailableLengths?.[queueIndex] ?? Infinity;
      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        const target = Math.min(index * this.queueSpacing, availableLength);
        if (item.distanceFromHead > target) {
          item.distanceFromHead = Math.max(target, item.distanceFromHead - step);
        } else if (item.distanceFromHead < target) {
          item.distanceFromHead = Math.min(target, item.distanceFromHead + step);
        }
      }
    }
  }

  createEntryMotion(entryIndex, passenger = null) {
    return {
      entryIndex,
      passengerId: passenger?.id ?? null,
      fromQueueDistance: passenger?.distanceFromHead ?? 0,
      fromQueueProgress: 0,
      startedAt: this.time,
      initialFill: this.initialFillActive
    };
  }

  inExitRange(progress) {
    const { exitStart, exitEnd } = this.level;
    return exitStart <= exitEnd
      ? progress >= exitStart && progress <= exitEnd
      : progress >= exitStart || progress <= exitEnd;
  }

  getBoardingBatch(slot) {
    const batch = this.mechanicRuntime.getBoardingBatch?.({
      game: this,
      slot,
      slots: this.slots
    }) ?? [slot];
    return isDenseSlotBatch(this.slots, batch, slot) ? batch : [];
  }

  tryBoardPassengerBatch(slot) {
    const batch = this.getBoardingBatch(slot);
    if (batch.length === 0) return false;
    const colorIndex = batch[0].colorIndex;
    if (
      colorIndex === null
      || batch.some((candidate) => candidate.colorIndex !== colorIndex)
    ) return false;
    const vehicle = this.findBoardableVehicle(colorIndex, batch.length);
    if (!vehicle) return false;

    const passengerIds = batch.map((candidate) => candidate.passengerId);
    const slotIndices = batch.map((candidate) => candidate.index);
    const progresses = batch.map((candidate) => candidate.progress);
    const mechanicBoardingEvent = this.mechanicRuntime.onPassengerBatchBoarded?.({
      game: this,
      slots: batch,
      vehicle
    }) ?? this.mechanicRuntime.onPassengerBoarded?.({
      game: this,
      slot: batch[0],
      vehicle
    }) ?? {};
    this.boardingEvents.push({
      id: ++this.boardingEventId,
      vehicleId: vehicle.id,
      spotIndex: vehicle.spotIndex,
      colorIndex,
      passengerId: passengerIds[0],
      passengerIds,
      ...mechanicBoardingEvent,
      slotIndex: slotIndices[0],
      slotIndices,
      progress: progresses[0],
      progresses,
      groupCount: batch.length,
      startedAt: this.time
    });
    if (this.boardingEvents.length > 24) this.boardingEvents.shift();

    for (const candidate of batch) {
      candidate.colorIndex = null;
      candidate.passengerId = null;
      candidate.entryIndex = null;
      candidate.entryMotion = null;
      this.mechanicRuntime.clearSlotData?.({ game: this, slot: candidate });
    }
    vehicle.boardedGroups += batch.length;
    this.lastEvent = {
      type: 'group-boarded',
      vehicleId: vehicle.id,
      colorIndex,
      boardedGroups: vehicle.boardedGroups,
      passengerId: passengerIds[0],
      passengerIds,
      groupCount: batch.length,
      ...mechanicBoardingEvent
    };
    if (vehicle.boardedGroups >= vehicle.seats) {
      const handled = this.mechanicRuntime.onVehicleFilled?.({
        game: this,
        vehicle
      }) ?? false;
      if (!handled) {
        Object.assign(vehicle, { state: 'boarding-final', motion: 0 });
        this.lastEvent = { type: 'vehicle-boarding-final', vehicleId: vehicle.id };
      }
    }
    return true;
  }

  findBoardableVehicle(colorIndex, requiredGroups = 1) {
    const mechanicVehicle = this.mechanicRuntime.findBoardableVehicle?.({
      game: this,
      colorIndex,
      requiredGroups
    });
    if (mechanicVehicle) return mechanicVehicle;
    for (const spot of this.spots) {
      if (spot.vehicleId === null) continue;
      const vehicle = this.getVehicle(spot.vehicleId);
      const freeGroups = vehicle ? vehicle.seats - vehicle.boardedGroups : 0;
      if (
        vehicle?.state === 'at-spot' &&
        vehicle.colorIndex === colorIndex &&
        freeGroups >= requiredGroups
      ) return vehicle;
    }
    return null;
  }

  hasBoardablePassenger() {
    return this.slots.some((slot) => {
      if (slot.colorIndex === null) return false;
      const batch = this.getBoardingBatch(slot);
      if (batch.length === 0) return false;
      const colorIndex = batch[0].colorIndex;
      if (batch.some((candidate) => candidate.colorIndex !== colorIndex)) return false;
      return this.findBoardableVehicle(colorIndex, batch.length) !== null;
    });
  }

  checkEndState() {
    if (this.mechanicRuntime.hasWon?.(this)) {
      this.status = 'won';
      this.lastEvent = { type: 'win', reason: 'mechanic-goal-complete', mechanicId: this.mechanicId };
      return;
    }
    if (this.vehicles.every((vehicle) => vehicle.state === 'done')) {
      this.status = 'won';
      this.lastEvent = { type: 'win' };
      return;
    }
    if (this.mechanicRuntime.hasPendingVehicles?.(this)) return;
    const enabledSpotsFull = this.spots.every((spot) => spot.vehicleId !== null)
      && !this.mechanicRuntime.hasOpenVehicleDestination?.(this);
    const beltFull = this.slots.every((slot) => slot.colorIndex !== null);
    const upstreamEmpty = this.sourceQueues.every((queue) => queue.length === 0)
      && this.queues.every((queue) => queue.length === 0);
    if (enabledSpotsFull && (upstreamEmpty || beltFull) && !this.hasBoardablePassenger()) {
      this.status = 'lost';
      this.lastEvent = { type: 'lose', reason: 'exceed-parking-spot' };
    }
  }

  getRemainingGroups() {
    const queued = this.queues.reduce((sum, queue) => sum + queue.length, 0);
    const sourced = this.sourceQueues.reduce((sum, queue) => sum + queue.length, 0);
    return sourced + queued + this.slots.filter((slot) => slot.colorIndex !== null).length;
  }

  getRemainingByColor() {
    const counts = { 0: 0, 4: 0, 5: 0 };
    for (const queue of [...this.sourceQueues, ...this.queues]) {
      for (const value of queue) {
        const colorIndex = typeof value === 'object' ? value.colorIndex : value;
        counts[colorIndex] = (counts[colorIndex] ?? 0) + 1;
      }
    }
    for (const slot of this.slots) {
      if (slot.colorIndex !== null) {
        counts[slot.colorIndex] = (counts[slot.colorIndex] ?? 0) + 1;
      }
    }
    return counts;
  }
}


