export const definition = {
  id: 'base',
  name: '基础规则',
  categories: ['基础规则'],
  status: 'playable',
  summary: '车辆进入停车位后，匹配颜色的乘客依次上车。',
  effect: '提供车辆调度、颜色匹配、乘客上车和停车位周转的基础循环。',
  experience: '玩家观察阻挡关系并安排车辆顺序，让对应颜色的乘客顺利上车。',
  difficulty: '基础'
};

export function createRuntime() {
  return {
    id: definition.id,
    createState: () => ({}),
    createQueueItemData: () => ({}),
    createSlotData: () => ({}),
    cloneQueueItemSnapshot: () => ({}),
    cloneSlotSnapshot: () => ({}),
    decorateSnapshot: () => ({})
  };
}

export default { definition, createRuntime };
