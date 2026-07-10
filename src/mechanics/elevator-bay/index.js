export const definition = {
  id: 'elevator-bay',
  name: '升降舱',
  categories: ['车辆', '出车装置'],
  status: 'planned',
  summary: '舱门前车辆移开后才打开并传出下一组车辆。',
  effect: '检测舱门前的占位状态，在车辆移开后开启舱门并补充下一组车辆。',
  experience: '玩家需要主动清空舱门区域，逐批释放隐藏车辆。',
  difficulty: '中'
};

export default { definition };
