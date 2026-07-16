import { createDoubleGateRuntime } from './model.js';

export const definition = {
  id: 'double-gate',
  name: '翻倍车门',
  categories: ['乘客', '车位', '容量'],
  status: 'playable',
  summary: '第一个车位的车门会让每组上车乘客按双倍数量占用座位。',
  effect: '车辆容量不变，但第一个车位每接走一组乘客会消耗两组容量；10座车因此只能接走5组。',
  experience: '玩家需要避免把乘客压力大的颜色停到翻倍车门，也可以用它更快清空少量关键乘客。',
  difficulty: '中'
};

export const createRuntime = createDoubleGateRuntime;

export default { definition, createRuntime };
