export const definition = {
  id: 'locked-garage',
  name: '上锁车库',
  categories: ['车辆', '出车装置', '条件解锁'],
  status: 'planned',
  summary: '带钥匙车辆开走后解锁上锁停车场。',
  effect: '划分一块上锁停车场，并在普通区域放置带钥匙车辆；钥匙车成功开走后解除该停车场锁定。',
  experience: '玩家会先寻找关键钥匙车，并围绕解锁顺序规划前期停车位和车辆释放节奏。',
  difficulty: '中'
};

export default { definition };
