import { createGarageRuntime } from './model.js';

export const definition = {
  id: 'garage',
  name: '车库',
  categories: ['车辆', '出车装置'],
  status: 'playable',
  summary: '车库口前车开走后下一辆才出现。',
  effect: '车库按顺序保存车辆，并在出口前一辆车离开后生成下一辆。',
  experience: '玩家需要为尚未出现的车辆预留空间和颜色匹配余量。',
  difficulty: '低'
};

export const createRuntime = createGarageRuntime;

export default { definition, createRuntime };
