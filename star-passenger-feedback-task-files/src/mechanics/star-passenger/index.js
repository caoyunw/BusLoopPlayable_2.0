import { createStarPassengerRuntime } from './model.js';

export const definition = {
  id: 'star-passenger',
  name: '星星乘客',
  categories: ['乘客', '奖励'],
  status: 'playable',
  summary: '上车时获得星星并为道具充能。',
  effect: '星星乘客完成上车时产出星星，同时增加道具的充能进度。',
  experience: '玩家通过优先接送星星乘客积累资源，并把充能节奏纳入调度。',
  difficulty: '低'
};

export const createRuntime = createStarPassengerRuntime;

export default { definition, createRuntime };
