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

export function resolvePlayableMechanicId(id) {
  const module = getMechanicModuleById(id);
  return module?.definition.status === 'playable' ? module.definition.id : 'base';
}

export function createMechanicRuntime(id, context = {}) {
  const module = getMechanicModuleById(resolvePlayableMechanicId(id));
  if (module?.createRuntime) return module.createRuntime(context);
  return base.createRuntime(context);
}

export function createMechanicDetailView(id, context = {}) {
  const module = getMechanicModuleById(id);
  return typeof module?.createDetailView === 'function'
    ? module.createDetailView(context)
    : null;
}
