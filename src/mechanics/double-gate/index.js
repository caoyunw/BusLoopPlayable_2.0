export const definition = {
  id: 'double-gate',
  name: '翻倍闸门',
  categories: ['乘客', '奖励', '场地机关'],
  status: 'planned',
  summary: '乘客经过闸门时数量翻倍。',
  effect: '乘客经过翻倍闸门时生成额外同色乘客，使该批乘客数量按配置倍增。',
  experience: '玩家可以主动放大有利颜色的乘客收益，但也要避免把当前缺车颜色翻倍后压垮队列。',
  difficulty: '中'
};

export default { definition };
