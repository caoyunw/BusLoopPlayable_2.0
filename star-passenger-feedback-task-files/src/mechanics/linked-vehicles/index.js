export const definition = {
  id: 'linked-vehicles',
  name: '连体车',
  categories: ['车辆', '联动'],
  status: 'planned',
  summary: '两辆车联动，同时进入并各占一个停车位。',
  effect: '绑定两辆车辆的移动指令，同时寻找并占用两个可用停车位。',
  experience: '玩家需要一次规划两个停车位，权衡联动车辆对场地容量的占用。',
  difficulty: '高'
};

export default { definition };
