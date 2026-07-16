import { createValveRuntime } from './model.js';

export const definition = {
  id: 'valve',
  name: '阀门',
  categories: ['乘客', '节奏控制'],
  status: 'playable',
  summary: '传送带左右阀门自动轮流放行同色乘客段。',
  effect: '左右入口各有一个阀门；当前侧只放行队首同色乘客，同色段放完后自动切到另一侧。',
  experience: '玩家需要围绕交替出现的左右同色乘客段调度车辆，让传送带供给节奏更有预判性。',
  difficulty: '中'
};

export const createRuntime = createValveRuntime;

export default { definition, createRuntime };
