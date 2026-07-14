import { createRotaryLaneRuntime } from './model.js';

export const definition = {
  id: 'rotary-lane',
  name: '回转车道',
  categories: ['车辆', '场地机关', '空间变化'],
  status: 'playable',
  summary: '每次成功开走车辆后，回转车道上的车辆和空格同步循环前进一格。',
  effect: '每次成功派车都会推动所有回转车道前进一个格位，车辆与空格按关卡设定方向同步循环。',
  experience: '玩家需要预测下一次派车后的车位、朝向和阻挡变化，利用空格循环逐步打开关键车辆的路线。',
  difficulty: '高'
};

export const createRuntime = createRotaryLaneRuntime;

export default { definition, createRuntime };
