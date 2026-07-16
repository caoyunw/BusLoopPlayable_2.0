const EPSILON = 1e-6;

export function poseToObb({ x, z, yaw, width, length }) {
  const radians = yaw * Math.PI / 180;
  return {
    center: { x, z },
    axes: [
      { x: Math.cos(radians), z: -Math.sin(radians) },
      { x: Math.sin(radians), z: Math.cos(radians) }
    ],
    half: [width / 2, length / 2]
  };
}

function projectObb(obb, axis) {
  const center = obb.center.x * axis.x + obb.center.z * axis.z;
  const radius = obb.half[0]
    * Math.abs(obb.axes[0].x * axis.x + obb.axes[0].z * axis.z)
    + obb.half[1]
    * Math.abs(obb.axes[1].x * axis.x + obb.axes[1].z * axis.z);
  return { min: center - radius, max: center + radius };
}

export function obbOverlaps(a, b, epsilon = EPSILON) {
  return [...a.axes, ...b.axes].every((axis) => {
    const pa = projectObb(a, axis);
    const pb = projectObb(b, axis);
    return pa.max >= pb.min - epsilon && pb.max >= pa.min - epsilon;
  });
}

export function segmentRoadObb(from, to, width) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length <= EPSILON) return null;
  return poseToObb({
    x: (from.x + to.x) / 2,
    z: (from.z + to.z) / 2,
    yaw: Math.atan2(dx, dz) * 180 / Math.PI,
    width,
    length
  });
}

function orientation(a, b, c) {
  const cross = (b.x - a.x) * (c.z - a.z)
    - (b.z - a.z) * (c.x - a.x);
  if (Math.abs(cross) <= EPSILON) return 0;
  return Math.sign(cross);
}

function pointOnSegment(point, from, to) {
  return point.x >= Math.min(from.x, to.x) - EPSILON
    && point.x <= Math.max(from.x, to.x) + EPSILON
    && point.z >= Math.min(from.z, to.z) - EPSILON
    && point.z <= Math.max(from.z, to.z) + EPSILON;
}

export function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (abC === 0 && pointOnSegment(c, a, b)) return true;
  if (abD === 0 && pointOnSegment(d, a, b)) return true;
  if (cdA === 0 && pointOnSegment(a, c, d)) return true;
  if (cdB === 0 && pointOnSegment(b, c, d)) return true;
  return abC !== abD && cdA !== cdB;
}
