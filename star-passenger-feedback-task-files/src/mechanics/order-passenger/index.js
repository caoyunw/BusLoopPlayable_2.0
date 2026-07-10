export const definition = {
  id: 'order-passenger',
  name: '订单乘客',
  categories: ['乘客', '车辆', '订单'],
  status: 'planned',
  summary: '普通车挡住南瓜车，解救后对应乘客上车并给予奖励。',
  effect: '关联被阻挡的南瓜车与订单乘客，在南瓜车获救并接客后发放奖励。',
  experience: '玩家需要先移走普通车完成解救，再让订单乘客搭乘对应的南瓜车。',
  difficulty: '高'
};

export default { definition };
