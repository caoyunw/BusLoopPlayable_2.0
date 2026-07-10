const DEFAULT_CONFIG = Object.freeze({
  chance: 0.18,
  expireExitPasses: 3,
  progressTarget: 3
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

  function createRewardState() {
    return {
      enabled: true,
      coins: 0,
      collected: 0,
      expired: 0,
      target: Math.max(1, Math.round(config.progressTarget ?? 3))
    };
  }

  function createPassengerReward() {
    const chance = clampNumber(Number(config.chance ?? 0), 0, 1);
    if (random() >= chance) return null;
    return { active: true, exitPasses: 0, expired: false };
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
      reward.exitPasses = Math.max(0, reward.exitPasses ?? 0) + 1;
      const limit = Math.max(1, Math.round(config.expireExitPasses ?? 3));
      if (reward.exitPasses < limit) return true;

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
      game.mechanicState.starReward.coins += 1;
      game.mechanicState.starReward.collected += 1;
      return { starRewardCollected: true };
    },

    clearSlotData({ slot }) {
      slot.starReward = null;
    }
  };
}
