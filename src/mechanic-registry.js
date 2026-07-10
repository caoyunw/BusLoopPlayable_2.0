const definitions = [
  {
    id: 'base',
    name: '基础规则',
    categories: ['基础规则'],
    status: 'playable',
    summary: '车辆进入停车位后，匹配颜色的乘客依次上车。',
    effect: '提供车辆调度、颜色匹配、乘客上车和停车位周转的基础循环。',
    experience: '玩家观察阻挡关系并安排车辆顺序，让对应颜色的乘客顺利上车。',
    difficulty: '基础'
  },
  {
    id: 'question-passenger',
    name: '问号乘客',
    categories: ['乘客', '信息隐藏'],
    status: 'planned',
    summary: '左右队列不可见颜色，进入传送带后显示。',
    effect: '隐藏左右等待队列的乘客颜色，并在乘客进入传送带时揭示。',
    experience: '玩家需要为尚未揭示的乘客保留车辆与停车位的调度余量。',
    difficulty: '中'
  },
  {
    id: 'question-vehicle',
    name: '问号车',
    categories: ['车辆', '信息隐藏'],
    status: 'planned',
    summary: '颜色不可见，前方无阻挡时显示。',
    effect: '隐藏车辆颜色，直到车辆前方的阻挡全部移除后再揭示。',
    experience: '玩家需要根据停车布局和已知信息推测车辆的放行顺序。',
    difficulty: '中'
  },
  {
    id: 'elevator-bay',
    name: '升降舱',
    categories: ['车辆', '出车装置'],
    status: 'planned',
    summary: '舱门前车辆移开后才打开并传出下一组车辆。',
    effect: '检测舱门前的占位状态，在车辆移开后开启舱门并补充下一组车辆。',
    experience: '玩家需要主动清空舱门区域，逐批释放隐藏车辆。',
    difficulty: '中'
  },
  {
    id: 'garage',
    name: '车库',
    categories: ['车辆', '出车装置'],
    status: 'planned',
    summary: '车库口前车开走后下一辆才出现。',
    effect: '车库按顺序保存车辆，并在出口前一辆车离开后生成下一辆。',
    experience: '玩家需要为尚未出现的车辆预留空间和颜色匹配余量。',
    difficulty: '低'
  },
  {
    id: 'linked-passengers',
    name: '连体乘客',
    categories: ['乘客', '联动'],
    status: 'planned',
    summary: '前后排粘连，必须同时上一辆车。',
    effect: '将前后两排乘客绑定为不可拆分的组合，并要求同车同时容纳。',
    experience: '玩家需要提前确认车辆剩余座位，避免连体乘客卡住队列。',
    difficulty: '高'
  },
  {
    id: 'linked-vehicles',
    name: '连体车',
    categories: ['车辆', '联动'],
    status: 'planned',
    summary: '两辆车联动，同时进入并各占一个停车位。',
    effect: '绑定两辆车辆的移动指令，同时寻找并占用两个可用停车位。',
    experience: '玩家需要一次规划两个停车位，权衡联动车辆对场地容量的占用。',
    difficulty: '高'
  },
  {
    id: 'special-gate',
    name: '特殊门',
    categories: ['车辆', '场地机关'],
    status: 'planned',
    summary: '车辆经过停车场两侧特殊门时触发对应效果。',
    effect: '识别车辆经过的左侧或右侧特殊门，并执行该门配置的效果。',
    experience: '玩家需要选择车辆的进场方向，利用或规避不同门的效果。',
    difficulty: '中'
  },
  {
    id: 'star-passenger',
    name: '星星乘客',
    categories: ['乘客', '奖励'],
    status: 'playable',
    summary: '上车时获得星星并为道具充能。',
    effect: '星星乘客完成上车时产出星星，同时增加道具的充能进度。',
    experience: '玩家通过优先接送星星乘客积累资源，并把充能节奏纳入调度。',
    difficulty: '低'
  },
  {
    id: 'order-passenger',
    name: '订单乘客',
    categories: ['乘客', '车辆', '订单'],
    status: 'planned',
    summary: '普通车挡住南瓜车，解救后对应乘客上车并给予奖励。',
    effect: '关联被阻挡的南瓜车与订单乘客，在南瓜车获救并接客后发放奖励。',
    experience: '玩家需要先移走普通车完成解救，再让订单乘客搭乘对应的南瓜车。',
    difficulty: '高'
  },
  {
    id: 'valve',
    name: '阀门',
    categories: ['乘客', '玩家控制'],
    status: 'planned',
    summary: '玩家手动控制左右哪边乘客进入。',
    effect: '提供可切换的阀门状态，只允许当前选定一侧的乘客进入传送带。',
    experience: '玩家直接控制乘客汇入方向，以匹配场内车辆和队列节奏。',
    difficulty: '中'
  },
  {
    id: 'train',
    name: '火车',
    categories: ['车辆', '目标', '空间规划'],
    status: 'planned',
    summary: '车厢移至轨道，集齐4节并上满乘客后开走。',
    effect: '在车位区域增加火车轨道，点击停车场内车厢后将其移入轨道；同一轨道集齐4节车厢并完成乘客上车后整列离场。',
    experience: '玩家需要同时管理普通停车位和轨道容量，判断何时优先收集车厢以释放长期占位。',
    difficulty: '高'
  },
  {
    id: 'locked-garage',
    name: '上锁车库',
    categories: ['车辆', '出车装置', '条件解锁'],
    status: 'planned',
    summary: '带钥匙车辆开走后解锁上锁停车场。',
    effect: '划分一块上锁停车场，并在普通区域放置带钥匙车辆；钥匙车成功开走后解除该停车场锁定。',
    experience: '玩家会先寻找关键钥匙车，并围绕解锁顺序规划前期停车位和车辆释放节奏。',
    difficulty: '中'
  },
  {
    id: 'count-garage',
    name: '次数车库',
    categories: ['车辆', '出车装置', '条件解锁'],
    status: 'planned',
    summary: '开走指定数量车辆后解锁车库。',
    effect: '为车库设置剩余解锁次数，每成功开走一辆车就推进计数，达到指定数量后开放车库。',
    experience: '玩家需要在短期清车和等待车库解锁之间做节奏规划，形成明确的阶段目标。',
    difficulty: '低'
  },
  {
    id: 'rotating-spots',
    name: '旋转车位',
    categories: ['车位', '场地机关', '空间变化'],
    status: 'planned',
    summary: '每点击一次车辆，车位上的车顺时针旋转90°。',
    effect: '每次玩家点击车辆后，旋转车位上的所有车辆按固定方向同步旋转90度，改变其朝向和阻挡关系。',
    experience: '玩家需要预测下一次点击后的朝向变化，利用旋转制造通路或避免把关键车辆转入死角。',
    difficulty: '高'
  },
  {
    id: 'double-gate',
    name: '翻倍闸门',
    categories: ['乘客', '奖励', '场地机关'],
    status: 'planned',
    summary: '乘客经过闸门时数量翻倍。',
    effect: '乘客经过翻倍闸门时生成额外同色乘客，使该批乘客数量按配置倍增。',
    experience: '玩家可以主动放大有利颜色的乘客收益，但也要避免把当前缺车颜色翻倍后压垮队列。',
    difficulty: '中'
  },
  {
    id: 'maglev-spot',
    name: '磁悬浮车位',
    categories: ['车位', '状态变化', '空间管理'],
    status: 'planned',
    summary: '点击切换车位升降，升起时不阻挡地面车辆。',
    effect: '点击磁悬浮车位上的车辆时，在升起和降落两种状态之间切换；升起状态不参与地面阻挡判断。',
    experience: '玩家获得临时改造阻挡关系的能力，需要决定何时抬升车辆让地面车通行、何时降落继续接客。',
    difficulty: '高'
  }
];

export const MECHANICS = Object.freeze(definitions.map((item) => Object.freeze({
  ...item,
  categories: Object.freeze([...item.categories])
})));

export function getMechanicById(id) {
  return MECHANICS.find((mechanic) => mechanic.id === id) ?? null;
}

export function resolveMechanicId(id) {
  return getMechanicById(id)?.id ?? 'base';
}

export function filterMechanics(query = '') {
  const value = query.trim().toLocaleLowerCase('zh-CN');
  if (!value) return [...MECHANICS];

  return MECHANICS.filter((mechanic) => (
    [mechanic.name, mechanic.summary, ...mechanic.categories]
      .some((text) => text.toLocaleLowerCase('zh-CN').includes(value))
  ));
}
