import { createGarageRuntime } from '../garage/model.js';

export const COUNT_GARAGE_UNLOCK_THRESHOLDS = Object.freeze({
  1: 10,
  2: 20
});

export function createCountGarageRuntime({ options = {} } = {}) {
  return createGarageRuntime({
    id: 'count-garage',
    options: {
      ...options,
      unlockThresholds: {
        ...COUNT_GARAGE_UNLOCK_THRESHOLDS,
        ...(options.unlockThresholds ?? {})
      }
    }
  });
}
