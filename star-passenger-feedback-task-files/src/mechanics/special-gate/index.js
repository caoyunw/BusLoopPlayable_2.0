export const definition = {
  id: 'special-gate',
  name: '特殊门',
  categories: ['车辆', '场地机关'],
  status: 'planned',
  summary: '车辆经过停车场两侧特殊门时触发对应效果。',
  effect: '识别车辆经过的左侧或右侧特殊门，并执行该门配置的效果。',
  experience: '玩家需要选择车辆的进场方向，利用或规避不同门的效果。',
  difficulty: '中'
};

export default { definition };
