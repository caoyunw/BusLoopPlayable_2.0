import { createQuestionPassengerRuntime } from './model.js';

export const definition = {
  id: 'question-passenger',
  name: '问号乘客',
  categories: ['乘客', '信息隐藏'],
  status: 'planned',
  summary: '左右队列不可见颜色，进入传送带后显示。',
  effect: '隐藏左右等待队列的乘客颜色，并在乘客进入传送带时揭示。',
  experience: '玩家需要为尚未揭示的乘客保留车辆与停车位的调度余量。',
  difficulty: '中'
};

export const createRuntime = createQuestionPassengerRuntime;

export default { definition, createRuntime };
