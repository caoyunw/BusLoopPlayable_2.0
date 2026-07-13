export const COLORS = Object.freeze({
  0: { name: 'Blue', hex: 0x0061e8, css: '#0061e8' },
  1: { name: 'Green', hex: 0x118024, css: '#118024' },
  2: { name: 'Pink', hex: 0xf338af, css: '#f338af' },
  3: { name: 'Purple', hex: 0x9725cd, css: '#9725cd' },
  4: { name: 'Red', hex: 0xb10f11, css: '#b10f11' },
  5: { name: 'Yellow', hex: 0xc68000, css: '#c68000' },
  6: { name: 'Orange', hex: 0xc24300, css: '#c24300' },
  7: { name: 'LightBlue', hex: 0x014853, css: '#014853' },
  8: { name: 'Brown', hex: 0x542c16, css: '#542c16' },
  9: { name: 'DarkGreen', hex: 0x206d53, css: '#206d53' },
  10: { name: 'DarkBlue', hex: 0x15209e, css: '#15209e' }
});

// Unity BusJamConfig.asset -> passengerColorData. Unity MatchColor ids are
// 1-based, while the playable level data uses 0-based colorIndex values.
export const PASSENGER_COUNT_BOARD_COLORS = Object.freeze({
  0: { background: 0x50a7ff, outline: '#263767' },
  1: { background: 0x55cf63, outline: '#11601b' },
  2: { background: 0xff84fd, outline: '#ae276c' },
  3: { background: 0xc95aff, outline: '#5a3681' },
  4: { background: 0xf4585a, outline: '#7c2120' },
  5: { background: 0xffca13, outline: '#713908' },
  6: { background: 0xff9229, outline: '#963a0f' },
  7: { background: 0x4deaf6, outline: '#1f6d5c' },
  8: { background: 0xb46551, outline: '#702a09' },
  9: { background: 0x35ac93, outline: '#226355' },
  10: { background: 0x3e45ff, outline: '#161b6f' }
});


const LEVEL18_PASSENGER_QUEUES = Object.freeze([
  Object.freeze([
    4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 5, 5, 5, 5, 4, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 1, 1, 1, 1, 8, 8, 8, 8, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1,
    2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0
  ]),
  Object.freeze([
    4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 0, 0, 8, 8, 8, 8, 8, 8, 5, 5, 5,
    5, 5, 5, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 4, 4, 4, 4, 5, 5, 5, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 8, 8, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 1,
    1, 1, 1, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 3, 3,
    2, 2, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 5, 5, 5, 8, 8, 8, 8, 3, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    5, 8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 1, 1, 1, 1
  ])
]);

const LEVEL18_VEHICLE_DEPTHES = Object.freeze({
  28: Object.freeze([31]),
  29: Object.freeze([30, 33, 56]),
  33: Object.freeze([30, 56]),
  34: Object.freeze([48, 28, 31, 38, 61, 62, 63, 64, 65, 66, 67]),
  35: Object.freeze([28, 31, 48]),
  36: Object.freeze([32, 50]),
  37: Object.freeze([32, 51]),
  38: Object.freeze([48, 28, 31]),
  39: Object.freeze([31]),
  40: Object.freeze([55, 56, 58]),
  41: Object.freeze([33, 30, 56, 34, 48, 28, 31, 38, 61, 62, 63, 64, 65, 66, 67, 59, 35]),
  42: Object.freeze([29, 30, 33, 56]),
  43: Object.freeze([29, 30, 33, 56, 47, 35, 28, 31, 48, 38, 61, 62, 63, 64, 65, 66, 67]),
  44: Object.freeze([54, 31, 39]),
  45: Object.freeze([31, 39, 54]),
  46: Object.freeze([45, 31, 39, 54]),
  47: Object.freeze([35, 28, 31, 48]),
  48: Object.freeze([28, 31]),
  49: Object.freeze([31, 39, 45, 54]),
  50: Object.freeze([32]),
  51: Object.freeze([32]),
  52: Object.freeze([55, 56, 58]),
  53: Object.freeze([39, 31, 54]),
  54: Object.freeze([31, 39]),
  55: Object.freeze([56, 58]),
  57: Object.freeze([40, 55, 56, 58, 41, 33, 30, 34, 48, 28, 31, 38, 61, 62, 63, 64, 65, 66, 67, 59, 35, 52]),
  59: Object.freeze([35, 28, 31, 48, 38, 61, 62, 63, 64, 65, 66, 67]),
  60: Object.freeze([47, 35, 28, 31, 48]),
  61: Object.freeze([48, 28, 31, 38]),
  62: Object.freeze([48, 28, 31, 38, 61]),
  63: Object.freeze([48, 28, 31, 38, 61, 62]),
  64: Object.freeze([48, 28, 31, 38, 61, 62, 63]),
  65: Object.freeze([48, 28, 31, 38, 61, 62, 63, 64]),
  66: Object.freeze([48, 28, 31, 38, 61, 62, 63, 64, 65]),
  67: Object.freeze([48, 28, 31, 38, 61, 62, 63, 64, 65, 66]),
  68: Object.freeze([47, 35, 28, 31, 48, 60]),
  69: Object.freeze([47, 35, 28, 31, 48, 60, 68]),
  70: Object.freeze([47, 35, 28, 31, 48, 60, 68, 69]),
  71: Object.freeze([47, 35, 28, 31, 48, 60, 68, 69, 70]),
  72: Object.freeze([47, 35, 28, 31, 48, 60, 68, 69, 70, 71]),
  73: Object.freeze([47, 35, 28, 31, 48, 60, 68, 69, 70, 71, 72]),
  74: Object.freeze([47, 35, 28, 31, 48, 60, 68, 69, 70, 71, 72, 73])
});

const PASSENGER_SEQUENCE = Object.freeze(LEVEL18_PASSENGER_QUEUES.flat());

export const LEVEL_1 = Object.freeze({
  id: 18, mapScale: 1.33, sceneName: 'GameSceneDualQueue2', groupSize: 4,
  spotCount: 6, conveyorCapacity: 32, conveyorSpeed: 0.5, conveyorPathLength: 4.591284809513923,
  queueCount: 2, queueCapacity: 24, entryPercents: [0, 0.421],
  longPressThreshold: 0.2, longPressMultiplier: 3, exitStart: 0.605, exitEnd: 0.78,
  boardingDepartureDelay: 1.6,
  passengerQueue: {
    spacing: 0.4,
    screenEdgeOffsetSpacing: 4
  },
  passengerEntryMotion: {
    passengerSpeed: 2,
    conveyorSpeed: 0.5,
    initialFillCatchUpDuration: 0.2,
    catchUpExtraSpeed: 1,
    snapDistance: 0.02
  },
  vehicleSize: { width: 0.27 * 1.33, length: 0.6785897 * 1.33 },
  vehicleMotion: {
    // Current Three.js parking layout expressed back in the Unity level plane.
    spotStartX: -3.85 / 3.1,
    spotSpacing: 1.1 / 3.1,
    spotZ: (5.5 - 0.92) / 3.1,
    spotYaw: 0,
    spotApproachOffsetZ: 0.5,
    spotApproachDirection: 'screen-down'
  },
  vehicles: [
    { id: 28, seats: 10, colorIndex: 0, x: 0.27567083, z: 1.1003189, yaw: 89.999998 },
    { id: 29, seats: 10, colorIndex: 5, x: -1.2571762, z: -0.23574443, yaw: -179.999995 },
    { id: 30, seats: 4, colorIndex: 5, x: -1.1691761, z: -1.6416624, yaw: -89.999998 },
    { id: 31, seats: 10, colorIndex: 4, x: 1.0436721, z: 1.0903189, yaw: 89.999998 },
    { id: 32, seats: 10, colorIndex: 4, x: 0.9779671, z: -1.9973671, yaw: 89.999998 },
    { id: 33, seats: 10, colorIndex: 4, x: -1.2571762, z: -1.0316133, yaw: -179.999995 },
    { id: 34, seats: 6, colorIndex: 3, x: -0.54990786, z: -1.1520834, yaw: 0 },
    { id: 35, seats: 6, colorIndex: 1, x: -1.1471763, z: 1.062319, yaw: 89.999998 },
    { id: 36, seats: 6, colorIndex: 5, x: 0.91796625, z: -1.0053186, yaw: -179.999995 },
    { id: 37, seats: 6, colorIndex: 4, x: 0.59796625, z: -0.9953187, yaw: -179.999995 },
    { id: 39, seats: 10, colorIndex: 8, x: 1.2579668, z: 0.48251456, yaw: 0 },
    { id: 40, seats: 6, colorIndex: 8, x: 0.23954469, z: -1.5303199, yaw: -179.999995 },
    { id: 41, seats: 4, colorIndex: 8, x: 0.03446002, z: -1.0766943, yaw: -89.999998 },
    { id: 42, seats: 10, colorIndex: 5, x: 0.02270221, z: -0.20331733, yaw: -89.999998 },
    { id: 43, seats: 10, colorIndex: 1, x: 0.02270223, z: 0.1668058, yaw: -89.999998 },
    { id: 44, seats: 6, colorIndex: 1, x: 0.7499656, z: -0.2111943, yaw: 89.999998 },
    { id: 45, seats: 10, colorIndex: 0, x: 1.257967, z: -0.8534891, yaw: 0.000008 },
    { id: 46, seats: 4, colorIndex: 0, x: 0.7592996, z: -0.5742679, yaw: 89.999998 },
    { id: 47, seats: 10, colorIndex: 3, x: -1.2471762, z: 0.5242751, yaw: 0 },
    { id: 48, seats: 10, colorIndex: 3, x: -0.47703415, z: 1.0903189, yaw: 89.999998 },
    { id: 49, seats: 6, colorIndex: 1, x: 1.2699656, z: -1.5503194, yaw: 0 },
    { id: 50, seats: 4, colorIndex: 1, x: 0.9179662, z: -1.560873, yaw: -179.999995 },
    { id: 51, seats: 4, colorIndex: 8, x: 0.5979661, z: -1.560873, yaw: -179.999995 },
    { id: 52, seats: 6, colorIndex: 5, x: -0.11832958, z: -1.5400832, yaw: -179.999995 },
    { id: 53, seats: 4, colorIndex: 5, x: 0.7427551, z: 0.16680577, yaw: 89.999998 },
    { id: 54, seats: 6, colorIndex: 3, x: 1.2579668, z: -0.18531734, yaw: 0 },
    { id: 55, seats: 10, colorIndex: 3, x: 0.04270219, z: -1.990319, yaw: -89.999998 },
    { id: 56, seats: 4, colorIndex: 0, x: -1.1519656, z: -2.000319, yaw: -89.999998 },
    { id: 57, seats: 4, colorIndex: 1, x: 0.0423342, z: -0.64919424, yaw: -179.999995 },
    { id: 58, seats: 4, colorIndex: 1, x: -0.5899078, z: -1.8811095, yaw: -179.999995 },
    { id: 59, seats: 6, colorIndex: 5, x: -0.84717625, z: -1.1520834, yaw: 0.000002 },
    { id: 38, seats: 4, colorIndex: 2, x: -1.3850003, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 61, seats: 4, colorIndex: 4, x: -0.8450003, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 62, seats: 6, colorIndex: 2, x: -0.3050003, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 63, seats: 10, colorIndex: 5, x: 0.23499972, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 64, seats: 6, colorIndex: 1, x: 0.77499974, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 65, seats: 4, colorIndex: 3, x: 1.3149998, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 66, seats: 10, colorIndex: 8, x: 1.8549998, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 67, seats: 6, colorIndex: 3, x: 2.3949997, z: 1.5028379, yaw: 0, containerType: 2, containerId: 1 },
    { id: 60, seats: 6, colorIndex: 8, x: -2.7299998, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 68, seats: 6, colorIndex: 4, x: -2.1899998, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 69, seats: 4, colorIndex: 1, x: -1.6499999, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 70, seats: 6, colorIndex: 0, x: -1.1099999, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 71, seats: 4, colorIndex: 0, x: -0.5699999, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 72, seats: 4, colorIndex: 3, x: -0.02999985, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 73, seats: 6, colorIndex: 3, x: 0.51000017, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 },
    { id: 74, seats: 4, colorIndex: 8, x: 1.0500002, z: 0.75783837, yaw: 0, containerType: 2, containerId: 2 }
  ],
  containers: [
    { id: 0, type: 1, x: 0, z: 0, yaw: 0 },
    { id: 1, type: 2, x: -0.7070351, z: -0.3651944, yaw: 0 },
    { id: 2, type: 2, x: 0.66796494, z: 0.6061714, yaw: -89.999998 }
  ],
  // level18.csv provides the authored front-vehicle blocker lists.
  vehicleDepthes: LEVEL18_VEHICLE_DEPTHES,
  passengerSequence: PASSENGER_SEQUENCE,
  // level18.asset provides fixed passenger entries for both DualQueue2 queues.
  passengerQueues: LEVEL18_PASSENGER_QUEUES,
  assets: {
    loopScene: '/assets/runtime/Loop_02_q80.webp',
    loopSpriteRect: { x: 0, y: 57, width: 2100, height: 1243, imageWidth: 2100, imageHeight: 1300 },
    background: '/assets/runtime/textures/BG01_split01_q60.jpg',
    audio: {
      bus_hit: {
        clips: ['/assets/unity/audio/bus_hit_V5.mp3'],
        volume: 0.503268
      },
      passenger_up: {
        clips: [
          '/assets/unity/audio/passenger_up_01.mp3',
          '/assets/unity/audio/passenger_up_02.mp3',
          '/assets/unity/audio/passenger_up_03.mp3'
        ],
        volume: 0.825528
      },
      bus_full: {
        clips: ['/assets/unity/audio/bus_full.mp3'],
        volume: 0.50023913
      }
    },
    colorTextures: [
      '/assets/runtime/textures/color_0_blue_q85.webp',
      '/assets/runtime/textures/color_1_green_q85.webp',
      '/assets/runtime/textures/color_2_pink_q85.webp',
      '/assets/runtime/textures/color_3_purple_q85.webp',
      '/assets/runtime/textures/color_4_red_q85.webp',
      '/assets/runtime/textures/color_5_yellow_q85.webp',
      '/assets/runtime/textures/color_6_orange_q85.webp',
      '/assets/runtime/textures/color_7_lightblue_q85.webp',
      '/assets/runtime/textures/color_8_brown_q85.webp',
      '/assets/runtime/textures/color_9_darkgreen_q85.webp',
      '/assets/runtime/textures/color_10_darkblue_q85.webp'
    ],
    models: {
      passengerVatMesh: '/assets/unity/models/Idle_boy01_vatmesh.bin',
      passengerVatTexture: '/assets/unity/models/Idle_boy01_anim_map.rgba16f',
      shadow: '/assets/unity/models/Shadow_01.fbx',
      arrow: '/assets/unity/models/Arrow_01.fbx',
      parkingSpot: '/assets/unity/models/Car_P.fbx',
      garage: '/assets/unity/models/Truck_01.fbx',
      vehicleBySeats: {
        4: '/assets/unity/models/Car_001.fbx',
        6: '/assets/unity/models/Van_001.fbx',
        10: '/assets/unity/models/Bus_001.fbx'
      },
      vehicleShadowBySeats: {
        4: '/assets/unity/models/Car_FakeShadow.fbx',
        6: '/assets/unity/models/Van_FakeShadow.fbx',
        10: '/assets/unity/models/Bus_FakeShadow.fbx'
      }
    },
    textures: {
      shadow: '/assets/unity/textures/Shadow_01.png',
      parkingSpot: '/assets/unity/textures/Car_P2.png',
      seatCountBoard: '/assets/unity/textures/count_al.png',
      garage: {
        body: '/assets/unity/textures/Truck_Main_DarkBlue.png',
        metalMatcap: '/assets/unity/textures/Truck_Metal_Matcap.png'
      },
      effects: {
        aboardSmoke: '/assets/unity/effects/Round_01.png',
        ribbon: '/assets/unity/effects/Ribbon_01.png',
        ribbonSmoke: '/assets/runtime/effects/Smoke_08_q80.webp',
        hitCircle: '/assets/unity/effects/Circle_01.png',
        hitRound2: '/assets/runtime/effects/Round_02_q80.webp',
        hitRound1: '/assets/unity/effects/Round_01.png',
        smokeTrail: '/assets/unity/effects/Round_01.png'
      },
      vehicleShadowBySeats: {
        4: '/assets/unity/textures/Car_FakeShadow.png',
        6: '/assets/unity/textures/Van_FakeShadow.png',
        10: '/assets/unity/textures/Bus_FakeShadow.png'
      }
    },
    passengerAnimations: {
      textureWidth: 512,
      textureHeight: 128,
      move: { uvMin: 0.00390625, uvMax: 0.15234375, duration: 0.60000014 },
      idle: { uvMin: 0.15234375, uvMax: 0.62109375, duration: 2 }
    }
  },
  // Dreamteck spline overrides from GameSceneDualQueue2.prefab.
  splinePoints: [
    [-0.8212245, 15.494487], [-0.6354121, 15.661096], [-0.42046472, 15.735908],
    [-0.17919716, 15.77747], [0.053118944, 15.787669], [0.28579113, 15.765001],
    [0.52796626, 15.715597], [0.7419717, 15.592928], [0.8692199, 15.390943],
    [0.8745683, 15.120195], [0.7092973, 14.91469], [0.49285337, 14.816255],
    [0.25666875, 14.771048], [0.026976904, 14.763357], [-0.18797053, 14.771669],
    [-0.44673413, 14.801695], [-0.6660774, 14.884888], [-0.8289872, 15.029538],
    [-0.8942264, 15.262102]
  ],
  queuePaths: [
    [
      [-1.1523999, 15.670884], [-1.3029, 15.742984], [-1.4361999, 15.832043],
      [-1.5436999, 15.950794], [-1.6211, 16.090746], [-1.6812999, 16.27311],
      [-1.7156999, 16.455479], [-1.7544, 16.680248], [-1.7844999, 16.858372],
      [-1.806, 17.006807], [-1.8232, 17.248547], [-1.8489999, 17.375778],
      [-1.8705, 17.63024], [-1.9049, 17.825327], [-1.9478999, 18.00345],
      [-1.9951999, 18.177332], [-2.0683, 18.346973], [-2.1844, 18.465721],
      [-2.3091, 18.563267], [-2.4596, 18.635365]
    ],
    [
      [1.1394999, 15.666645], [1.29, 15.747223], [1.4232999, 15.836285],
      [1.5264999, 15.950794], [1.6082, 16.099228], [1.6683999, 16.27311],
      [1.7113999, 16.476679], [1.7458, 16.676008], [1.7716, 16.858372],
      [1.7974, 17.083147], [1.8232, 17.2231], [1.8403999, 17.3885],
      [1.8661999, 17.592072], [1.8963, 17.816845], [1.9350001, 17.994968],
      [1.9866, 18.181572], [2.064, 18.346973], [2.1715, 18.465721],
      [2.3091, 18.563267], [2.4596, 18.631124]
    ]
  ]
});
