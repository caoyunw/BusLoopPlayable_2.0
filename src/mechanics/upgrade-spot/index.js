import { createUpgradeSpotRuntime } from './model.js';

export const definition = {
  id: 'upgrade-spot',
  name: '升级车位',
  categories: ['车辆', '车位', '容量'],
  status: 'playable',
  summary: '第一个车位会把驶入车辆的可载乘客组数变为两倍。',
  effect: '车辆进入第一个车位后使用双倍登车容量，原始车模尺寸不变，座位牌显示升级后的剩余人数。',
  experience: '玩家可以把关键颜色车辆优先送入升级车位，用一辆车消化更多同色乘客。',
  difficulty: '中'
};

export const createRuntime = createUpgradeSpotRuntime;

export default { definition, createRuntime };
