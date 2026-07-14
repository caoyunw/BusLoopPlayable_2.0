const DOUBLE_GATE_SPOT_INDEX = 0;
const BOARDING_COST_MULTIPLIER = 2;

function isAtDoubleGate(vehicle) {
  return vehicle?.spotIndex === DOUBLE_GATE_SPOT_INDEX
    && ['at-spot', 'boarding-final'].includes(vehicle.state);
}

export function createDoubleGateRuntime() {
  return {
    id: 'double-gate',

    getPassengerBoardingCost({ vehicle, cost }) {
      const baseCost = Math.max(1, Number(cost ?? 1));
      return isAtDoubleGate(vehicle) ? baseCost * BOARDING_COST_MULTIPLIER : baseCost;
    },

    decorateSnapshot() {
      return {
        doubleGate: {
          spotIndex: DOUBLE_GATE_SPOT_INDEX,
          boardingCostMultiplier: BOARDING_COST_MULTIPLIER
        }
      };
    }
  };
}
