import { createOrderPassengerRuntime } from './model.js';

export const definition = {
  id: 'order-passenger',
  name: '订单乘客',
  categories: ['乘客', '订单'],
  status: 'playable',
  summary: '接完订单上的红色、黄色、棕色乘客即可完成关卡。',
  effect: '关卡目标改为订单面板上的三种特殊乘客，面板显示每种乘客剩余人数。',
  experience: '玩家围绕订单颜色调度车辆，不必清空全部车辆，只要完成红、黄、棕三种乘客订单即可过关。',
  difficulty: '中'
};

export const createRuntime = createOrderPassengerRuntime;

export default { definition, createRuntime };
