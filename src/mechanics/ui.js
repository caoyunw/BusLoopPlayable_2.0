import { createStarPassengerHud } from './star-passenger/view.js';
import { createOrderPassengerHud } from './order-passenger/view.js';

export function createMechanicUiControllers(context = {}) {
  return [
    createStarPassengerHud(context),
    createOrderPassengerHud(context)
  ];
}
