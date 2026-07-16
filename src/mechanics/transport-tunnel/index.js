import { createTransportTunnelRuntime } from './model.js';

export const definition = {
  id: 'transport-tunnel',
  name: '传送隧道',
  categories: ['车辆', '空间规划', '动态路径'],
  status: 'playable',
  summary: '车辆驶入配对入口后，从对应出口按设定方向驶出。',
  effect: '车头对准且路径畅通的车辆驶入单向入口，短暂隐藏后从配对出口按关卡设定方向驶出。',
  experience: '玩家需要同时规划入口朝向、隧道忙碌状态和出口占用，利用传送重新布置停车场车辆。',
  difficulty: '高'
};

export const createRuntime = createTransportTunnelRuntime;

export default { definition, createRuntime };
