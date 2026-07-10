export const definition = {
  id: 'rotating-spots',
  name: '旋转车位',
  categories: ['车位', '场地机关', '空间变化'],
  status: 'planned',
  summary: '每点击一次车辆，车位上的车顺时针旋转90°。',
  effect: '每次玩家点击车辆后，旋转车位上的所有车辆按固定方向同步旋转90度，改变其朝向和阻挡关系。',
  experience: '玩家需要预测下一次点击后的朝向变化，利用旋转制造通路或避免把关键车辆转入死角。',
  difficulty: '高'
};

export default { definition };
