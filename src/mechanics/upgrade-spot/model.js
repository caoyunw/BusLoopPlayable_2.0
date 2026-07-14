const UPGRADE_SPOT_INDEX = 0;
const CAPACITY_MULTIPLIER = 2;

function isOnUpgradeSpot(vehicle) {
  return vehicle?.spotIndex === UPGRADE_SPOT_INDEX
    && ['moving-to-spot', 'at-spot', 'boarding-final'].includes(vehicle.state);
}

export function createUpgradeSpotRuntime() {
  return {
    id: 'upgrade-spot',

    getVehicleSeatCapacity({ vehicle, capacity }) {
      const baseCapacity = Math.max(0, Number(capacity ?? vehicle?.seats ?? 0));
      return isOnUpgradeSpot(vehicle) ? baseCapacity * CAPACITY_MULTIPLIER : baseCapacity;
    },

    decorateSnapshot() {
      return {
        upgradeSpot: {
          spotIndex: UPGRADE_SPOT_INDEX,
          capacityMultiplier: CAPACITY_MULTIPLIER
        }
      };
    }
  };
}
