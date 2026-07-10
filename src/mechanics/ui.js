import { createStarPassengerHud } from './star-passenger/view.js';

export function createMechanicUiControllers(context = {}) {
  return [
    createStarPassengerHud(context)
  ];
}
