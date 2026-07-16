const DEFAULT_CONFIG = Object.freeze({
  chance: 0.18,
  expireExitPasses: 3,
  progressTarget: 20
});

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

function cloneStarReward(reward) {
  return reward ? { ...reward } : null;
}

export function createStarPassengerRuntime({ random = Math.random, options = {} } = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...options
  };

  function getLifetime() {
    return Math.max(1, Math.round(config.expireExitPasses ?? 3));
  }

  function getChargeTarget() {
    return Math.max(1, Math.round(config.progressTarget ?? 20));
  }

  function createRewardState() {
    return {
      enabled: true,
      coins: 0,
      charge: 0,
      collected: 0,
      expired: 0,
      target: getChargeTarget(),
      completedCharges: 0
    };
  }

  function createPassengerReward() {
    const chance = clampNumber(Number(config.chance ?? 0), 0, 1);
    if (random() >= chance) return null;
    return {
      active: true,
      exitPasses: 0,
      remainingPasses: getLifetime(),
      decrementVersion: 0,
      expired: false
    };
  }

  return {
    id: 'star-passenger',

    createState() {
      return { starReward: createRewardState() };
    },

    createQueueItemData() {
      return { starReward: createPassengerReward() };
    },

    createSlotData() {
      return { starReward: null };
    },

    cloneQueueItemSnapshot(item) {
      return { starReward: cloneStarReward(item.starReward) };
    },

    cloneSlotSnapshot(slot) {
      return { starReward: cloneStarReward(slot.starReward) };
    },

    decorateSnapshot(game) {
      return { starReward: { ...game.mechanicState.starReward } };
    },

    onPassengerEnteredBelt({ slot, passenger }) {
      slot.starReward = cloneStarReward(passenger.starReward);
    },

    onPassengerExitPassed({ game, slot }) {
      const reward = slot.starReward;
      if (!reward?.active || reward.expired) return false;

      const limit = getLifetime();
      reward.exitPasses = Math.max(0, reward.exitPasses ?? 0) + 1;
      reward.remainingPasses = Math.max(0, limit - reward.exitPasses);
      reward.decrementVersion = Math.max(0, reward.decrementVersion ?? 0) + 1;
      if (reward.remainingPasses > 0) return true;

      reward.active = false;
      reward.expired = true;
      game.mechanicState.starReward.expired += 1;
      game.lastEvent = {
        type: 'star-passenger-expired',
        passengerId: slot.passengerId,
        slotIndex: slot.index,
        exitPasses: reward.exitPasses
      };
      return true;
    },

    onPassengerBoarded({ game, slot }) {
      const reward = slot.starReward;
      if (!reward?.active || reward.expired) {
        return { starRewardCollected: false };
      }
      reward.active = false;
      const state = game.mechanicState.starReward;
      const target = Math.max(1, state.target ?? getChargeTarget());
      state.coins += 1;
      state.collected += 1;
      state.charge += 1;

      const starChargeCompleted = state.charge >= target;
      if (starChargeCompleted) {
        state.charge = 0;
        state.completedCharges += 1;
      }

      return {
        starRewardCollected: true,
        starChargeCompleted,
        starChargeRound: state.completedCharges
      };
    },

    clearSlotData({ slot }) {
      slot.starReward = null;
    }
  };
}
