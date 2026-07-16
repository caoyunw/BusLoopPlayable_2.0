import {
  poseToObb,
  segmentRoadObb
} from '../rotary-level-contract/geometry.js';

const COLOR_SWATCHES = [
  '#f0b44d',
  '#4f8cf7',
  '#ef6461',
  '#5ec28b',
  '#a778e8',
  '#e77db5',
  '#65c6cf',
  '#d6d95b'
];

export function worldToScreen({ x, z }, camera) {
  return {
    x: camera.width / 2 + (x - camera.centerX) * camera.zoom,
    y: camera.height / 2 - (z - camera.centerZ) * camera.zoom
  };
}

export function screenToWorld({ x, y }, camera) {
  return {
    x: camera.centerX + (x - camera.width / 2) / camera.zoom,
    z: camera.centerZ - (y - camera.height / 2) / camera.zoom
  };
}

function findSlot(document, laneId, slotId) {
  return document.rotaryLanes
    .find(({ id }) => id === laneId)
    ?.slots.find(({ id }) => id === slotId);
}

export function getVehiclePose(vehicle, document) {
  if (vehicle.placement.kind === 'field') return vehicle.placement;
  if (vehicle.placement.kind === 'garage') return vehicle.placement.storedPose;
  if (vehicle.placement.kind === 'rotary-slot') {
    const slot = findSlot(
      document,
      vehicle.placement.laneId,
      vehicle.placement.slotId
    );
    if (!slot) {
      throw new Error(
        `Unknown slot ${vehicle.placement.laneId}/${vehicle.placement.slotId}`
      );
    }
    return slot;
  }
  throw new Error(`Unknown placement kind ${vehicle.placement.kind}`);
}

function obbCorners(obb) {
  const corners = [];
  for (const firstSign of [-1, 1]) {
    for (const secondSign of [-1, 1]) {
      corners.push({
        x: obb.center.x
          + obb.axes[0].x * obb.half[0] * firstSign
          + obb.axes[1].x * obb.half[1] * secondSign,
        z: obb.center.z
          + obb.axes[0].z * obb.half[0] * firstSign
          + obb.axes[1].z * obb.half[1] * secondSign
      });
    }
  }
  return corners;
}

function validPose(pose) {
  return pose
    && Number.isFinite(pose.x)
    && Number.isFinite(pose.z)
    && Number.isFinite(pose.yaw);
}

function validSize(value) {
  return value
    && Number.isFinite(value.width)
    && value.width > 0
    && Number.isFinite(value.length)
    && value.length > 0;
}

function contextGeometry(document) {
  const entries = [];
  const append = (value, source, index, forceProtected = false) => {
    if (!validPose(value) || !validSize(value)) return;
    entries.push({
      id: value.id,
      kind: value.kind ?? source,
      label: value.label ?? `${source} ${value.id}`,
      source,
      sourceIndex: index,
      pose: { x: value.x, z: value.z, yaw: value.yaw },
      width: value.width,
      length: value.length,
      protected: forceProtected || value.protected === true,
      obb: poseToObb(value)
    });
  };
  (document.context?.garages ?? []).forEach((value, index) => {
    append(value, 'garage', index, true);
  });
  for (const source of ['parkingSpots', 'conveyors', 'protectedGeometry']) {
    (document.context?.[source] ?? []).forEach((value, index) => {
      append(value, source, index, source === 'protectedGeometry');
    });
  }
  return entries;
}

function selectionKey(selection) {
  if (selection.type === 'slot') {
    return `slot:${selection.laneId}:${selection.slotId ?? selection.id}`;
  }
  return `${selection.type}:${selection.id}`;
}

function buildErrorLookup(validation) {
  const lookup = {
    vehicles: new Set(),
    lanes: new Set(),
    slots: new Set(),
    context: new Set()
  };
  for (const entry of validation?.errors ?? []) {
    const id = String(entry.objectId);
    if (entry.objectType === 'vehicle') lookup.vehicles.add(id);
    else if (entry.objectType === 'lane') lookup.lanes.add(id);
    else if (entry.objectType === 'slot') lookup.slots.add(id);
    else lookup.context.add(`${entry.objectType}:${id}`);
  }
  return lookup;
}

export function buildCanvasModel(
  document,
  validation = { errors: [], warnings: [] },
  selection = [],
  draftLane = null
) {
  const selected = new Set(selection.map(selectionKey));
  const errorIds = buildErrorLookup(validation);
  const contextObbs = contextGeometry(document).map((entry) => ({
    ...entry,
    error: errorIds.context.has(`${entry.kind}:${entry.id}`)
  }));
  const roadSegments = [];
  const slots = [];
  const roadWidth = document.context?.rotaryRoadWidth ?? 0.42;

  for (const lane of document.rotaryLanes) {
    lane.slots.forEach((slot, slotIndex) => {
      slots.push({
        id: slot.id,
        laneId: lane.id,
        slotIndex,
        pose: slot,
        selected: selected.has(`slot:${lane.id}:${slot.id}`)
          || selected.has(`lane:${lane.id}`),
        error: errorIds.slots.has(String(slot.id))
          || errorIds.lanes.has(String(lane.id))
      });
      if (lane.slots.length < 2) return;
      const to = lane.slots[(slotIndex + 1) % lane.slots.length];
      const obb = segmentRoadObb(slot, to, roadWidth);
      if (!obb) return;
      roadSegments.push({
        laneId: lane.id,
        segmentIndex: slotIndex,
        from: slot,
        to,
        width: roadWidth,
        obb,
        selected: selected.has(`lane:${lane.id}`),
        error: errorIds.lanes.has(String(lane.id))
      });
    });
  }

  const vehicles = document.vehicles.map((vehicle) => {
    const pose = getVehiclePose(vehicle, document);
    const footprint = document.context?.vehicleFootprints?.[vehicle.seats];
    if (!validPose(pose) || !validSize(footprint)) {
      throw new Error(`Vehicle ${vehicle.id} has no renderable pose or footprint`);
    }
    return {
      id: vehicle.id,
      vehicle,
      pose,
      footprint,
      obb: poseToObb({ ...pose, ...footprint }),
      selected: selected.has(`vehicle:${vehicle.id}`),
      error: errorIds.vehicles.has(String(vehicle.id))
    };
  });

  const draftPoints = Array.isArray(draftLane)
    ? draftLane
    : draftLane?.points ?? [];
  return {
    document,
    contextObbs,
    roadSegments,
    slots,
    vehicles,
    selection: structuredClone(selection),
    errorIds,
    draftPoints: structuredClone(draftPoints),
    marquee: draftLane?.marquee ?? null
  };
}

export function computeDocumentBounds(document) {
  const points = [];
  for (const vehicle of document.vehicles ?? []) {
    const footprint = document.context?.vehicleFootprints?.[vehicle.seats];
    if (!validSize(footprint)) continue;
    let pose;
    try {
      pose = getVehiclePose(vehicle, document);
    } catch {
      continue;
    }
    if (!validPose(pose)) continue;
    points.push(...obbCorners(poseToObb({ ...pose, ...footprint })));
  }
  for (const lane of document.rotaryLanes ?? []) {
    for (const slot of lane.slots ?? []) {
      if (Number.isFinite(slot.x) && Number.isFinite(slot.z)) {
        points.push({ x: slot.x, z: slot.z });
      }
    }
  }
  for (const entry of contextGeometry(document)) {
    points.push(...obbCorners(entry.obb));
  }
  if (points.length === 0) {
    return { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
  }
  return {
    minX: Math.min(...points.map(({ x }) => x)) - 0.5,
    maxX: Math.max(...points.map(({ x }) => x)) + 0.5,
    minZ: Math.min(...points.map(({ z }) => z)) - 0.5,
    maxZ: Math.max(...points.map(({ z }) => z)) + 0.5
  };
}

function centerDistanceSquared(point, center) {
  return (point.x - center.x) ** 2 + (point.z - center.z) ** 2;
}

function pointInObb(point, obb, tolerance = 0) {
  const dx = point.x - obb.center.x;
  const dz = point.z - obb.center.z;
  return obb.axes.every((axis, index) => (
    Math.abs(dx * axis.x + dz * axis.z) <= obb.half[index] + tolerance
  ));
}

function distanceToSegmentSquared(point, from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return centerDistanceSquared(point, from);
  const ratio = Math.max(0, Math.min(1, (
    (point.x - from.x) * dx + (point.z - from.z) * dz
  ) / lengthSquared));
  return centerDistanceSquared(point, {
    x: from.x + dx * ratio,
    z: from.z + dz * ratio
  });
}

function closest(items, distance) {
  return [...items].sort((a, b) => distance(a) - distance(b))[0] ?? null;
}

export function hitTestEditorPoint(point, model, tolerance = 0.08) {
  const vehicle = closest(
    model.vehicles.filter(({ obb }) => pointInObb(point, obb, tolerance)),
    ({ pose }) => centerDistanceSquared(point, pose)
  );
  if (vehicle) return { type: 'vehicle', id: vehicle.id };

  const slot = closest(
    model.slots.filter(({ pose }) => (
      centerDistanceSquared(point, pose) <= tolerance ** 2
    )),
    ({ pose }) => centerDistanceSquared(point, pose)
  );
  if (slot) return { type: 'slot', laneId: slot.laneId, id: slot.id };

  const road = closest(
    model.roadSegments.filter((segment) => (
      distanceToSegmentSquared(point, segment.from, segment.to)
        <= (segment.width / 2 + tolerance) ** 2
    )),
    ({ from, to }) => centerDistanceSquared(point, {
      x: (from.x + to.x) / 2,
      z: (from.z + to.z) / 2
    })
  );
  if (road) return { type: 'lane', id: road.laneId };

  const context = closest(
    model.contextObbs.filter(({ obb }) => pointInObb(point, obb, tolerance)),
    ({ pose }) => centerDistanceSquared(point, pose)
  );
  if (context) {
    return { type: 'context', kind: context.kind, id: context.id };
  }
  return null;
}

export function hitTestMarquee(rect, model) {
  const normalized = {
    minX: Math.min(rect.minX ?? rect.x1, rect.maxX ?? rect.x2),
    maxX: Math.max(rect.minX ?? rect.x1, rect.maxX ?? rect.x2),
    minZ: Math.min(rect.minZ ?? rect.z1, rect.maxZ ?? rect.z2),
    maxZ: Math.max(rect.minZ ?? rect.z1, rect.maxZ ?? rect.z2)
  };
  const includes = ({ x, z }) => x >= normalized.minX
    && x <= normalized.maxX
    && z >= normalized.minZ
    && z <= normalized.maxZ;
  return [
    ...model.vehicles
      .filter(({ pose }) => includes(pose))
      .map(({ id }) => ({ type: 'vehicle', id })),
    ...model.slots
      .filter(({ pose }) => includes(pose))
      .map(({ id, laneId }) => ({ type: 'slot', laneId, id }))
  ];
}

function withSaved(context2d, draw) {
  context2d.save();
  try {
    draw();
  } finally {
    context2d.restore();
  }
}

function traceScreenPolygon(context2d, points, camera) {
  points.forEach((point, index) => {
    const screen = worldToScreen(point, camera);
    if (index === 0) context2d.moveTo(screen.x, screen.y);
    else context2d.lineTo(screen.x, screen.y);
  });
  context2d.closePath();
}

function orderedObbCorners(obb) {
  const [first, second] = obb.axes;
  const [firstHalf, secondHalf] = obb.half;
  return [
    { x: obb.center.x - first.x * firstHalf - second.x * secondHalf,
      z: obb.center.z - first.z * firstHalf - second.z * secondHalf },
    { x: obb.center.x + first.x * firstHalf - second.x * secondHalf,
      z: obb.center.z + first.z * firstHalf - second.z * secondHalf },
    { x: obb.center.x + first.x * firstHalf + second.x * secondHalf,
      z: obb.center.z + first.z * firstHalf + second.z * secondHalf },
    { x: obb.center.x - first.x * firstHalf + second.x * secondHalf,
      z: obb.center.z - first.z * firstHalf + second.z * secondHalf }
  ];
}

function drawGrid(context2d, camera, gridStep) {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld({ x: camera.width, y: camera.height }, camera);
  const minX = Math.floor(topLeft.x / gridStep) * gridStep;
  const maxX = Math.ceil(bottomRight.x / gridStep) * gridStep;
  const minZ = Math.floor(bottomRight.z / gridStep) * gridStep;
  const maxZ = Math.ceil(topLeft.z / gridStep) * gridStep;
  context2d.lineWidth = 1;
  for (let x = minX, count = 0; x <= maxX && count < 1000; x += gridStep, count += 1) {
    const from = worldToScreen({ x, z: minZ }, camera);
    const to = worldToScreen({ x, z: maxZ }, camera);
    context2d.strokeStyle = Math.abs(x % (gridStep * 4)) < 1e-6
      ? '#2c3546'
      : '#232b39';
    context2d.beginPath();
    context2d.moveTo(from.x, from.y);
    context2d.lineTo(to.x, to.y);
    context2d.stroke();
  }
  for (let z = minZ, count = 0; z <= maxZ && count < 1000; z += gridStep, count += 1) {
    const from = worldToScreen({ x: minX, z }, camera);
    const to = worldToScreen({ x: maxX, z }, camera);
    context2d.strokeStyle = Math.abs(z % (gridStep * 4)) < 1e-6
      ? '#2c3546'
      : '#232b39';
    context2d.beginPath();
    context2d.moveTo(from.x, from.y);
    context2d.lineTo(to.x, to.y);
    context2d.stroke();
  }
}

function drawObb(context2d, entry, camera, fill, stroke) {
  context2d.beginPath();
  traceScreenPolygon(context2d, orderedObbCorners(entry.obb), camera);
  if (fill) {
    context2d.fillStyle = fill;
    context2d.fill();
  }
  if (stroke) {
    context2d.strokeStyle = stroke;
    context2d.stroke();
  }
}

export function drawEditorCanvas(
  context2d,
  model,
  camera,
  options = {}
) {
  const gridStep = options.gridStep ?? 0.25;
  withSaved(context2d, () => {
    context2d.setTransform(1, 0, 0, 1, 0, 0);
    context2d.clearRect(
      0,
      0,
      context2d.canvas?.width ?? camera.width,
      context2d.canvas?.height ?? camera.height
    );
  });

  withSaved(context2d, () => {
    context2d.fillStyle = '#18202c';
    context2d.fillRect(0, 0, camera.width, camera.height);
    drawGrid(context2d, camera, gridStep);
  });

  withSaved(context2d, () => {
    context2d.lineWidth = 1.5;
    for (const entry of model.contextObbs) {
      drawObb(
        context2d,
        entry,
        camera,
        entry.protected ? 'rgba(209, 93, 105, 0.18)' : 'rgba(124, 145, 172, 0.16)',
        entry.protected ? '#a35b66' : '#5b6d85'
      );
    }
  });

  withSaved(context2d, () => {
    context2d.lineCap = 'round';
    context2d.lineJoin = 'round';
    for (const segment of model.roadSegments) {
      const from = worldToScreen(segment.from, camera);
      const to = worldToScreen(segment.to, camera);
      context2d.strokeStyle = segment.selected ? '#65c6cf' : '#46566c';
      context2d.lineWidth = Math.max(3, segment.width * camera.zoom);
      context2d.beginPath();
      context2d.moveTo(from.x, from.y);
      context2d.lineTo(to.x, to.y);
      context2d.stroke();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      context2d.fillStyle = '#91a3b9';
      context2d.beginPath();
      context2d.moveTo(
        middle.x + Math.cos(angle) * 7,
        middle.y + Math.sin(angle) * 7
      );
      context2d.lineTo(
        middle.x + Math.cos(angle + 2.5) * 5,
        middle.y + Math.sin(angle + 2.5) * 5
      );
      context2d.lineTo(
        middle.x + Math.cos(angle - 2.5) * 5,
        middle.y + Math.sin(angle - 2.5) * 5
      );
      context2d.closePath();
      context2d.fill();
    }
  });

  withSaved(context2d, () => {
    for (const slot of model.slots) {
      const center = worldToScreen(slot.pose, camera);
      context2d.beginPath();
      context2d.arc(center.x, center.y, Math.max(4, camera.zoom * 0.055), 0, Math.PI * 2);
      context2d.fillStyle = '#202b39';
      context2d.fill();
      context2d.strokeStyle = slot.selected ? '#7de0e5' : '#9eb0c6';
      context2d.lineWidth = slot.selected ? 3 : 1.5;
      context2d.stroke();
    }
  });

  withSaved(context2d, () => {
    for (const vehicle of model.vehicles) {
      drawObb(
        context2d,
        vehicle,
        camera,
        COLOR_SWATCHES[Math.abs(vehicle.vehicle.colorIndex) % COLOR_SWATCHES.length],
        '#111822'
      );
      const center = worldToScreen(vehicle.pose, camera);
      const radians = vehicle.pose.yaw * Math.PI / 180;
      context2d.strokeStyle = '#17202b';
      context2d.lineWidth = 2;
      context2d.beginPath();
      context2d.moveTo(center.x, center.y);
      context2d.lineTo(
        center.x + Math.sin(radians) * vehicle.footprint.length * camera.zoom * 0.42,
        center.y - Math.cos(radians) * vehicle.footprint.length * camera.zoom * 0.42
      );
      context2d.stroke();
    }
  });

  withSaved(context2d, () => {
    context2d.strokeStyle = '#6ee7ef';
    context2d.lineWidth = 2.5;
    context2d.setLineDash([6, 4]);
    for (const entry of [...model.vehicles, ...model.slots]) {
      if (!entry.selected) continue;
      if (entry.obb) drawObb(context2d, entry, camera, null, '#6ee7ef');
      else {
        const center = worldToScreen(entry.pose, camera);
        context2d.strokeRect(center.x - 8, center.y - 8, 16, 16);
      }
    }
    if (model.marquee) {
      const first = worldToScreen(
        { x: model.marquee.minX, z: model.marquee.maxZ },
        camera
      );
      const second = worldToScreen(
        { x: model.marquee.maxX, z: model.marquee.minZ },
        camera
      );
      context2d.strokeRect(
        first.x,
        first.y,
        second.x - first.x,
        second.y - first.y
      );
    }
  });

  withSaved(context2d, () => {
    if (model.draftPoints.length === 0) return;
    context2d.strokeStyle = '#f0b44d';
    context2d.fillStyle = '#f0b44d';
    context2d.lineWidth = 2;
    context2d.setLineDash([5, 4]);
    context2d.beginPath();
    model.draftPoints.forEach((point, index) => {
      const screen = worldToScreen(point, camera);
      if (index === 0) context2d.moveTo(screen.x, screen.y);
      else context2d.lineTo(screen.x, screen.y);
    });
    context2d.stroke();
    for (const point of model.draftPoints) {
      const screen = worldToScreen(point, camera);
      context2d.beginPath();
      context2d.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
      context2d.fill();
    }
  });

  withSaved(context2d, () => {
    context2d.strokeStyle = '#ff4f64';
    context2d.lineWidth = 3;
    context2d.setLineDash([]);
    for (const entry of [...model.contextObbs, ...model.vehicles]) {
      if (entry.error) drawObb(context2d, entry, camera, null, '#ff4f64');
    }
    for (const entry of model.slots) {
      if (!entry.error) continue;
      const center = worldToScreen(entry.pose, camera);
      context2d.beginPath();
      context2d.arc(center.x, center.y, 10, 0, Math.PI * 2);
      context2d.stroke();
    }
    for (const segment of model.roadSegments) {
      if (!segment.error) continue;
      const from = worldToScreen(segment.from, camera);
      const to = worldToScreen(segment.to, camera);
      context2d.beginPath();
      context2d.moveTo(from.x, from.y);
      context2d.lineTo(to.x, to.y);
      context2d.stroke();
    }
  });
}

export function resizeCanvas(canvas, cssWidth, cssHeight, devicePixelRatio = 1) {
  const ratio = Math.max(1, Number(devicePixelRatio) || 1);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const context2d = canvas.getContext('2d');
  context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context2d;
}
