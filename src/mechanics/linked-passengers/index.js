import { createLinkedPassengerRuntime } from './model.js';
import { createLinkedPassengerDetailView } from './view.js';

export const definition = {
  id: 'linked-passengers',
  name: '连体乘客',
  categories: ['乘客', '联动'],
  status: 'planned',
  summary: '前后排粘连，必须同时上一辆车。',
  effect: '将前后两排乘客绑定为不可拆分的组合，并要求同车同时容纳。',
  experience: '玩家需要提前确认车辆剩余座位，避免连体乘客卡住队列。',
  difficulty: '高'
};

export const createRuntime = createLinkedPassengerRuntime;
export const createDetailView = createLinkedPassengerDetailView;

export default { definition, createRuntime, createDetailView };
