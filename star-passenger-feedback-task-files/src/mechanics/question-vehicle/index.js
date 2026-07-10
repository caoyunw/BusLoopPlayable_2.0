export const definition = {
  id: 'question-vehicle',
  name: '问号车',
  categories: ['车辆', '信息隐藏'],
  status: 'planned',
  summary: '颜色不可见，前方无阻挡时显示。',
  effect: '隐藏车辆颜色，直到车辆前方的阻挡全部移除后再揭示。',
  experience: '玩家需要根据停车布局和已知信息推测车辆的放行顺序。',
  difficulty: '中'
};

export default { definition };
