import base from './base/index.js';
import questionPassenger from './question-passenger/index.js';
import questionVehicle from './question-vehicle/index.js';
import elevatorBay from './elevator-bay/index.js';
import garage from './garage/index.js';
import linkedPassengers from './linked-passengers/index.js';
import linkedVehicles from './linked-vehicles/index.js';
import specialGate from './special-gate/index.js';
import starPassenger from './star-passenger/index.js';
import orderPassenger from './order-passenger/index.js';
import valve from './valve/index.js';
import train from './train/index.js';
import lockedGarage from './locked-garage/index.js';
import countGarage from './count-garage/index.js';
import rotatingSpots from './rotating-spots/index.js';
import doubleGate from './double-gate/index.js';
import maglevSpot from './maglev-spot/index.js';

const modules = [
  base,
  questionPassenger,
  questionVehicle,
  elevatorBay,
  garage,
  linkedPassengers,
  linkedVehicles,
  specialGate,
  starPassenger,
  orderPassenger,
  valve,
  train,
  lockedGarage,
  countGarage,
  rotatingSpots,
  doubleGate,
  maglevSpot
];

function freezeModule(module) {
  return Object.freeze({
    ...module,
    definition: Object.freeze({
      ...module.definition,
      categories: Object.freeze([...module.definition.categories])
    })
  });
}

export const MECHANIC_MODULES = Object.freeze(modules.map(freezeModule));
export const MECHANIC_DEFINITIONS = Object.freeze(MECHANIC_MODULES.map((module) => module.definition));

export function getMechanicModuleById(id) {
  return MECHANIC_MODULES.find((module) => module.definition.id === id) ?? null;
}

function isGarageType(value) {
  if (value === 2) return true;
  return String(value ?? '').trim().toLowerCase() === 'garage';
}

function hasGarageContainers(level) {
  return (level?.containers ?? []).some((container) => isGarageType(container.type));
}

function mergeObjects(runtimes, method, args, fallback = {}) {
  return Object.assign(
    {},
    fallback,
    ...runtimes.map((runtime) => runtime[method]?.(...args) ?? {})
  );
}

function createCompositeRuntime(runtimes) {
  if (runtimes.length === 1) return runtimes[0];

  return {
    id: runtimes.map((runtime) => runtime.id).join('+'),

    createState(game) {
      return mergeObjects(runtimes, 'createState', [game]);
    },

    afterReset(context) {
      for (const runtime of runtimes) runtime.afterReset?.(context);
    },

    update(context) {
      let changed = false;
      for (const runtime of runtimes) {
        changed = Boolean(runtime.update?.(context)) || changed;
      }
      return changed;
    },

    hasPendingVehicles(game) {
      return runtimes.some((runtime) => Boolean(runtime.hasPendingVehicles?.(game)));
    },

    hasWon(game) {
      return runtimes.some((runtime) => Boolean(runtime.hasWon?.(game)));
    },

    onVehicleDispatched(context) {
      let changed = false;
      for (const runtime of runtimes) {
        changed = Boolean(runtime.onVehicleDispatched?.(context)) || changed;
      }
      return changed;
    },

    createQueueItemData(context) {
      return mergeObjects(runtimes, 'createQueueItemData', [context]);
    },

    createSlotData(context) {
      return mergeObjects(runtimes, 'createSlotData', [context]);
    },

    cloneQueueItemSnapshot(item) {
      return mergeObjects(runtimes, 'cloneQueueItemSnapshot', [item]);
    },

    cloneSlotSnapshot(slot) {
      return mergeObjects(runtimes, 'cloneSlotSnapshot', [slot]);
    },

    decorateSnapshot(game) {
      return mergeObjects(runtimes, 'decorateSnapshot', [game]);
    },

    onPassengerEnteredBelt(context) {
      for (const runtime of runtimes) runtime.onPassengerEnteredBelt?.(context);
    },

    canPassengerEnterBelt(context) {
      return runtimes.every((runtime) => runtime.canPassengerEnterBelt?.(context) ?? true);
    },

    onPassengerExitPassed(context) {
      let changed = false;
      for (const runtime of runtimes) {
        changed = Boolean(runtime.onPassengerExitPassed?.(context)) || changed;
      }
      return changed;
    },

    onPassengerBoarded(context) {
      return mergeObjects(runtimes, 'onPassengerBoarded', [context]);
    },

    clearSlotData(context) {
      for (const runtime of runtimes) runtime.clearSlotData?.(context);
    },

    getGarageForVehicle(game, vehicleId) {
      for (const runtime of runtimes) {
        const garage = runtime.getGarageForVehicle?.(game, vehicleId);
        if (garage) return garage;
      }
      return null;
    }
  };
}

export function resolvePlayableMechanicId(id) {
  const module = getMechanicModuleById(id);
  return module?.definition.status === 'playable' ? module.definition.id : 'base';
}

export function createMechanicRuntime(id, context = {}) {
  const resolvedId = resolvePlayableMechanicId(id);
  const module = getMechanicModuleById(resolvedId);
  const selectedRuntime = module?.createRuntime
    ? module.createRuntime(context)
    : base.createRuntime(context);
  const featureRuntimes = [];

  if (
    !selectedRuntime.handlesGarageContainers
    && resolvedId !== garage.definition.id
    && hasGarageContainers(context.level)
  ) {
    featureRuntimes.push(garage.createRuntime({
      ...context,
      options: context.mechanicOptions?.[garage.definition.id] ?? {}
    }));
  }

  return createCompositeRuntime([selectedRuntime, ...featureRuntimes]);
}

export function createMechanicDetailView(id, context = {}) {
  const module = getMechanicModuleById(id);
  return typeof module?.createDetailView === 'function'
    ? module.createDetailView(context)
    : null;
}
