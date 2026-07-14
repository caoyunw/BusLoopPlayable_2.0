import { createTrainRuntime } from './model.js';
import { createTrainDetailView } from './view.js';

export const definition = {
  id: 'train',
  name: '火车',
  categories: ['车辆', '目标', '空间规划'],
  status: 'playable',
  summary: '车厢移至轨道，集齐4节并上满乘客后开走。',
  effect: '在车位区域增加火车轨道，点击停车场内车厢后将其移入轨道；同一轨道集齐4节车厢并完成乘客上车后整列离场。',
  experience: '玩家需要同时管理普通停车位和轨道容量，判断何时优先收集车厢以释放长期占位。',
  difficulty: '高'
};

export const createRuntime = createTrainRuntime;
export const createDetailView = createTrainDetailView;

export default { definition, createRuntime, createDetailView };
