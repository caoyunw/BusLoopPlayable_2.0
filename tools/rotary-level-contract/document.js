export const FORMAT = 'level.rotary.v1';

export const COORDINATES = Object.freeze({
  plane: 'xz',
  unit: 'level-unit',
  yaw: 'degrees',
  geometryProfile: 'busloop-level18-rotary.v1'
});

export function normalizeYaw(value) {
  const yaw = Number(value);
  if (!Number.isFinite(yaw)) return yaw;
  return ((yaw + 180) % 360 + 360) % 360 - 180;
}

export function cloneValue(value) {
  return structuredClone(value);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])])
  );
}

export function canonicalStringify(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function createEmptyDocument({ documentId, target, context }) {
  return {
    format: FORMAT,
    documentId,
    target: {
      ...target,
      contextFingerprint: target.contextFingerprint ?? `sha256:${'0'.repeat(64)}`
    },
    coordinates: { ...COORDINATES },
    vehicles: [],
    rotaryLanes: [],
    context: cloneValue(context)
  };
}
