import { createMaglevSpotRuntime } from './model.js';

export const definition = {
  id: 'maglev-spot',
  name: '磁悬浮车位',
  categories: ['车位', '状态变化', '空间管理'],
  status: 'playable',
  summary: '每次成功开走车辆后，磁悬浮车位上的车辆在升起和降落之间切换。',
  effect: '车辆 28、35、33、50、39、58、41、52 位于磁悬浮车位；升起时不阻挡地面车辆，且自身不可开动。',
  experience: '玩家需要利用每次成功派车后的升降节奏，临时移除阻挡关系，再在降落时安排悬浮车位上的车辆出车。',
  difficulty: '高'
};

export const createRuntime = createMaglevSpotRuntime;

export default { definition, createRuntime };
