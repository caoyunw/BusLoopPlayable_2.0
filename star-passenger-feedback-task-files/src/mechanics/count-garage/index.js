export const definition = {
  id: 'count-garage',
  name: '次数车库',
  categories: ['车辆', '出车装置', '条件解锁'],
  status: 'planned',
  summary: '开走指定数量车辆后解锁车库。',
  effect: '为车库设置剩余解锁次数，每成功开走一辆车就推进计数，达到指定数量后开放车库。',
  experience: '玩家需要在短期清车和等待车库解锁之间做节奏规划，形成明确的阶段目标。',
  difficulty: '低'
};

export default { definition };
