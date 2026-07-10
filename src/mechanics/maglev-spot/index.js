export const definition = {
  id: 'maglev-spot',
  name: '磁悬浮车位',
  categories: ['车位', '状态变化', '空间管理'],
  status: 'planned',
  summary: '点击切换车位升降，升起时不阻挡地面车辆。',
  effect: '点击磁悬浮车位上的车辆时，在升起和降落两种状态之间切换；升起状态不参与地面阻挡判断。',
  experience: '玩家获得临时改造阻挡关系的能力，需要决定何时抬升车辆让地面车通行、何时降落继续接客。',
  difficulty: '高'
};

export default { definition };
