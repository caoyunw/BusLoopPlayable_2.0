import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { COLORS, LEVEL_1, PASSENGER_COUNT_BOARD_COLORS } from './level-data.js';
import { SCENE_TUNING } from './scene-tuning.js';
import { VehicleEffects } from './vehicle-effects.js';
import {
  calculateDesignCoverHalfHeight,
  calculateOrthographicHalfHeight,
  calculatePerspectiveDistance,
  resolveCameraFit,
  resolveResponsiveCropFit,
  transformCurveCoordinates
} from './scene-layout.js';
import {
  UNITY_CURVES,
  UNITY_VEHICLE_MOTION,
  chooseHitClip,
  evaluatePath,
  evaluateUnityCurve,
  forwardFromYaw,
  sampleHitClip,
  buildRoundedPath,
  buildToStationPoints,
  buildOutStationPoints
} from './vehicle-motion.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);
const deg = (value) => THREE.MathUtils.degToRad(value);
const ARROW_OUTLINE_SCALE = 1.28;
const GUIDE_HAND_TEXTURE_URL = '/assets/runtime/main-guide-hand_q80.webp';
const QUESTION_PASSENGER_REVEAL_DURATION = 0.25;
const PASSENGER_DEFAULT_MATERIAL_COLORS = Object.freeze([
  { baseColor: 0xffffff, emissionColor: 0x36a6ff },
  { baseColor: 0xffffff, emissionColor: 0xadd98a },
  { baseColor: 0xff6331, emissionColor: 0xd445ac },
  { baseColor: 0xffffff, emissionColor: 0xc474fd },
  { baseColor: 0xffffff, emissionColor: 0xc57272 },
  { baseColor: 0xffffff, emissionColor: 0xa49584 },
  { baseColor: 0xffffff, emissionColor: 0xc09d9d },
  { baseColor: 0xffffff, emissionColor: 0x65c1e2 },
  { baseColor: 0xffffff, emissionColor: 0xd68c8c },
  { baseColor: 0xffffff, emissionColor: 0x4a4a4a },
  { baseColor: 0xffffff, emissionColor: 0x8b7caf }
]);
const scratchPassengerBaseColor = new THREE.Color();
const scratchPassengerEmissionColor = new THREE.Color();

function setPassengerMaterialMaps(material, map, emissiveMap) {
  const nextMap = map ?? null;
  const nextEmissiveMap = emissiveMap ?? null;
  const mapChanged = material.map !== nextMap || material.emissiveMap !== nextEmissiveMap;
  material.map = nextMap;
  material.emissiveMap = nextEmissiveMap;
  if (mapChanged) material.needsUpdate = true;
}

function directionalLightDirection(eulerDegrees) {
  return new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(
      deg(eulerDegrees.x ?? 0),
      deg(eulerDegrees.y ?? 0),
      deg(eulerDegrees.z ?? 0),
      'XYZ'
    ))
    .normalize();
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] ??= {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function rotateVehicleAreaPoint(x, z) {
  const area = SCENE_TUNING.vehicleArea;
  const rotation = deg(area.rotationDegrees);
  const deltaX = x - area.pivotX;
  const deltaZ = z - area.pivotZ;
  return new THREE.Vector2(
    area.pivotX + deltaX * Math.cos(rotation) - deltaZ * Math.sin(rotation),
    area.pivotZ + deltaX * Math.sin(rotation) + deltaZ * Math.cos(rotation)
  );
}

function mapVehicleAreaPoint(vehicle) {
  const area = SCENE_TUNING.vehicleArea;
  const unitScale = area.positionUnitScale ?? LEVEL_1.mapScale;
  const scaledX = (vehicle.x - area.positionPivotX) * unitScale + area.positionPivotX;
  const scaledZ = (vehicle.z - area.positionPivotZ) * unitScale + area.positionPivotZ;
  const unityX = area.sourceRootX + scaledX;
  const unityZ = area.sourceRootZ + scaledZ;
  return rotateVehicleAreaPoint(
    unityX * area.unityToWorldScale + area.offsetX,
    unityZ * area.unityToWorldScale * (area.mirrorZ ? -1 : 1) + area.offsetZ
  );
}

function mapMotionPoint(value, y = SCENE_TUNING.vehicleArea.y) {
  const mapped = mapVehicleAreaPoint(value);
  return new THREE.Vector3(mapped.x, y, mapped.y);
}

function mapMotionTangentYaw(tangent, reverse = false) {
  const direction = reverse ? { x: -tangent.x, z: -tangent.z } : tangent;
  const sourceYaw = Math.atan2(direction.x, direction.z) * 180 / Math.PI;
  return mapVehicleAreaYaw(sourceYaw) + deg(SCENE_TUNING.facing.vehicleYawOffsetDegrees);
}

function mapVehicleAreaYaw(yawDegrees) {
  const sourceYaw = deg(yawDegrees);
  const mirroredYaw = SCENE_TUNING.vehicleArea.mirrorZ ? Math.PI - sourceYaw : sourceYaw;
  return mirroredYaw + deg(SCENE_TUNING.vehicleArea.rotationDegrees);
}

function toWorldPoint([x, z]) {
  const tuning = SCENE_TUNING.path;
  return new THREE.Vector3(
    x * tuning.scaleX + tuning.offsetX,
    tuning.groundY,
    (tuning.centerZ - z) * tuning.scaleZ + tuning.offsetZ
  );
}
function makeTunedCurvePoints(points, tuning, anchorMode) {
  const worldPoints = points.map((point) => toWorldPoint(point));
  const coordinates = transformCurveCoordinates(worldPoints, tuning, anchorMode);
  return worldPoints.map((point, index) => new THREE.Vector3(
    coordinates[index].x,
    point.y,
    coordinates[index].z
  ));
}

function cloneCurvePoint(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function makeOpenCurve(points) {
  const curvePoints = points.length >= 2
    ? points.map(cloneCurvePoint)
    : [cloneCurvePoint(points[0] ?? new THREE.Vector3()), cloneCurvePoint(points[0] ?? new THREE.Vector3())];
  return new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.35);
}

function makeSubCurve(curve, startProgress, endProgress) {
  const start = THREE.MathUtils.clamp(startProgress, 0, 1);
  const end = THREE.MathUtils.clamp(endProgress, start, 1);
  const samples = Math.max(8, Math.ceil((end - start) * 36));
  const points = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = start + (end - start) * (i / samples);
    points.push(curve.getPointAt(t));
  }
  return makeOpenCurve(points);
}


function configureColorTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function applyPassengerUnityMaterial(material, colorIndex, map) {
  const materialTuning = SCENE_TUNING.passengerMaterial ?? {};
  const colorTuning = materialTuning.colors?.[colorIndex] ?? {};
  const defaults = PASSENGER_DEFAULT_MATERIAL_COLORS[colorIndex] ?? PASSENGER_DEFAULT_MATERIAL_COLORS[0];
  const baseStrength = THREE.MathUtils.clamp(materialTuning.baseColorStrength ?? 1, 0, 2);
  const brightness = THREE.MathUtils.clamp(materialTuning.brightness ?? 1, 0, 3);
  const emissionStrength = THREE.MathUtils.clamp(materialTuning.emissionStrength ?? 1, 0, 5);
  scratchPassengerBaseColor.setHex(colorTuning.baseColor ?? defaults.baseColor);
  scratchPassengerEmissionColor.setHex(colorTuning.emissionColor ?? defaults.emissionColor);
  setPassengerMaterialMaps(material, map, map);
  material.color.setRGB(
    THREE.MathUtils.clamp(THREE.MathUtils.lerp(1, scratchPassengerBaseColor.r, baseStrength) * brightness, 0, 3),
    THREE.MathUtils.clamp(THREE.MathUtils.lerp(1, scratchPassengerBaseColor.g, baseStrength) * brightness, 0, 3),
    THREE.MathUtils.clamp(THREE.MathUtils.lerp(1, scratchPassengerBaseColor.b, baseStrength) * brightness, 0, 3)
  );
  material.emissive.copy(scratchPassengerEmissionColor);
  material.emissiveIntensity = emissionStrength;
  material.roughness = materialTuning.roughness ?? 0.58;
  material.metalness = materialTuning.metalness ?? 0;
  material.userData.passengerColorIndex = colorIndex;
}

function applyPassengerSolidMaterial(material, colorIndex) {
  const materialTuning = SCENE_TUNING.passengerMaterial ?? {};
  const defaults = PASSENGER_DEFAULT_MATERIAL_COLORS[colorIndex] ?? PASSENGER_DEFAULT_MATERIAL_COLORS[0];
  const solidColor = materialTuning.solidColors?.[colorIndex] ?? defaults.emissionColor;
  const brightness = THREE.MathUtils.clamp(materialTuning.brightness ?? 1, 0, 3);
  const emissionStrength = THREE.MathUtils.clamp(materialTuning.emissionStrength ?? 1, 0, 5);
  scratchPassengerBaseColor.setHex(solidColor);
  setPassengerMaterialMaps(material, null, null);
  material.color.setRGB(
    THREE.MathUtils.clamp(scratchPassengerBaseColor.r * brightness, 0, 3),
    THREE.MathUtils.clamp(scratchPassengerBaseColor.g * brightness, 0, 3),
    THREE.MathUtils.clamp(scratchPassengerBaseColor.b * brightness, 0, 3)
  );
  material.emissive.copy(scratchPassengerBaseColor);
  material.emissiveIntensity = emissionStrength;
  material.roughness = materialTuning.roughness ?? 0.58;
  material.metalness = materialTuning.metalness ?? 0;
  material.userData.passengerColorIndex = colorIndex;
}

function applyPassengerMaterial(material, colorIndex, map) {
  if (SCENE_TUNING.passengerMaterial?.mode === 'solidColor') {
    applyPassengerSolidMaterial(material, colorIndex);
  } else {
    applyPassengerUnityMaterial(material, colorIndex, map);
  }
}

function applyQuestionPassengerMaterial(material) {
  setPassengerMaterialMaps(material, null, null);
  material.color.setHex(0x9da8b8);
  material.emissive.setHex(0x303946);
  material.emissiveIntensity = 0.18;
  material.roughness = 0.72;
  material.metalness = 0;
  material.userData.passengerColorIndex = null;
}

async function loadVatGeometry(url, loadingManager) {
  loadingManager?.itemStart(url);
  let buffer;
  try {
    buffer = await fetch(url).then((response) => {
      if (!response.ok) throw new Error(`VAT mesh request failed: ${response.status}`);
      return response.arrayBuffer();
    });
    loadingManager?.itemEnd(url);
  } catch (error) {
    loadingManager?.itemError(url);
    loadingManager?.itemEnd(url);
    throw error;
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== 'VATM' || view.getUint32(4, true) !== 1) {
    throw new Error('Unsupported VAT mesh binary.');
  }
  const vertexCount = view.getUint32(8, true);
  const indexCount = view.getUint32(12, true);
  let offset = 16;
  const readFloatArray = (length) => {
    const values = new Float32Array(length);
    for (let i = 0; i < length; i += 1, offset += 4) values[i] = view.getFloat32(offset, true);
    return values;
  };
  const position = readFloatArray(vertexCount * 3);
  const normal = readFloatArray(vertexCount * 3);
  const uv = readFloatArray(vertexCount * 2);
  const index = new Uint32Array(indexCount);
  for (let i = 0; i < indexCount; i += 1, offset += 4) index[i] = view.getUint32(offset, true);
  const vatIndex = Float32Array.from({ length: vertexCount }, (_, indexValue) => indexValue);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('vatIndex', new THREE.BufferAttribute(vatIndex, 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

async function loadVatTexture(url, width, height, loadingManager) {
  loadingManager?.itemStart(url);
  let buffer;
  try {
    buffer = await fetch(url).then((response) => {
      if (!response.ok) throw new Error(`VAT texture request failed: ${response.status}`);
      return response.arrayBuffer();
    });
    loadingManager?.itemEnd(url);
  } catch (error) {
    loadingManager?.itemError(url);
    loadingManager?.itemEnd(url);
    throw error;
  }
  if (buffer.byteLength !== width * height * 8) throw new Error('Unexpected VAT texture size.');
  const texture = new THREE.DataTexture(
    new Uint16Array(buffer),
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function setMaterial(root, material, meshFilter = null) {
  const meshes = [];
  root.traverse((child) => {
    if (!child.isMesh || (meshFilter && !meshFilter(child))) return;
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = false;
    meshes.push(child);
  });
  return meshes;
}

function getSourceMaterialNames(material) {
  const materials = Array.isArray(material) ? material : [material];
  return materials.map((entry) => entry?.name ?? '').filter(Boolean);
}

function isGarageMetalMaterialName(name) {
  return /metal|matcap/i.test(name);
}

function applyGarageMaterials(root, materials) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const sourceNames = child.userData.sourceMaterialNames ?? [];
    if (sourceNames.length > 1 || child.geometry?.groups?.length > 0) {
      child.material = sourceNames.map((name) => (
        isGarageMetalMaterialName(name) ? materials.metal : materials.body
      ));
      if (child.material.length === 0) child.material = materials.body;
    } else {
      const sourceName = sourceNames[0] ?? child.userData.sourceMaterialName ?? '';
      child.material = isGarageMetalMaterialName(sourceName) ? materials.metal : materials.body;
    }
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

function applyGarageModelOrientation(root) {
  root.rotation.x = deg(SCENE_TUNING.facing.garageModelPitchDegrees ?? 0);
  root.rotation.z = deg(SCENE_TUNING.facing.garageModelRollDegrees ?? 0);
  root.updateMatrixWorld(true);
  return root;
}

function storeHitBase(object) {
  object.userData.hitBasePosition = object.position.clone();
  object.userData.hitBaseRotation = object.rotation.clone();
}

function applyArrowOutlineTuning(root, { color = 0x171717, scale = ARROW_OUTLINE_SCALE, depthTest = false } = {}) {
  root?.traverse?.((child) => {
    if ((!child.isMesh && !child.isLineSegments) || !child.userData.isArrowOutline) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.color?.setHex(color);
      material.depthTest = Boolean(depthTest);
      if ('linewidth' in material) material.linewidth = Math.max(1, scale);
      material.needsUpdate = true;
    }
    if (child.userData.outlineBaseScale) {
      child.scale.copy(child.userData.outlineBaseScale).multiplyScalar(scale);
    }
  });
}

function addArrowOutline(root, tuning = {}) {
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: tuning.color ?? 0x171717,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: Boolean(tuning.depthTest),
    toneMapped: false
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: tuning.color ?? 0x171717,
    depthWrite: false,
    depthTest: Boolean(tuning.depthTest),
    toneMapped: false
  });
  const outlines = [];
  root.traverse((child) => {
    if (!child.isMesh || child.userData.isArrowOutline) return;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 25), edgeMaterial);
    outlines.push({
      parent: child.parent,
      mesh: child,
      shell: new THREE.Mesh(child.geometry, shellMaterial),
      edge
    });
  });
  for (const { parent, mesh, shell, edge } of outlines) {
    const baseScale = mesh.scale.clone();
    shell.name = `${mesh.name || 'Arrow'}_OutlineShell`;
    shell.position.copy(mesh.position);
    shell.quaternion.copy(mesh.quaternion);
    shell.userData.outlineBaseScale = baseScale.clone();
    shell.scale.copy(shell.userData.outlineBaseScale).multiplyScalar(tuning.scale ?? ARROW_OUTLINE_SCALE);
    shell.renderOrder = mesh.renderOrder - 1;
    shell.userData.isArrowOutline = true;
    edge.name = `${mesh.name || 'Arrow'}_OutlineEdge`;
    edge.position.copy(mesh.position);
    edge.quaternion.copy(mesh.quaternion);
    edge.userData.outlineBaseScale = baseScale.clone();
    edge.scale.copy(edge.userData.outlineBaseScale).multiplyScalar(tuning.scale ?? ARROW_OUTLINE_SCALE);
    edge.renderOrder = mesh.renderOrder + 2;
    edge.userData.isArrowOutline = true;
    mesh.renderOrder += 1;
    parent.add(shell, edge);
  }
  applyArrowOutlineTuning(root, tuning);
}

function toStaticMeshGroup(source) {
  const root = new THREE.Group();
  source.updateMatrixWorld(true);
  source.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry.clone();
    if (child.isSkinnedMesh && geometry.attributes.skinIndex) {
      child.skeleton.update();
      const position = geometry.attributes.position;
      const vertex = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 1) {
        vertex.fromBufferAttribute(position, i);
        child.applyBoneTransform(i, vertex);
        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      position.needsUpdate = true;
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
    }
    geometry.applyMatrix4(child.matrixWorld);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry);
    mesh.name = child.name;
    const sourceMaterialNames = getSourceMaterialNames(child.material);
    mesh.userData.sourceMaterialNames = sourceMaterialNames;
    mesh.userData.sourceMaterialName = sourceMaterialNames[0] ?? '';
    root.add(mesh);
  });
  return root;
}

function normalizeObject(root, targets) {
  root.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const ratios = [];
  if (targets.width) ratios.push(targets.width / Math.max(size.x, 0.0001));
  if (targets.height) ratios.push(targets.height / Math.max(size.y, 0.0001));
  if (targets.depth) ratios.push(targets.depth / Math.max(size.z, 0.0001));
  const scale = Math.min(...ratios);
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= bounds.min.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
  root.userData.fittedSize = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return root;
}

function makeVehiclePlaceholder(vehicle) {
  const root = new THREE.Group();
  root.userData.vehicleId = vehicle.id;
  const material = new THREE.MeshStandardMaterial({
    color: COLORS[vehicle.colorIndex].hex,
    roughness: 0.42
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 1.28), material);
  body.position.y = 0.25;
  body.userData.vehicleId = vehicle.id;
  root.add(body);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 3),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.62, 0.1);
  arrow.userData.vehicleId = vehicle.id;
  root.add(arrow);
  root.userData.bodyMeshes = [body];
  root.userData.hitMeshes = [body, arrow];
  storeHitBase(body);
  storeHitBase(arrow);
  return root;
}

let questionPassengerBadgeTexture = null;
let questionPassengerRevealTexture = null;

function getQuestionPassengerBadgeTexture() {
  if (questionPassengerBadgeTexture) return questionPassengerBadgeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const center = canvas.width / 2;
    context.beginPath();
    context.arc(center, center, 45, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = '#263244';
    context.stroke();
    context.fillStyle = '#263244';
    context.font = '900 72px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('?', center, center + 4);
  }
  questionPassengerBadgeTexture = new THREE.CanvasTexture(canvas);
  questionPassengerBadgeTexture.colorSpace = THREE.SRGBColorSpace;
  questionPassengerBadgeTexture.needsUpdate = true;
  return questionPassengerBadgeTexture;
}

function makeQuestionPassengerBadges(spacing) {
  const badges = [];
  for (let index = 0; index < 4; index += 1) {
    const material = new THREE.SpriteMaterial({
      map: getQuestionPassengerBadgeTexture(),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set((index - 1.5) * spacing, 0.58, 0.08);
    sprite.scale.set(0.2, 0.2, 1);
    sprite.renderOrder = 90;
    sprite.visible = false;
    badges.push(sprite);
  }
  return badges;
}

function getQuestionPassengerRevealTexture() {
  if (questionPassengerRevealTexture) return questionPassengerRevealTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const center = canvas.width / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.72)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  questionPassengerRevealTexture = new THREE.CanvasTexture(canvas);
  questionPassengerRevealTexture.colorSpace = THREE.SRGBColorSpace;
  questionPassengerRevealTexture.needsUpdate = true;
  return questionPassengerRevealTexture;
}

function makeQuestionPassengerRevealFlash() {
  const material = new THREE.SpriteMaterial({
    map: getQuestionPassengerRevealTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 0.36, 0.06);
  sprite.scale.set(0.72, 0.72, 1);
  sprite.renderOrder = 89;
  sprite.visible = false;
  sprite.userData.questionRevealBaseScale = 0.72;
  return sprite;
}

function makeStarBadgeLabel({ width = 96, height = 96, scaleX = 0.18, scaleY = 0.18 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 84;
  return { canvas, texture, sprite };
}

function drawStarBadgeCount(label, value) {
  const context = label.canvas.getContext('2d');
  if (!context) return;
  const centerX = label.canvas.width / 2;
  const centerY = label.canvas.height / 2;
  context.clearRect(0, 0, label.canvas.width, label.canvas.height);
  context.beginPath();
  context.arc(centerX, centerY, 32, 0, Math.PI * 2);
  context.fillStyle = '#e45139';
  context.fill();
  context.lineWidth = 9;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '900 48px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), centerX, centerY + 2);
  if (label.texture) label.texture.needsUpdate = true;
}

function drawStarBadgeDecrement(label) {
  const context = label.canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, label.canvas.width, label.canvas.height);
  context.font = '900 52px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = '#ffffff';
  context.strokeText('-1', label.canvas.width / 2, label.canvas.height / 2);
  context.fillStyle = '#ef653e';
  context.fillText('-1', label.canvas.width / 2, label.canvas.height / 2);
  if (label.texture) label.texture.needsUpdate = true;
}

function makeStarBadge() {
  const shape = new THREE.Shape();
  const outerRadius = 0.15;
  const innerRadius = 0.065;
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const root = new THREE.Group();
  const badge = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: 0xffce42,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    })
  );
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, 0.58, -0.02);
  badge.renderOrder = 80;
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.575, -0.02);
  halo.renderOrder = 79;
  const countLabel = makeStarBadgeLabel();
  countLabel.sprite.position.set(0.12, 0.66, 0.02);
  countLabel.sprite.visible = false;

  const decrementLabel = makeStarBadgeLabel({ width: 128, height: 96, scaleX: 0.24, scaleY: 0.18 });
  drawStarBadgeDecrement(decrementLabel);
  decrementLabel.sprite.position.set(0.28, 0.63, 0.02);
  decrementLabel.sprite.visible = false;

  root.add(halo, badge, countLabel.sprite, decrementLabel.sprite);
  root.userData.starMesh = badge;
  root.userData.haloMesh = halo;
  root.userData.starBadgeCountSprite = countLabel.sprite;
  root.userData.starBadgeCountLabel = countLabel;
  root.userData.starBadgeDecrementSprite = decrementLabel.sprite;
  root.userData.starBadgePassengerId = null;
  root.userData.starBadgeRemainingPasses = null;
  root.userData.starBadgeDecrementVersion = null;
  root.userData.starBadgeDecrementStartedAt = -Infinity;
  root.visible = false;
  return root;
}

function makePassengerGroup(groupScale) {
  const group = new THREE.Group();
  group.scale.setScalar(groupScale);
  group.userData.questionRevealBaseScale = groupScale;
  group.userData.personSlots = [];
  const spacing = SCENE_TUNING.passengers.groupSpacing;
  for (let i = 0; i < 4; i += 1) {
    const slot = new THREE.Group();
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.16, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 })
    );
    fallback.position.y = 0.2;
    slot.add(fallback);
    slot.userData.fallback = fallback;
    slot.position.set((i - 1.5) * spacing, 0, 0);
    group.userData.personSlots.push(slot);
    group.add(slot);
  }
  const questionBadges = makeQuestionPassengerBadges(spacing);
  group.userData.questionBadges = questionBadges;
  group.add(...questionBadges);
  const questionRevealFlash = makeQuestionPassengerRevealFlash();
  group.userData.questionRevealFlash = questionRevealFlash;
  group.add(questionRevealFlash);
  group.userData.questionPassengerId = null;
  group.userData.questionPassengerRevealVersion = null;
  group.userData.questionPassengerRevealStartedAt = -Infinity;
  const starBadge = makeStarBadge();
  group.userData.starBadge = starBadge;
  group.add(starBadge);
  return group;
}

export class SceneView {
  constructor(canvas, onVehicleClick, hooks = {}) {
    this.canvas = canvas;
    this.onVehicleClick = onVehicleClick;
    this.hooks = hooks;
    this.reducedMotionQuery = typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xc9d7ed, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(SCENE_TUNING.camera.fovDegrees, 1, 0.1, 1000);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (_url, loaded, total) => {
      this.hooks.onLoadingProgress?.(total > 0 ? loaded / total : 0);
    };
    this.loadingManager.onLoad = () => {
      this.hooks.onLoadingProgress?.(1);
    };
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.fbxLoader = new FBXLoader(this.loadingManager);
    this.vehicleViews = new Map();
    this.garageViews = new Map();
    this.passengerViews = [];
    this.queuePassengerViews = [[], []];
    this.spotRoots = [];
    this.spotPositions = [];
    this.seatCountBoards = [];
    this.passengerMaterials = [];
    this.passengerColorTextures = [];
    this.vehicleMaterials = [];
    this.vehicleColorTextures = [];
    this.vatTimeUniform = { value: 0 };
    this.boardingViews = [];
    this.vehicleBoardingPulses = new Map();
    this.initialEntryPathStates = new Map();
    this.queueEntryPathStates = new Map();
    this.lastBoardingEventId = 0;
    this.vehicleEffects = null;
    this.guideHand = null;
    this.guideHandMaterial = null;
    this.vehiclePathLines = [];
    this.vehicleDeparturePathLines = [];
    this.lastSnapshot = null;
    this.lastSeenResetVersion = null;
    this.lastGame = null;
    this.buildWorld();
    this.applyTuning();
    this.ready = this.loadUnityAssets();
    window.addEventListener('resize', () => this.resize());
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    canvas.addEventListener('pointerup', (event) => this.pick(event));
  }

  buildWorld() {
    this.hemisphereLight = new THREE.HemisphereLight();
    this.directionalLight = new THREE.DirectionalLight();
    this.directionalLight.name = 'Directional Light';
    this.directionalLightTarget = new THREE.Object3D();
    this.directionalLightTarget.name = 'Directional Light Target';
    this.directionalLight.target = this.directionalLightTarget;
    this.scene.add(
      this.hemisphereLight,
      this.directionalLight,
      this.directionalLightTarget
    );
    this.applySceneLighting();


    this.backgroundPlane = this.makeArtworkPlane(LEVEL_1.assets.background);
    this.backgroundPlane.rotation.set(0, 0, 0);
    this.backgroundPlane.material.depthWrite = false;
    this.backgroundPlane.renderOrder = -100;
    this.loopPlane = this.makeArtworkPlane(LEVEL_1.assets.loopScene, LEVEL_1.assets.loopSpriteRect);
    this.camera.add(this.backgroundPlane);
    this.scene.add(this.camera, this.loopPlane);
    this.buildPathCurves();
    this.buildSpots();
    this.buildGuideHand();

    for (const vehicle of LEVEL_1.vehicles) {
      const view = makeVehiclePlaceholder(vehicle);
      this.vehicleViews.set(vehicle.id, view);
      this.scene.add(view);
    }
    for (let i = 0; i < LEVEL_1.conveyorCapacity; i += 1) {
      const view = makePassengerGroup(SCENE_TUNING.passengers.modelScale);
      view.visible = false;
      this.passengerViews.push(view);
      this.scene.add(view);
    }
    for (let queueIndex = 0; queueIndex < LEVEL_1.queueCount; queueIndex += 1) {
      for (let i = 0; i < LEVEL_1.queueCapacity; i += 1) {
        const view = makePassengerGroup(SCENE_TUNING.passengers.modelScale);
        view.visible = false;
        this.queuePassengerViews[queueIndex].push(view);
        this.scene.add(view);
      }
    }
  }

  makeArtworkPlane(url, uvRect = null) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.02,
      blending: THREE.NormalBlending,
      fog: false,
      side: THREE.DoubleSide
    });
    this.textureLoader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      if (uvRect) {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(uvRect.width / uvRect.imageWidth, uvRect.height / uvRect.imageHeight);
        texture.offset.set(uvRect.x / uvRect.imageWidth, uvRect.y / uvRect.imageHeight);
      }
      material.map = texture;
      material.needsUpdate = true;
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    plane.rotation.x = -Math.PI / 2;
    return plane;
  }

  buildGuideHand() {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: SCENE_TUNING.vehicleGuideHand.opacity ?? 1
    });
    material.map = this.textureLoader.load(GUIDE_HAND_TEXTURE_URL, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1000;
    sprite.visible = false;
    this.guideHand = sprite;
    this.guideHandMaterial = material;
    this.scene.add(sprite);
  }

  buildPathCurves() {
    this.curve = new THREE.CatmullRomCurve3(
      makeTunedCurvePoints(LEVEL_1.splinePoints, SCENE_TUNING.conveyorCurve, 'center'),
      true,
      'catmullrom',
      0.35
    );
    this.fullQueueCurves = LEVEL_1.queuePaths.map((path, index) => (
      makeOpenCurve(makeTunedCurvePoints(path, SCENE_TUNING.queueCurves[index], 'entry'))
    ));
    this.updateQueueCurvesForCamera();
  }

  updateQueueCurvesForCamera() {
    const previous = this.queueCurves;
    this.queueCurves = this.fullQueueCurves.map((curve) => this.makeVisibleQueueCurve(curve));
    if (previous && this.lastSnapshot?.time === 0) this.initialEntryPathStates.clear();
  }

  makeVisibleQueueCurve(curve) {
    if (!curve) return null;
    const length = Math.max(0.0001, curve.getLength());
    const queueConfig = LEVEL_1.passengerQueue ?? {};
    const spacing = queueConfig.spacing ?? 0.4;
    const extraDistance = (queueConfig.screenEdgeOffsetSpacing ?? 4) * spacing;
    const isInScreen = (point) => {
      const projected = point.clone().project(this.camera);
      return projected.z >= -1 && projected.z <= 1
        && projected.x >= -1 && projected.x <= 1
        && projected.y >= -1 && projected.y <= 1;
    };
    if (!isInScreen(curve.getPointAt(0))) return curve;

    let low = 0;
    let high = 1;
    let lastInside = 0;
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) * 0.5;
      if (isInScreen(curve.getPointAt(mid))) {
        lastInside = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    const tailProgress = Math.min(1, lastInside + extraDistance / length);
    return makeSubCurve(curve, 0, tailProgress);
  }

  buildSpots() {
    for (let i = 0; i < SCENE_TUNING.parkingSpots.count; i += 1) {
      const root = new THREE.Group();
      const board = this.createSeatCountBoard();
      board.visible = false;
      board.renderOrder = 40;
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.04, 1.42),
        new THREE.MeshStandardMaterial({ color: 0xb6a9cb, roughness: 0.76 })
      );
      fallback.position.y = 0.02;
      root.add(fallback, board);
      this.spotRoots.push(root);
      this.spotPositions.push(new THREE.Vector3());
      this.seatCountBoards.push(board);
      this.scene.add(root);
    }
  }


  clearVehiclePathLines() {
    for (const line of [...this.vehiclePathLines, ...this.vehicleDeparturePathLines]) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.vehiclePathLines.length = 0;
    this.vehicleDeparturePathLines.length = 0;
  }

  makeVehiclePathLine(path, material, y = SCENE_TUNING.vehiclePath.y) {
    const points = [];
    const samples = Math.max(8, Math.ceil(path.length / 0.08));
    for (let i = 0; i <= samples; i += 1) {
      const sample = evaluatePath(path, path.length * (i / samples));
      const position = mapMotionPoint(sample.position, y);
      points.push(position);
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material.clone());
    line.renderOrder = 80;
    line.frustumCulled = false;
    return line;
  }

  updateVehiclePathPreview(snapshot = this.lastSnapshot, game = this.lastGame) {
    this.clearVehiclePathLines();
    if (!snapshot || !game) return;
    const tuning = SCENE_TUNING.vehiclePath;
    if (tuning?.enabled) {
      const spotIndex = snapshot.spots.findIndex((spot) => spot.vehicleId === null);
      if (spotIndex >= 0) {
        const target = game.getSpotPosition(spotIndex);
        const baseMaterial = new THREE.LineBasicMaterial({
          color: tuning.color ?? 0x20f6ff,
          transparent: true,
          opacity: tuning.opacity ?? 0.88,
          linewidth: tuning.lineWidth ?? 3,
          depthTest: false,
          depthWrite: false
        });
        for (const vehicle of snapshot.vehicles) {
          if (vehicle.state !== 'parked') continue;
          const blockers = game.getBlockers(vehicle.id);
          if (blockers.length && !tuning.showBlocked) continue;
          const points = buildToStationPoints(vehicle, target, tuning);
          const path = buildRoundedPath(points, tuning);
          const line = this.makeVehiclePathLine(path, baseMaterial, tuning.y);
          line.material.opacity = blockers.length ? (tuning.opacity ?? 0.88) * 0.35 : (tuning.opacity ?? 0.88);
          this.vehiclePathLines.push(line);
          this.scene.add(line);
        }
        baseMaterial.dispose();
      }
    }
    this.updateVehicleDeparturePathPreview(snapshot, game);
  }

  updateVehicleDeparturePathPreview(snapshot = this.lastSnapshot, game = this.lastGame) {
    const tuning = SCENE_TUNING.vehicleDeparturePath;
    if (!tuning?.enabled || !snapshot || !game) return;
    const baseMaterial = new THREE.LineBasicMaterial({
      color: tuning.color ?? 0xffc857,
      transparent: true,
      opacity: tuning.opacity ?? 0.88,
      linewidth: tuning.lineWidth ?? 3,
      depthTest: false,
      depthWrite: false
    });
    for (const spot of snapshot.spots) {
      if (spot.vehicleId === null) continue;
      const target = game.getSpotPosition(spot.index);
      const backwardPath = buildRoundedPath(buildOutStationPoints(target, tuning), tuning);
      const forwardStart = backwardPath.segments.at(-1)?.p1 ?? target;
      const forwardPath = buildRoundedPath([
        forwardStart,
        { x: tuning.exitTargetX ?? 4.2, z: forwardStart.z + (tuning.exitTargetZOffset ?? 0) }
      ], tuning);
      for (const path of [backwardPath, forwardPath]) {
        const line = this.makeVehiclePathLine(path, baseMaterial, tuning.y);
        this.vehicleDeparturePathLines.push(line);
        this.scene.add(line);
      }
    }
    baseMaterial.dispose();
  }
  createSeatCountBoard() {
    const group = new THREE.Group();
    const boardMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMaterial);
    board.rotation.x = -Math.PI / 2;
    board.position.y = 0.028;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const text = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    }));
    text.position.set(0, 0.052, 0);
    text.scale.set(0.42, 0.26, 1);
    group.userData.textSprite = text;

    group.add(board, text);
    group.userData.boardMesh = board;
    group.userData.textCanvas = canvas;
    group.userData.textTexture = texture;
    return group;
  }

  createGarageCountLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    }));
    sprite.renderOrder = 55;
    sprite.scale.set(0.45, 0.45, 1);
    sprite.userData.textCanvas = canvas;
    sprite.userData.textTexture = texture;
    sprite.userData.value = null;
    return sprite;
  }

  updateGarageCountLabel(label, value) {
    if (label.userData.value === value) return;
    label.userData.value = value;
    const canvas = label.userData.textCanvas;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.arc(64, 64, 46, 0, Math.PI * 2);
    context.fillStyle = '#f5d85f';
    context.fill();
    context.lineWidth = 9;
    context.strokeStyle = '#7a3e2d';
    context.stroke();
    context.font = '900 58px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 8;
    context.strokeStyle = '#7a3e2d';
    context.fillStyle = '#ffffff';
    context.strokeText(String(value), 64, 66);
    context.fillText(String(value), 64, 66);
    label.userData.textTexture.needsUpdate = true;
  }

  makeGarageFallback() {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.45, 1.15),
      new THREE.MeshStandardMaterial({ color: 0x914949, roughness: 0.62 })
    );
    body.position.y = 0.225;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x5c2f2f, roughness: 0.7 })
    );
    door.position.set(0, 0.22, 0.595);
    root.add(body, door);
    return root;
  }

  createGarageView(garage) {
    const root = new THREE.Group();
    const model = this.garageTemplate
      ? this.garageTemplate.clone(true)
      : this.makeGarageFallback();
    const label = this.createGarageCountLabel();
    label.position.set(0, 0.88, 0.02);
    root.add(model, label);
    root.userData.model = model;
    root.userData.countLabel = label;
    root.userData.garageId = garage.id;
    this.scene.add(root);
    return root;
  }

  updateGarages(snapshot) {
    const activeIds = new Set();
    for (const garage of snapshot.garages ?? []) {
      activeIds.add(garage.id);
      let view = this.garageViews.get(garage.id);
      if (!view) {
        view = this.createGarageView(garage);
        this.garageViews.set(garage.id, view);
      }
      const mapped = mapVehicleAreaPoint(garage.position);
      view.position.set(mapped.x, SCENE_TUNING.vehicleArea.y, mapped.y);
      view.rotation.y = mapVehicleAreaYaw(garage.yaw) + deg(SCENE_TUNING.facing.garageYawOffsetDegrees ?? 0);
      view.visible = !garage.hidden;
      this.updateGarageCountLabel(view.userData.countLabel, garage.displayCount);
    }
    for (const [id, view] of this.garageViews) {
      if (activeIds.has(id)) continue;
      this.scene.remove(view);
      this.garageViews.delete(id);
    }
  }

  async loadUnityAssets() {
    try {
      const modelPaths = LEVEL_1.assets.models;
      const vehiclePaths = modelPaths.vehicleBySeats;
      const [
        passengerVatGeometry,
        passengerVatTexture,
        shadowFbx,
        arrowFbx,
        carFbx,
        vanFbx,
        busFbx,
        parkingFbx,
        carShadowFbx,
        vanShadowFbx,
        busShadowFbx,
        garageFbx,
        shadowTexture,
        parkingTexture,
        seatCountBoardTexture,
        garageBodyTexture,
        garageMetalMatcapTexture,
        carShadowTexture,
        vanShadowTexture,
        busShadowTexture,
        aboardSmokeTexture,
        ribbonTexture,
        ribbonSmokeTexture,
        hitCircleTexture,
        hitRound2Texture,
        hitRound1Texture,
        smokeTrailTexture,
        ...colorTextures
      ] = await Promise.all([
        loadVatGeometry(modelPaths.passengerVatMesh, this.loadingManager),
        loadVatTexture(
          modelPaths.passengerVatTexture,
          LEVEL_1.assets.passengerAnimations.textureWidth,
          LEVEL_1.assets.passengerAnimations.textureHeight,
          this.loadingManager
        ),
        this.fbxLoader.loadAsync(modelPaths.shadow),
        this.fbxLoader.loadAsync(modelPaths.arrow),
        this.fbxLoader.loadAsync(vehiclePaths[4]),
        this.fbxLoader.loadAsync(vehiclePaths[6]),
        this.fbxLoader.loadAsync(vehiclePaths[10]),
        this.fbxLoader.loadAsync(modelPaths.parkingSpot),
        this.fbxLoader.loadAsync(modelPaths.vehicleShadowBySeats[4]),
        this.fbxLoader.loadAsync(modelPaths.vehicleShadowBySeats[6]),
        this.fbxLoader.loadAsync(modelPaths.vehicleShadowBySeats[10]),
        modelPaths.garage ? this.fbxLoader.loadAsync(modelPaths.garage).catch(() => null) : Promise.resolve(null),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.shadow),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.parkingSpot),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.seatCountBoard),
        LEVEL_1.assets.textures.garage?.body
          ? this.textureLoader.loadAsync(LEVEL_1.assets.textures.garage.body).catch(() => null)
          : Promise.resolve(null),
        LEVEL_1.assets.textures.garage?.metalMatcap
          ? this.textureLoader.loadAsync(LEVEL_1.assets.textures.garage.metalMatcap).catch(() => null)
          : Promise.resolve(null),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.vehicleShadowBySeats[4]),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.vehicleShadowBySeats[6]),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.vehicleShadowBySeats[10]),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.aboardSmoke),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.ribbon),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.ribbonSmoke),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.hitCircle),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.hitRound2),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.hitRound1),
        this.textureLoader.loadAsync(LEVEL_1.assets.textures.effects.smokeTrail),
        ...LEVEL_1.assets.colorTextures.map((path) => this.textureLoader.loadAsync(path))
      ]);

      this.vehicleColorTextures = colorTextures.map(configureColorTexture);
      this.passengerColorTextures = this.vehicleColorTextures;
      this.passengerVatTexture = passengerVatTexture;
      configureColorTexture(parkingTexture);
      configureColorTexture(seatCountBoardTexture);
      configureColorTexture(shadowTexture);
      if (garageBodyTexture) configureColorTexture(garageBodyTexture);
      if (garageMetalMatcapTexture) configureColorTexture(garageMetalMatcapTexture);
      [carShadowTexture, vanShadowTexture, busShadowTexture].forEach(configureColorTexture);
      [
        aboardSmokeTexture,
        ribbonTexture,
        ribbonSmokeTexture,
        hitCircleTexture,
        hitRound2Texture,
        hitRound1Texture,
        smokeTrailTexture
      ].forEach(configureColorTexture);
      this.vehicleEffects = new VehicleEffects({
        scene: this.scene,
        vehicleViews: this.vehicleViews,
        spotRoots: this.spotRoots,
        textures: {
          aboardSmoke: aboardSmokeTexture,
          ribbon: ribbonTexture,
          ribbonSmoke: ribbonSmokeTexture,
          hitCircle: hitCircleTexture,
          hitRound2: hitRound2Texture,
          hitRound1: hitRound1Texture,
          smokeTrail: smokeTrailTexture
        },
        effectsTuning: SCENE_TUNING.effects
      });
      this.passengerMaterials = this.passengerColorTextures.map((map, colorIndex) => {
        const material = new THREE.MeshStandardMaterial({
          roughness: 0.58,
          metalness: 0
        });
        applyPassengerMaterial(material, colorIndex, map);
        return material;
      });
      this.vehicleMaterials = this.vehicleColorTextures.map((map) => new THREE.MeshStandardMaterial({
        map,
        roughness: 0.58,
        metalness: 0
      }));
      this.shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: SCENE_TUNING.shadows.opacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.vehicleShadowMaterials = {
        4: new THREE.MeshBasicMaterial({ map: carShadowTexture, transparent: true, opacity: SCENE_TUNING.vehicleShadows.opacity, depthWrite: false, side: THREE.DoubleSide }),
        6: new THREE.MeshBasicMaterial({ map: vanShadowTexture, transparent: true, opacity: SCENE_TUNING.vehicleShadows.opacity, depthWrite: false, side: THREE.DoubleSide }),
        10: new THREE.MeshBasicMaterial({ map: busShadowTexture, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
      };
      this.parkingMaterial = new THREE.MeshStandardMaterial({
        map: parkingTexture,
        roughness: 0.68,
        transparent: true,
        alphaTest: 0.02
      });
      this.garageMaterials = {
        body: new THREE.MeshStandardMaterial({
          map: garageBodyTexture ?? null,
          color: 0xffffff,
          roughness: 0.58,
          metalness: 0,
          side: THREE.DoubleSide
        }),
        metal: garageMetalMatcapTexture
          ? new THREE.MeshMatcapMaterial({
            matcap: garageMetalMatcapTexture,
            color: 0xffffff,
            side: THREE.DoubleSide
          })
          : new THREE.MeshStandardMaterial({
            color: 0x71759a,
            roughness: 0.3,
            metalness: 0.45,
            side: THREE.DoubleSide
          })
      };
      this.seatCountBoardTexture = seatCountBoardTexture;

      const vatRoot = new THREE.Group();
      const vatMesh = new THREE.Mesh(passengerVatGeometry);
      vatMesh.userData.isVatPassenger = true;
      vatMesh.frustumCulled = false;
      vatRoot.add(vatMesh);
      this.personTemplate = normalizeObject(vatRoot, {
        height: SCENE_TUNING.passengers.modelHeight
      });
      this.shadowTemplate = normalizeObject(toStaticMeshGroup(shadowFbx), { width: 1, depth: 1.26 });
      this.arrowTemplate = normalizeObject(toStaticMeshGroup(arrowFbx), { depth: 0.56 });
      setMaterial(this.arrowTemplate, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      addArrowOutline(this.arrowTemplate, {
        color: SCENE_TUNING.vehicleArrow.outlineColor,
        scale: SCENE_TUNING.vehicleArrow.outlineScale,
        depthTest: SCENE_TUNING.vehicleArrow.outlineDepthTest
      });
      this.parkingTemplate = normalizeObject(toStaticMeshGroup(parkingFbx), {
        width: SCENE_TUNING.parkingSpots.modelWidth,
        depth: SCENE_TUNING.parkingSpots.modelDepth
      });
      setMaterial(this.parkingTemplate, this.parkingMaterial);
      if (garageFbx) {
        const garageStaticRoot = applyGarageModelOrientation(toStaticMeshGroup(garageFbx));
        this.garageTemplate = normalizeObject(garageStaticRoot, {
          width: 0.95,
          depth: 1.2
        });
        applyGarageMaterials(this.garageTemplate, this.garageMaterials);
      }

      this.vehicleTemplates = {
        4: this.prepareVehicleTemplate(carFbx, 4),
        6: this.prepareVehicleTemplate(vanFbx, 6),
        10: this.prepareVehicleTemplate(busFbx, 10)
      };
      this.vehicleShadowTemplates = {
        4: this.prepareVehicleShadowTemplate(carShadowFbx, 4),
        6: this.prepareVehicleShadowTemplate(vanShadowFbx, 6),
        10: this.prepareVehicleShadowTemplate(busShadowFbx, 10)
      };
      this.upgradePassengerViews();
      this.upgradeVehicleViews();
      this.upgradeSpotViews();
      for (const view of this.garageViews.values()) {
        view.userData.model?.removeFromParent?.();
        const model = this.garageTemplate ? this.garageTemplate.clone(true) : this.makeGarageFallback();
        view.userData.model = model;
        view.add(model);
      }
      this.applyTuning();
    } catch (error) {
      console.warn('Unity asset load failed; keeping geometric fallbacks.', error);
    }
  }

  prepareVehicleTemplate(source, seats) {
    const targetDepth = SCENE_TUNING.vehicleArea.modelDepthBySeats[seats] ?? 1.2;
    return normalizeObject(toStaticMeshGroup(source), { depth: targetDepth });
  }

  prepareVehicleShadowTemplate(source, seats) {
    const targetDepth = SCENE_TUNING.vehicleShadows.depthBySeats?.[seats]
      ?? SCENE_TUNING.vehicleArea.modelDepthBySeats[seats]
      ?? 1.2;
    return normalizeObject(toStaticMeshGroup(source), { depth: targetDepth });
  }

  createVatMaterial(colorIndex = 0) {
    const animation = LEVEL_1.assets.passengerAnimations;
    const idle = animation.idle;
    const clip = new THREE.Vector4(idle.uvMin, idle.uvMax, 1 / idle.duration, 0);
    const map = this.passengerColorTextures[colorIndex] ?? this.passengerColorTextures[0];
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.58,
      metalness: 0,
      side: THREE.DoubleSide
    });
    applyPassengerMaterial(material, colorIndex, map);
    material.userData.vat = { clip, clipName: null };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.vatMap = { value: this.passengerVatTexture };
      shader.uniforms.vatTime = this.vatTimeUniform;
      shader.uniforms.vatClip = { value: clip };
      shader.vertexShader = `
        uniform sampler2D vatMap;
        uniform float vatTime;
        uniform vec4 vatClip;
        attribute float vatIndex;
      ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          float vatPhase = fract(vatTime * vatClip.z + vatClip.w);
          float vatX = (vatIndex + 0.5) / ${animation.textureWidth.toFixed(1)};
          float vatY = mix(vatClip.x, vatClip.y, vatPhase)
            + 0.5 / ${animation.textureHeight.toFixed(1)};
          vec3 transformed = texture2D(vatMap, vec2(vatX, vatY)).xyz;
        `
      );
    };
    material.customProgramCacheKey = () => 'busloop-passenger-vat-v1';
    this.setVatAnimation(material, 'idle');
    return material;
  }

  setVatAnimation(material, clipName, normalizedPhase = 0) {
    const state = material?.userData?.vat;
    const clip = LEVEL_1.assets.passengerAnimations[clipName];
    if (!state || !clip || state.clipName === clipName) return;
    state.clipName = clipName;
    state.clip.set(
      clip.uvMin,
      clip.uvMax,
      1 / clip.duration,
      normalizedPhase - this.vatTimeUniform.value / clip.duration
    );
  }

  setPassengerAnimation(view, clipName, normalizedPhase = 0) {
    for (const slot of view.userData.personSlots) {
      this.setVatAnimation(slot.userData.vatMaterial, clipName, normalizedPhase);
    }
  }

  createPassengerVisual(colorIndex = 0, shadowKind = 'conveyor') {
    const root = new THREE.Group();
    const shadow = this.makeShadow(
      SCENE_TUNING.passengers.shadowScale,
      SCENE_TUNING.passengers.shadowScale * 1.2,
      shadowKind
    );
    const person = this.personTemplate.clone(true);
    const personPivot = new THREE.Group();
    personPivot.rotation.y = deg(SCENE_TUNING.facing.passengerModelYawDegrees);
    personPivot.position.y = SCENE_TUNING.shadows.y + 0.002;
    personPivot.add(person);
    const material = this.createVatMaterial(colorIndex);
    setMaterial(person, material);
    root.add(shadow, personPivot);
    root.userData.modelRoot = person;
    root.userData.modelPivot = personPivot;
    root.userData.vatMaterial = material;
    return root;
  }

  makeShadow(width, depth, kind = 'conveyor') {
    const shadow = this.shadowTemplate.clone(true);
    const tuning = SCENE_TUNING.passengerShadows[kind] ?? SCENE_TUNING.passengerShadows.conveyor;
    shadow.scale.set(width * tuning.scaleX, 1, depth * tuning.scaleZ / 1.26);
    setMaterial(shadow, this.shadowMaterial);
    shadow.traverse((object) => {
      if (object.isMesh) object.userData.isFakeShadow = true;
    });
    shadow.rotation.y = deg(SCENE_TUNING.facing.passengerShadowYawDegrees);
    shadow.position.set(tuning.offsetX, SCENE_TUNING.shadows.y, tuning.offsetZ);
    shadow.userData.passengerShadowKind = kind;
    shadow.userData.shadowBaseWidth = width;
    shadow.userData.shadowBaseDepth = depth;
    this.updatePassengerShadowObject(shadow);
    return shadow;
  }

  updatePassengerShadowObject(shadow) {
    const kind = shadow.userData.passengerShadowKind ?? 'conveyor';
    const tuning = SCENE_TUNING.passengerShadows[kind] ?? SCENE_TUNING.passengerShadows.conveyor;
    const width = shadow.userData.shadowBaseWidth ?? SCENE_TUNING.passengers.shadowScale;
    const depth = shadow.userData.shadowBaseDepth ?? SCENE_TUNING.passengers.shadowScale * 1.2;
    shadow.scale.set(width * tuning.scaleX, 1, depth * tuning.scaleZ / 1.26);
    shadow.position.set(tuning.offsetX, SCENE_TUNING.shadows.y, tuning.offsetZ);
  }

  updatePassengerVisualTuning() {
    const scale = SCENE_TUNING.passengers.modelScale;
    const spacing = SCENE_TUNING.passengers.groupSpacing;
    for (const root of [...this.passengerViews, ...this.queuePassengerViews.flat()]) {
      root.userData.questionRevealBaseScale = scale;
      root.scale.setScalar(scale);
      root.userData.personSlots?.forEach((slot, index) => {
        slot.position.x = (index - 1.5) * spacing;
      });
      root.userData.questionBadges?.forEach((badge, index) => {
        badge.position.x = (index - 1.5) * spacing;
      });
    }
    for (const entry of this.boardingViews) {
      entry.root.scale.setScalar(scale);
    }
    const roots = [
      ...this.passengerViews,
      ...this.queuePassengerViews.flat(),
      ...this.boardingViews.map((entry) => entry.root)
    ];
    for (const root of roots) {
      root.traverse((object) => {
        if (object.userData.passengerShadowKind) this.updatePassengerShadowObject(object);
      });
    }
  }

  updatePassengerMaterialTuning({ colorIndex: changedColorIndex = null } = {}) {
    const shouldUpdateColor = (colorIndex) => changedColorIndex == null || colorIndex === changedColorIndex;
    this.passengerMaterials?.forEach((material, colorIndex) => {
      if (!shouldUpdateColor(colorIndex)) return;
      const map = this.passengerColorTextures[colorIndex] ?? this.passengerColorTextures[0];
      applyPassengerMaterial(material, colorIndex, map);
    });

    const roots = [
      ...this.passengerViews,
      ...this.queuePassengerViews.flat(),
      ...this.boardingViews.map((entry) => entry.root)
    ];
    for (const root of roots) {
      if (root.userData.questionPassengerHidden === true) continue;
      const rootColorIndex = root.userData.colorIndex
        ?? root.userData.vatMaterial?.userData.passengerColorIndex
        ?? root.userData.personSlots
          ?.find((slot) => slot.userData.vatMaterial)
          ?.userData.vatMaterial.userData.passengerColorIndex
        ?? 0;
      if (!shouldUpdateColor(rootColorIndex)) continue;
      const map = this.passengerColorTextures[rootColorIndex] ?? this.passengerColorTextures[0];
      const materials = [
        root.userData.vatMaterial,
        ...(root.userData.personSlots ?? []).map((slot) => slot.userData.vatMaterial)
      ];
      for (const material of materials) {
        if (!material) continue;
        applyPassengerMaterial(material, rootColorIndex, map);
      }
      root.userData.questionPassengerHidden = null;
    }
  }

  upgradePassengerViews() {
    const allViews = [...this.passengerViews, ...this.queuePassengerViews.flat()];
    for (const view of allViews) {
      for (const slot of view.userData.personSlots) {
        slot.clear();
        const queueIndex = this.queuePassengerViews[0].includes(view) ? 0 : (this.queuePassengerViews[1].includes(view) ? 1 : -1);
        const shadowKind = queueIndex === 0 ? 'leftQueue' : (queueIndex === 1 ? 'rightQueue' : 'conveyor');
        const visual = this.createPassengerVisual(0, shadowKind);
        slot.add(visual);
        slot.userData.visualRoot = visual;
        slot.userData.modelRoot = visual.userData.modelRoot;
        slot.userData.vatMaterial = visual.userData.vatMaterial;
      }
      view.userData.modelReady = true;
      view.userData.colorIndex = null;
      view.userData.questionPassengerHidden = null;
    }
  }

  upgradeVehicleViews() {
    for (const vehicle of LEVEL_1.vehicles) {
      const view = this.vehicleViews.get(vehicle.id);
      const template = this.vehicleTemplates[vehicle.seats] ?? this.vehicleTemplates[10];
      const size = template.userData.fittedSize;
      const material = this.vehicleMaterials[vehicle.colorIndex].clone();
      view.clear();
      const shadow = this.makeVehicleShadow(vehicle.seats);
      const model = template.clone(true);
      const bodyMeshes = setMaterial(model, material);
      const arrow = this.arrowTemplate.clone(true);
      const hitRoot = new THREE.Group();
      this.applyVehicleArrowTuning(arrow, size);
      arrow.rotation.y = deg(SCENE_TUNING.facing.arrowYawDegrees);
      hitRoot.add(model, arrow);
      for (const child of [hitRoot, shadow]) {
        child.traverse((object) => { object.userData.vehicleId = vehicle.id; });
      }
      view.add(shadow, hitRoot);
      view.userData.bodyMeshes = bodyMeshes;
      view.userData.hitMeshes = [hitRoot];
      view.userData.modelRoot = model;
      view.userData.arrowRoot = arrow;
      view.userData.templateSize = size;
      view.userData.unityHitScale = size.z / .6785897;
      storeHitBase(hitRoot);
      view.userData.modelReady = true;
    }
  }

  applyVehicleArrowTuning(arrow, size) {
    const tuning = SCENE_TUNING.vehicleArrow;
    arrow.position.set(tuning.offsetX, size.y + tuning.offsetY, tuning.offsetZ);
    applyArrowOutlineTuning(arrow, {
      color: tuning.outlineColor,
      scale: tuning.outlineScale,
      depthTest: tuning.outlineDepthTest
    });
  }

  updateVehicleArrowTuning() {
    if (this.arrowTemplate) {
      applyArrowOutlineTuning(this.arrowTemplate, {
        color: SCENE_TUNING.vehicleArrow.outlineColor,
        scale: SCENE_TUNING.vehicleArrow.outlineScale,
        depthTest: SCENE_TUNING.vehicleArrow.outlineDepthTest
      });
    }
    for (const vehicle of LEVEL_1.vehicles) {
      const view = this.vehicleViews.get(vehicle.id);
      const arrow = view?.userData.arrowRoot;
      const size = view?.userData.templateSize;
      if (arrow && size) {
        this.applyVehicleArrowTuning(arrow, size);
        arrow.rotation.y = deg(SCENE_TUNING.facing.arrowYawDegrees);
      }
      const hitRoot = view?.userData.hitMeshes?.[0];
      if (hitRoot) storeHitBase(hitRoot);
    }
  }

  makeVehicleShadow(seats) {
    const template = this.vehicleShadowTemplates?.[seats] ?? this.vehicleShadowTemplates?.[10];
    if (!template) return this.makeShadow(1, 1, 'conveyor');
    const shadow = template.clone(true);
    const material = this.vehicleShadowMaterials?.[seats] ?? this.vehicleShadowMaterials?.[10];
    setMaterial(shadow, material);
    shadow.traverse((object) => {
      if (object.isMesh) object.userData.isFakeShadow = true;
    });
    shadow.position.y = SCENE_TUNING.vehicleShadows.y;
    const seatScale = SCENE_TUNING.vehicleShadows.scaleBySeats?.[seats] ?? {};
    shadow.scale.multiply(new THREE.Vector3(
      SCENE_TUNING.vehicleShadows.scaleX * (seatScale.x ?? 1),
      1,
      SCENE_TUNING.vehicleShadows.scaleZ * (seatScale.z ?? 1)
    ));
    return shadow;
  }

  upgradeSpotViews() {
    for (let index = 0; index < this.spotRoots.length; index += 1) {
      const root = this.spotRoots[index];
      const board = this.seatCountBoards[index];
      root.clear();
      root.add(this.parkingTemplate.clone(true), board);
      board.userData.boardMesh.material.map = this.seatCountBoardTexture;
      board.userData.boardMesh.material.needsUpdate = true;
    }
  }


  updateSeatCountBoard(board, vehicle, time = 0) {
    const baseRemaining = Math.max(0, vehicle.seats - vehicle.boardedGroups) * LEVEL_1.groupSize;
    let boardingRemaining = 0;
    for (const entry of this.boardingViews) {
      if (entry.vehicleId !== vehicle.id) continue;
      if (time < entry.startedAt + entry.delay + entry.duration) boardingRemaining += 1;
    }
    const remaining = Math.max(0, baseRemaining + boardingRemaining);
    const visible = (
      remaining > 0 &&
      (vehicle.state === 'at-spot' || vehicle.state === 'boarding-final')
    );
    const vehicleChanged = board.userData.vehicleId !== vehicle.id;
    board.visible = visible;
    if (!visible) {
      board.userData.vehicleId = null;
      board.userData.remaining = null;
      return;
    }
    if (
      !vehicleChanged &&
      board.userData.remaining === remaining &&
      board.userData.colorIndex === vehicle.colorIndex
    ) return;
    board.userData.vehicleId = vehicle.id;
    board.userData.remaining = remaining;
    board.userData.colorIndex = vehicle.colorIndex;

    const config = PASSENGER_COUNT_BOARD_COLORS[vehicle.colorIndex] ?? PASSENGER_COUNT_BOARD_COLORS[0];
    board.userData.boardMesh.material.color.setHex(config.background);

    const canvas = board.userData.textCanvas;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 112px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.miterLimit = 2;
    context.lineWidth = 18;
    context.strokeStyle = config.outline;
    context.fillStyle = '#ffffff';
    context.strokeText(String(remaining), canvas.width / 2, canvas.height / 2 + 2);
    context.fillText(String(remaining), canvas.width / 2, canvas.height / 2 + 2);
    board.userData.textTexture.needsUpdate = true;
  }

  setPassengerAppearance(view, colorIndex, hidden = false) {
    const questionPassengerHidden = Boolean(hidden);
    if (
      view.userData.colorIndex === colorIndex
      && view.userData.questionPassengerHidden === questionPassengerHidden
    ) return;
    view.userData.colorIndex = colorIndex;
    view.userData.questionPassengerHidden = questionPassengerHidden;
    this.setQuestionPassengerBadgesVisible(view, questionPassengerHidden);
    if (!view.userData.modelReady) {
      for (const slot of view.userData.personSlots) {
        const fallbackMaterial = slot.userData.fallback?.material;
        if (!fallbackMaterial) continue;
        if (questionPassengerHidden) {
          applyQuestionPassengerMaterial(fallbackMaterial);
        } else {
          setPassengerMaterialMaps(fallbackMaterial, null, null);
          fallbackMaterial.color.setHex(COLORS[colorIndex].hex);
          fallbackMaterial.emissive.setHex(0x000000);
          fallbackMaterial.emissiveIntensity = 0;
          fallbackMaterial.roughness = 0.62;
          fallbackMaterial.metalness = 0;
          fallbackMaterial.userData.passengerColorIndex = colorIndex;
        }
      }
      return;
    }
    for (const slot of view.userData.personSlots) {
      const material = slot.userData.vatMaterial;
      if (material) {
        if (questionPassengerHidden) {
          applyQuestionPassengerMaterial(material);
        } else {
          const map = this.passengerColorTextures[colorIndex] ?? this.passengerColorTextures[0];
          applyPassengerMaterial(material, colorIndex, map);
        }
      }
    }
  }

  setQuestionPassengerBadgesVisible(view, visible) {
    for (const badge of view.userData.questionBadges ?? []) {
      badge.visible = Boolean(visible);
      if (badge.material) badge.material.opacity = 1;
    }
  }

  updateQuestionPassengerReveal(view, state, time = 0, passengerId = null) {
    const baseScale = view.userData.questionRevealBaseScale ?? SCENE_TUNING.passengers.modelScale;
    const flash = view.userData.questionRevealFlash;
    const revealVersion = Math.max(0, Number(state?.revealVersion) || 0);
    const changedPassenger = view.userData.questionPassengerId !== passengerId;
    const increasedVersion = !changedPassenger
      && revealVersion > (view.userData.questionPassengerRevealVersion ?? 0);
    const eligibleReveal = state?.wasHidden === true && revealVersion > 0;

    if (changedPassenger) {
      view.userData.questionPassengerId = passengerId;
      view.userData.questionPassengerRevealVersion = revealVersion;
      view.userData.questionPassengerRevealStartedAt = -Infinity;
    } else if (increasedVersion) {
      view.userData.questionPassengerRevealVersion = revealVersion;
    }

    if (!eligibleReveal) {
      view.userData.questionPassengerRevealStartedAt = -Infinity;
    } else if (changedPassenger || increasedVersion) {
      view.userData.questionPassengerRevealStartedAt = time;
    }

    const startedAt = view.userData.questionPassengerRevealStartedAt ?? -Infinity;
    const elapsed = time - startedAt;
    const active = eligibleReveal
      && elapsed >= 0
      && elapsed < QUESTION_PASSENGER_REVEAL_DURATION;
    const flashBaseScale = flash?.userData.questionRevealBaseScale ?? flash?.scale.x ?? 0.72;
    if (flash) flash.userData.questionRevealBaseScale = flashBaseScale;

    if (!active) {
      view.scale.setScalar(baseScale);
      if (flash) {
        flash.visible = false;
        flash.scale.set(flashBaseScale, flashBaseScale, 1);
        if (flash.material) flash.material.opacity = 0;
      }
      this.setQuestionPassengerBadgesVisible(view, false);
      return;
    }

    const progress = THREE.MathUtils.clamp(elapsed / QUESTION_PASSENGER_REVEAL_DURATION, 0, 1);
    const reduceMotion = Boolean(this.reducedMotionQuery?.matches);
    const pulseScale = reduceMotion ? 1 : 1 + Math.sin(Math.PI * progress) * 0.08;
    view.scale.setScalar(baseScale * pulseScale);
    if (flash) {
      flash.visible = true;
      if (!reduceMotion) {
        const expandingScale = flashBaseScale * (0.7 + progress * 0.8);
        flash.scale.set(expandingScale, expandingScale, 1);
      } else {
        flash.scale.set(flashBaseScale, flashBaseScale, 1);
      }
      if (flash.material) flash.material.opacity = 1 - progress;
    }
    for (const badge of view.userData.questionBadges ?? []) {
      badge.visible = true;
      if (badge.material) badge.material.opacity = 1 - progress;
    }
  }

  resetQuestionPassengerReveal(
    view,
    baseScale = view.userData.questionRevealBaseScale ?? SCENE_TUNING.passengers.modelScale
  ) {
    view.userData.questionPassengerId = null;
    view.userData.questionPassengerRevealVersion = null;
    view.userData.questionPassengerRevealStartedAt = -Infinity;
    view.scale.setScalar(baseScale);
    const flash = view.userData.questionRevealFlash;
    if (flash) {
      const flashBaseScale = flash.userData.questionRevealBaseScale ?? flash.scale.x ?? 0.72;
      flash.visible = false;
      flash.scale.set(flashBaseScale, flashBaseScale, 1);
      if (flash.material) flash.material.opacity = 0;
    }
    this.setQuestionPassengerBadgesVisible(view, false);
  }

  syncQuestionPassengerRevealResetVersion(resetVersion) {
    if (this.lastSeenResetVersion === resetVersion) return false;
    this.lastSeenResetVersion = resetVersion;
    for (const view of this.passengerViews ?? []) {
      this.resetQuestionPassengerReveal(view);
    }
    return true;
  }

  resetPassengerAppearance(view) {
    this.resetQuestionPassengerReveal(view);
    view.userData.colorIndex = null;
    view.userData.questionPassengerHidden = null;
  }

  updateStarPassengerBadge(view, reward, time = 0, passengerId = null) {
    const badge = view.userData.starBadge;
    if (!badge) return;

    const starMesh = badge.userData.starMesh;
    const haloMesh = badge.userData.haloMesh;
    const countSprite = badge.userData.starBadgeCountSprite;
    const decrementSprite = badge.userData.starBadgeDecrementSprite;

    if (!reward) {
      badge.visible = false;
      badge.scale.setScalar(1);
      if (starMesh) starMesh.visible = false;
      if (haloMesh) haloMesh.visible = false;
      if (countSprite) countSprite.visible = false;
      if (decrementSprite) {
        decrementSprite.visible = false;
        decrementSprite.position.y = 0.63;
        if (decrementSprite.material) decrementSprite.material.opacity = 1;
      }
      badge.userData.starBadgePassengerId = null;
      badge.userData.starBadgeRemainingPasses = null;
      badge.userData.starBadgeDecrementVersion = null;
      badge.userData.starBadgeDecrementStartedAt = -Infinity;
      return;
    }

    const changedPassenger = badge.userData.starBadgePassengerId !== passengerId;
    if (changedPassenger) {
      badge.userData.starBadgePassengerId = passengerId;
      badge.userData.starBadgeRemainingPasses = null;
      badge.userData.starBadgeDecrementVersion = reward.decrementVersion ?? 0;
      badge.userData.starBadgeDecrementStartedAt = -Infinity;
      if (decrementSprite) {
        decrementSprite.visible = false;
        decrementSprite.position.y = 0.63;
        if (decrementSprite.material) decrementSprite.material.opacity = 1;
      }
    } else if ((reward.decrementVersion ?? 0) > (badge.userData.starBadgeDecrementVersion ?? 0)) {
      badge.userData.starBadgeDecrementVersion = reward.decrementVersion;
      badge.userData.starBadgeDecrementStartedAt = time;
    }

    const remainingPasses = Math.max(0, reward.remainingPasses ?? 0);
    const rewardVisible = Boolean(reward.active && !reward.expired && remainingPasses > 0);
    const decrementElapsed = time - badge.userData.starBadgeDecrementStartedAt;
    const showDecrement = decrementElapsed >= 0 && decrementElapsed < 0.65;
    const reduceMotion = Boolean(this.reducedMotionQuery?.matches);

    badge.visible = rewardVisible || showDecrement;
    if (starMesh) starMesh.visible = rewardVisible;
    if (haloMesh) haloMesh.visible = rewardVisible;
    if (countSprite) countSprite.visible = rewardVisible;
    if (decrementSprite) decrementSprite.visible = showDecrement;

    if (rewardVisible && badge.userData.starBadgeRemainingPasses !== remainingPasses) {
      badge.userData.starBadgeRemainingPasses = remainingPasses;
      const countLabel = badge.userData.starBadgeCountLabel;
      if (countLabel?.canvas) drawStarBadgeCount(countLabel, remainingPasses);
    }

    if (rewardVisible && !reduceMotion) {
      const pulse = 1 + Math.sin(time * 6) * 0.08;
      badge.scale.setScalar(pulse);
    } else {
      badge.scale.setScalar(1);
    }

    if (showDecrement && decrementSprite) {
      const progress = decrementElapsed / 0.65;
      decrementSprite.position.y = reduceMotion ? 0.63 : 0.63 + progress * 0.2;
      if (decrementSprite.material) decrementSprite.material.opacity = 1 - progress;
    } else if (decrementSprite) {
      decrementSprite.position.y = 0.63;
      if (decrementSprite.material) decrementSprite.material.opacity = 1;
    }
  }

  applyTuning() {
    this.applySceneLighting();
    const background = SCENE_TUNING.background;
    this.backgroundPlane.material.opacity = background.opacity;
    if (this.vehicleShadowMaterials) {
      Object.entries(this.vehicleShadowMaterials).forEach(([seats, material]) => {
        material.opacity = seats === '10' ? 0.8 : SCENE_TUNING.vehicleShadows.opacity;
      });
    }
    this.updatePassengerVisualTuning();
    this.updatePassengerMaterialTuning();
    this.updateVehicleArrowTuning();
    this.updateGuideHandTuning();

    const conveyor = SCENE_TUNING.conveyorArt;
    this.loopPlane.position.set(conveyor.x, conveyor.y, conveyor.z);
    this.loopPlane.rotation.set(-Math.PI / 2, 0, 0);
    this.loopPlane.scale.set(conveyor.width, conveyor.depth, 1);
    this.loopPlane.material.opacity = conveyor.opacity;

    this.buildPathCurves();
    const spots = SCENE_TUNING.parkingSpots;
    for (let i = 0; i < this.spotRoots.length; i += 1) {
      const position = this.spotPositions[i];
      position.set(spots.startX + spots.spacing * i, spots.y, spots.z);
      this.spotRoots[i].position.copy(position);
      this.spotRoots[i].rotation.y = deg(SCENE_TUNING.facing.parkingSpotYawDegrees);
      this.spotRoots[i].scale.set(spots.scaleX, 1, spots.scaleZ);
      const board = this.seatCountBoards[i];
      if (board) {
        const boardTuning = SCENE_TUNING.seatCountBoard;
        board.position.set(boardTuning.x, 0.03, boardTuning.z);
        board.rotation.y = -deg(SCENE_TUNING.facing.parkingSpotYawDegrees);
        board.scale.set(1 / Math.max(spots.scaleX, 0.0001), 1, 1 / Math.max(spots.scaleZ, 0.0001));
        board.userData.boardMesh.scale.set(boardTuning.width, boardTuning.depth, 1);
        board.userData.textSprite.scale.set(0.42 * boardTuning.textScale, 0.26 * boardTuning.textScale, 1);
      }
    }
    this.updateVehiclePathPreview();
    this.resize();
  }

  applySceneLighting() {
    const hemisphere = SCENE_TUNING.lighting?.hemisphere;
    if (this.hemisphereLight && hemisphere) {
      this.hemisphereLight.color.setHex(hemisphere.skyColor ?? 0xffffff);
      this.hemisphereLight.groundColor.setHex(hemisphere.groundColor ?? 0x77828f);
      this.hemisphereLight.intensity = hemisphere.intensity ?? 2.25;
    }

    const directional = SCENE_TUNING.lighting?.directional;
    if (!this.directionalLight || !this.directionalLightTarget || !directional) return;
    const position = directional.position ?? { x: 0, y: 3, z: 0 };
    const lightDirection = directionalLightDirection(directional.eulerDegrees ?? {});
    this.directionalLight.visible = Boolean(directional.enabled ?? 1);
    this.directionalLight.color.setHex(directional.color ?? 0xffffff);
    this.directionalLight.intensity = directional.intensity ?? 1;
    this.directionalLight.castShadow = false;
    this.directionalLight.position.set(position.x ?? 0, position.y ?? 3, position.z ?? 0);
    this.directionalLightTarget.position.copy(this.directionalLight.position).add(lightDirection);
    this.directionalLightTarget.updateMatrixWorld();
  }

  setTuning(patch, { mode = 'full', colorIndex = null } = {}) {
    deepMerge(SCENE_TUNING, patch);
    if (mode === 'passengerMaterial') {
      this.updatePassengerMaterialTuning({ colorIndex });
    } else {
      this.applyTuning();
    }
    return SCENE_TUNING;
  }

  update(snapshot, game) {
    this.syncQuestionPassengerRevealResetVersion(snapshot.resetVersion);
    const previousUpdateTime = this.lastSnapshot?.time ?? snapshot.time;
    const visualDelta = Math.max(0, Math.min(snapshot.time - previousUpdateTime, 0.1));
    this.lastSnapshot = snapshot;
    this.lastGame = game;
    this.vatTimeUniform.value = snapshot.time;
    if (snapshot.lastEvent.type === 'reset' && snapshot.time === 0) this.clearBoardingViews();
    this.processBoardingEvents(snapshot);
    this.updateBoardingViews(snapshot.time);
    const vehicleArea = SCENE_TUNING.vehicleArea;
    const vehicleYawOffset = deg(SCENE_TUNING.facing.vehicleYawOffsetDegrees);
    for (const board of this.seatCountBoards) {
      board.visible = false;
    }
    this.updateGarages(snapshot);
    for (const vehicle of snapshot.vehicles) {
      const view = this.vehicleViews.get(vehicle.id);
      const layoutStart = mapVehicleAreaPoint(vehicle);
      const startYaw = mapVehicleAreaYaw(vehicle.yaw) + vehicleYawOffset;
      const start = new THREE.Vector3(
        layoutStart.x,
        vehicleArea.y,
        layoutStart.y
      );
      const spot = this.spotPositions[vehicle.spotIndex ?? 0];
      view.visible = !['done', 'in-garage'].includes(vehicle.state);
      let vehicleScale = vehicle.state === 'parked' || vehicle.state === 'colliding'
        ? 1 : (UNITY_VEHICLE_MOTION.stationScaleBySeats[vehicle.seats] ?? 1);
      if (vehicle.state === 'parked') {
        view.position.copy(start);
        view.rotation.y = startYaw;
      } else if (vehicle.state === 'colliding') {
        const direction = forwardFromYaw(vehicle.yaw);
        const position = {
          x: vehicle.x + direction.x * vehicle.collision.offset,
          z: vehicle.z + direction.z * vehicle.collision.offset
        };
        view.position.copy(mapMotionPoint(position));
        view.rotation.y = startYaw;
      } else if (vehicle.state === 'moving-to-spot') {
        const data = vehicle.motionData;
        const curveValue = evaluateUnityCurve(data.curve, vehicle.motion);
        const sample = evaluatePath(data.path, data.path.length * curveValue);
        view.position.copy(mapMotionPoint(sample.position));
        view.rotation.y = mapMotionTangentYaw(sample.tangent);
        vehicleScale = THREE.MathUtils.lerp(
          1,
          UNITY_VEHICLE_MOTION.stationScaleBySeats[vehicle.seats] ?? 1,
          evaluateUnityCurve(UNITY_CURVES.smoothScale, vehicle.motion)
        );
      } else if (vehicle.state === 'leaving-garage') {
        const data = vehicle.motionData;
        const from = data?.from ?? vehicle;
        const to = data?.to ?? vehicle;
        const t = THREE.MathUtils.smoothstep(vehicle.motion, 0, 1);
        const position = {
          x: THREE.MathUtils.lerp(from.x, to.x, t),
          z: THREE.MathUtils.lerp(from.z, to.z, t)
        };
        view.position.copy(mapMotionPoint(position));
        view.rotation.y = mapVehicleAreaYaw(THREE.MathUtils.lerp(from.yaw, to.yaw, t)) + vehicleYawOffset;
      } else if (vehicle.state === 'at-spot' || vehicle.state === 'boarding-final') {
        view.position.copy(spot);
        view.rotation.y = deg(SCENE_TUNING.facing.parkingSpotYawDegrees + 180) + vehicleYawOffset;
      } else if (vehicle.state === 'departing') {
        const data = vehicle.motionData;
        const total = data.backwardDuration + data.forwardDuration;
        const elapsed = vehicle.motion * total;
        const departureY = SCENE_TUNING.vehicleDeparturePath?.y ?? SCENE_TUNING.vehicleArea.y;
        if (elapsed < data.backwardDuration) {
          const t = evaluateUnityCurve(UNITY_CURVES.outBackward, elapsed / data.backwardDuration);
          const sample = evaluatePath(data.backwardPath, data.backwardPath.length * t);
          view.position.copy(mapMotionPoint(sample.position, departureY));
          view.rotation.y = mapMotionTangentYaw(sample.tangent, true);
        } else {
          const t = evaluateUnityCurve(
            UNITY_CURVES.outForward,
            (elapsed - data.backwardDuration) / data.forwardDuration
          );
          const sample = evaluatePath(data.forwardPath, data.forwardPath.length * t);
          view.position.copy(mapMotionPoint(sample.position, departureY));
          view.rotation.y = mapMotionTangentYaw(sample.tangent);
        }
      }
      const boardingPulseScale = this.getVehicleBoardingPulseScale(vehicle.id, snapshot.time);
      view.scale.setScalar(vehicleScale * SCENE_TUNING.vehicleArea.modelScale * boardingPulseScale);
      this.applyVehicleHit(view, vehicle, snapshot.time);
      const isMovable = vehicle.state === 'parked' && game.getBlockers(vehicle.id).length === 0;
      for (const mesh of view.userData.bodyMeshes ?? []) {
        if (!mesh.material.emissive) continue;
        mesh.material.emissive.setHex(isMovable ? 0x123a20 : 0x000000);
        mesh.material.emissiveIntensity = isMovable ? 0.22 : 0;
      }
      view.userData.boardedGroups = vehicle.boardedGroups;
      if (vehicle.spotIndex != null && snapshot.spots[vehicle.spotIndex]?.vehicleId === vehicle.id) {
        const board = this.seatCountBoards[vehicle.spotIndex];
        if (board) this.updateSeatCountBoard(board, vehicle, snapshot.time);
      }
    }

    const passengerYaw = deg(SCENE_TUNING.facing.passengerYawDegrees);
    const passengerHeight = SCENE_TUNING.passengers.heightAbovePath;
    const activeInitialEntryKeys = new Set();
    for (const slot of snapshot.slots) {
      const view = this.passengerViews[slot.index];
      view.visible = slot.colorIndex !== null;
      if (!view.visible) {
        this.resetPassengerAppearance(view);
        this.updateStarPassengerBadge(view, null, snapshot.time);
        continue;
      }
      const point = this.curve.getPointAt(slot.progress);
      const tangent = this.curve.getTangentAt(slot.progress);
      point.y += passengerHeight;
      if (slot.entryMotion) {
        const entryKey = this.getInitialEntryPathKey(slot);
        activeInitialEntryKeys.add(entryKey);
        const entryVisual = this.getInitialEntryPathVisual(
          entryKey,
          slot,
          point,
          tangent,
          snapshot.time,
          visualDelta,
          snapshot.speedMultiplier,
          passengerHeight
        );
        view.position.copy(entryVisual.position);
        view.rotation.y = Math.atan2(entryVisual.tangent.x, entryVisual.tangent.z) + passengerYaw;
      } else {
        view.position.copy(point);
        view.rotation.y = Math.atan2(tangent.x, tangent.z) + passengerYaw;
      }
      this.setPassengerAppearance(view, slot.colorIndex, false);
      this.updateQuestionPassengerReveal(view, slot.questionPassenger, snapshot.time, slot.passengerId);
      this.setPassengerAnimation(view, 'move', slot.index > 0 && slot.index % 2 === 0 ? 0.3 : 0);
      this.updateStarPassengerBadge(view, slot.starReward, snapshot.time, slot.passengerId);
    }
    this.pruneInitialEntryPathStates(activeInitialEntryKeys);

    const queueSnapshots = snapshot.queueItems ?? snapshot.queues.map((queue) => (
      queue.map((colorIndex, index) => ({
        colorIndex,
        distanceFromHead: index * this.getQueueSpacing()
      }))
    ));
    queueSnapshots.forEach((queue, queueIndex) => {
      const curve = this.queueCurves[queueIndex];
      const views = this.queuePassengerViews[queueIndex];
      for (let i = 0; i < views.length; i += 1) {
        const view = views[i];
        const item = queue[i];
        const colorIndex = item?.colorIndex;
        view.visible = colorIndex !== undefined;
        if (!view.visible) {
          this.resetPassengerAppearance(view);
          this.updateStarPassengerBadge(view, null, snapshot.time);
          continue;
        }
        const t = this.getQueueProgressAtDistance(curve, item.distanceFromHead);
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        point.y += passengerHeight;
        const queueVisual = this.getQueueEntryVisual(
          queueIndex,
          item,
          point,
          tangent,
          visualDelta,
          snapshot.speedMultiplier,
          passengerHeight
        );
        view.position.copy(queueVisual.position);
        view.rotation.y = Math.atan2(-queueVisual.tangent.x, -queueVisual.tangent.z) + passengerYaw;
        this.setPassengerAppearance(view, colorIndex, Boolean(item.questionPassenger?.hidden));
        this.setPassengerAnimation(view, 'idle', (i % 4) * 0.17);
        this.updateStarPassengerBadge(view, item.starReward, snapshot.time, item.id);
      }
    });
    this.pruneQueueEntryPathStates(queueSnapshots);
    this.processBoardingEvents(snapshot);
    this.updateBoardingViews(snapshot.time);
    this.vehicleEffects?.update(snapshot);
    this.updateVehiclePathPreview(snapshot, game);
    this.updateGuideHand(snapshot.time, snapshot);
  }

  updateGuideHandTuning() {
    if (!this.guideHand || !this.guideHandMaterial) return;
    const tuning = SCENE_TUNING.vehicleGuideHand ?? {};
    this.guideHandMaterial.opacity = tuning.opacity ?? 1;
    this.updateGuideHand(this.lastSnapshot?.time ?? 0);
  }

  updateGuideHand(time = 0, snapshot = this.lastSnapshot) {
    if (!this.guideHand) return;
    const tuning = SCENE_TUNING.vehicleGuideHand ?? {};
    const targetId = Math.round(tuning.vehicleId ?? 1);
    const target = this.vehicleViews.get(targetId);
    const targetState = snapshot?.vehicles?.find((vehicle) => vehicle.id === targetId)?.state;
    if (!tuning.enabled || !target || !target.visible || targetState !== 'parked') {
      this.guideHand.visible = false;
      return;
    }
    const speed = Math.max(0.001, tuning.speed ?? 1);
    const phase = (Math.sin(time * Math.PI * 2 * speed - Math.PI / 2) + 1) / 2;
    const offsetX = (tuning.offsetX ?? 0) + (tuning.approachOffsetX ?? 0) * (1 - phase);
    const offsetZ = (tuning.offsetZ ?? 0) + (tuning.approachOffsetZ ?? 0) * (1 - phase);
    this.guideHand.position.set(
      target.position.x + offsetX,
      target.position.y + (tuning.offsetY ?? 0.5),
      target.position.z + offsetZ
    );
    const scale = (tuning.size ?? 1) * THREE.MathUtils.lerp(tuning.farScale ?? 1.1, tuning.nearScale ?? 0.8, phase);
    this.guideHand.scale.set(
      Math.max(0.001, tuning.width ?? 0.46) * scale,
      Math.max(0.001, tuning.height ?? 0.56) * scale,
      1
    );
    this.guideHand.visible = true;
  }

  getQueueSpacing() {
    return this.getConveyorSlotSpacing();
  }

  getConveyorSlotSpacing() {
    return Math.max(0.01, (this.curve?.getLength?.() ?? 0.01) / Math.max(1, LEVEL_1.conveyorCapacity));
  }

  getConveyorPathLength() {
    return Math.max(0.0001, this.curve?.getLength?.() ?? LEVEL_1.conveyorPathLength ?? 1);
  }

  getQueueProgressAtDistance(curve, distance) {
    const length = Math.max(0.0001, curve?.getLength?.() ?? 0.0001);
    return THREE.MathUtils.clamp(distance / length, 0, 1);
  }

  getQueueCapacities() {
    return this.queueCurves.map((curve) => (
      Math.min(
        LEVEL_1.queueCapacity,
        Math.floor((curve?.getLength?.() ?? 0) / this.getQueueSpacing()) + 1
      )
    ));
  }

  getQueueLengths() {
    return this.queueCurves.map((curve) => curve?.getLength?.() ?? 0);
  }

  getInitialEntryPathKey(slot) {
    return `${slot.entryMotion?.passengerId ?? slot.index}:${slot.entryMotion?.startedAt ?? 0}`;
  }

  getInitialEntryPathVisual(key, slot, target, targetTangent, time, delta, speedMultiplier, passengerHeight) {
    const motion = LEVEL_1.passengerEntryMotion;
    const entryPercent = LEVEL_1.entryPercents[slot.entryMotion.entryIndex] ?? 0;
    let state = this.initialEntryPathStates.get(key);
    if (!state) {
      const queueKey = this.getQueueItemKey(slot.entryMotion.entryIndex, {
        id: slot.entryMotion.passengerId
      });
      const queueState = this.queueEntryPathStates.get(queueKey);
      const fromQueueDistance = this.getEntryMotionQueueDistance(slot.entryMotion);
      state = {
        distance: Math.max(0, fromQueueDistance - (queueState?.distanceFromHead ?? 0)),
        snapped: false
      };
      this.initialEntryPathStates.set(key, state);
    }
    if (!motion || state.snapped) return { position: target, tangent: targetTangent, snapped: true };

    const conveyorLength = Math.max(0.0001, this.curve.getLength());
    const targetConveyorDistance = ((slot.progress - entryPercent + 1) % 1) * conveyorLength;
    const fromQueueDistance = this.getEntryMotionQueueDistance(slot.entryMotion);
    const targetDistance = fromQueueDistance + targetConveyorDistance;
    const pathScale = (Math.abs(SCENE_TUNING.path.scaleX) + Math.abs(SCENE_TUNING.path.scaleZ)) * 0.5;
    const elapsed = Math.max(0, time - slot.entryMotion.startedAt);
    const multiplier = Math.max(1, speedMultiplier);
    const catchUpDuration = Math.max(motion.initialFillCatchUpDuration, 0.01);
    const catchUpT = THREE.MathUtils.clamp(elapsed / catchUpDuration, 0, 1);
    const catchUpSpeed = Math.max(0, motion.catchUpExtraSpeed * catchUpT);
    const stepDistance = (motion.passengerSpeed + catchUpSpeed) * pathScale * multiplier * Math.max(0, delta);
    state.distance = Math.min(targetDistance, state.distance + stepDistance);

    const snapDistance = (motion.snapDistance ?? 0.02) * pathScale;
    if (targetDistance - state.distance <= snapDistance) {
      state.snapped = true;
      state.distance = targetDistance;
      return { position: target, tangent: targetTangent, snapped: true };
    }

    if (state.distance < fromQueueDistance) {
      const queueCurve = this.queueCurves[slot.entryMotion.entryIndex] ?? this.queueCurves[0];
      const queueLength = Math.max(0.0001, queueCurve.getLength());
      const queueProgress = (fromQueueDistance - state.distance) / queueLength;
      const position = queueCurve.getPointAt(queueProgress);
      const tangent = queueCurve.getTangentAt(queueProgress).multiplyScalar(-1);
      position.y += passengerHeight;
      return { position, tangent, snapped: false };
    }

    const conveyorProgress = (entryPercent + (state.distance - fromQueueDistance) / conveyorLength) % 1;
    const position = this.curve.getPointAt(conveyorProgress);
    const tangent = this.curve.getTangentAt(conveyorProgress);
    position.y += passengerHeight;
    return { position, tangent, snapped: false };
  }

  pruneInitialEntryPathStates(activeKeys) {
    for (const key of this.initialEntryPathStates.keys()) {
      if (!activeKeys.has(key)) this.initialEntryPathStates.delete(key);
    }
  }

  getQueueEntrySpawnDistance(queueIndex) {
    const queueCurve = this.queueCurves[queueIndex] ?? this.queueCurves[0];
    const queueLength = Math.max(0.0001, queueCurve?.getLength?.() ?? 0.0001);
    const spacing = this.getQueueSpacing();
    return Math.min(queueLength, spacing);
  }

  getEntryMotionQueueDistance(entryMotion) {
    const queueCurve = this.queueCurves[entryMotion.entryIndex] ?? this.queueCurves[0];
    const queueLength = Math.max(0.0001, queueCurve?.getLength?.() ?? 0.0001);
    const distance = Number.isFinite(entryMotion.fromQueueDistance)
      ? entryMotion.fromQueueDistance
      : (entryMotion.fromQueueProgress ?? 0) * queueLength;
    return THREE.MathUtils.clamp(distance, 0, queueLength);
  }

  getQueueItemKey(queueIndex, item, fallbackIndex = 0) {
    return `${queueIndex}:${item.id ?? `${item.createdAt ?? 0}:${fallbackIndex}:${item.colorIndex}`}`;
  }

  getQueueEntryVisual(queueIndex, item, target, targetTangent, delta, speedMultiplier, passengerHeight) {
    const curve = this.queueCurves[queueIndex] ?? this.queueCurves[0];
    const motion = LEVEL_1.passengerEntryMotion;
    if (!curve || !motion) return { position: target, tangent: targetTangent };

    const key = this.getQueueItemKey(queueIndex, item);
    let state = this.queueEntryPathStates.get(key);
    if (!state) {
      const queueLength = Math.max(0.0001, curve.getLength());
      state = {
        distanceFromHead: Math.min(queueLength, item.distanceFromHead + this.getQueueEntrySpawnDistance(queueIndex))
      };
      this.queueEntryPathStates.set(key, state);
    }

    const speed = Math.max(0.01, motion.passengerSpeed ?? LEVEL_1.conveyorSpeed);
    const step = speed * Math.max(0, delta) * Math.max(1, speedMultiplier);
    state.distanceFromHead = Math.max(item.distanceFromHead, state.distanceFromHead - step);

    const visualDistance = Math.max(item.distanceFromHead, state.distanceFromHead);
    if (visualDistance - item.distanceFromHead <= (motion.snapDistance ?? 0.02)) {
      state.distanceFromHead = item.distanceFromHead;
      return { position: target, tangent: targetTangent };
    }

    const t = this.getQueueProgressAtDistance(curve, visualDistance);
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    position.y += passengerHeight;
    return { position, tangent, snapped: false };
  }

  pruneQueueEntryPathStates(queueSnapshots) {
    const activeKeys = new Set();
    queueSnapshots.forEach((queue, queueIndex) => {
      queue.forEach((item, index) => activeKeys.add(this.getQueueItemKey(queueIndex, item, index)));
    });
    for (const key of this.queueEntryPathStates.keys()) {
      if (!activeKeys.has(key)) this.queueEntryPathStates.delete(key);
    }
  }

  applyVehicleHit(view, vehicle, time) {
    const meshes = view.userData.hitMeshes ?? [];
    for (const mesh of meshes) {
      mesh.position.copy(mesh.userData.hitBasePosition);
      mesh.rotation.copy(mesh.userData.hitBaseRotation);
    }
    if (!vehicle.hit || time - vehicle.hit.startedAt >= UNITY_VEHICLE_MOTION.hitDuration) return;
    const clipName = chooseHitClip(vehicle.hit);
    const sample = sampleHitClip(clipName, time - vehicle.hit.startedAt);
    const scale = view.userData.unityHitScale ?? 1;
    for (const mesh of meshes) {
      mesh.position[sample.positionAxis] += sample.position * scale;
      mesh.position.y += sample.positionY * scale;
      mesh.rotation[sample.rotationAxis] += deg(sample.rotationDegrees);
    }
  }

  clearBoardingViews() {
    for (const entry of this.boardingViews) {
      this.scene.remove(entry.root);
      entry.material.dispose();
    }
    this.boardingViews.length = 0;
    this.vehicleBoardingPulses.clear();
    this.initialEntryPathStates.clear();
    this.queueEntryPathStates.clear();
    this.lastBoardingEventId = 0;
  }

  triggerVehicleBoardingPulse(vehicleId, time) {
    const tuning = SCENE_TUNING.vehicleBoardingPulse ?? {};
    if ((tuning.scale ?? 1) <= 1 || (tuning.speed ?? 0) <= 0) return;
    const pulses = this.vehicleBoardingPulses.get(vehicleId) ?? [];
    pulses.push(time);
    this.vehicleBoardingPulses.set(vehicleId, pulses.slice(-12));
  }

  getVehicleBoardingPulseScale(vehicleId, time) {
    const tuning = SCENE_TUNING.vehicleBoardingPulse ?? {};
    const maxScale = Math.max(1, tuning.scale ?? 1);
    const speed = Math.max(0, tuning.speed ?? 0);
    const pulses = this.vehicleBoardingPulses.get(vehicleId);
    if (maxScale <= 1 || speed <= 0 || !pulses?.length) return 1;

    let scale = 1;
    let activeCount = 0;
    for (const startedAt of pulses) {
      const progress = (time - startedAt) * speed;
      if (progress < 0) {
        pulses[activeCount] = startedAt;
        activeCount += 1;
        continue;
      }
      if (progress >= 1) continue;
      scale = Math.max(scale, 1 + (maxScale - 1) * Math.sin(Math.PI * progress));
      pulses[activeCount] = startedAt;
      activeCount += 1;
    }
    pulses.length = activeCount;
    if (pulses.length === 0) this.vehicleBoardingPulses.delete(vehicleId);
    return scale;
  }

  processBoardingEvents(snapshot) {
    if (!this.personTemplate) return;
    for (const event of snapshot.boardingEvents ?? []) {
      if (event.id <= this.lastBoardingEventId) continue;
      this.spawnBoardingGroup(event);
      this.lastBoardingEventId = event.id;
    }
  }

  spawnBoardingGroup(event) {
    const spot = this.spotPositions[event.spotIndex];
    if (!spot) return;
    const startCenter = this.curve.getPointAt(event.progress);
    startCenter.y += SCENE_TUNING.passengers.heightAbovePath;
    const tangent = this.curve.getTangentAt(event.progress);
    const pathYaw = Math.atan2(tangent.x, tangent.z) + deg(SCENE_TUNING.facing.passengerYawDegrees);
    const target = spot.clone();
    target.y = SCENE_TUNING.path.groundY + SCENE_TUNING.passengers.heightAbovePath;

    for (let index = 0; index < LEVEL_1.groupSize; index += 1) {
      const visual = this.createPassengerVisual(event.colorIndex);
      visual.scale.setScalar(SCENE_TUNING.passengers.modelScale);
      const rowOffset = new THREE.Vector3(
        (index - 1.5) * SCENE_TUNING.passengers.groupSpacing * SCENE_TUNING.passengers.modelScale,
        0,
        0
      ).applyAxisAngle(new THREE.Vector3(0, 1, 0), pathYaw);
      const start = startCenter.clone().add(rowOffset);
      const direction = target.clone().sub(start);
      visual.position.copy(start);
      visual.rotation.y = Math.atan2(direction.x, direction.z)
        + deg(SCENE_TUNING.facing.passengerYawDegrees);
      this.setVatAnimation(visual.userData.vatMaterial, 'move');
      this.scene.add(visual);
      this.boardingViews.push({
        root: visual,
        material: visual.userData.vatMaterial,
        vehicleId: event.vehicleId,
        start,
        target: target.clone(),
        startedAt: event.startedAt,
        delay: index * SCENE_TUNING.passengers.aboardInterval,
        duration: Math.max(0.25, start.distanceTo(target) / SCENE_TUNING.passengers.aboardSpeed)
      });
    }
  }

  updateBoardingViews(time) {
    for (let index = this.boardingViews.length - 1; index >= 0; index -= 1) {
      const entry = this.boardingViews[index];
      const elapsed = time - entry.startedAt - entry.delay;
      if (elapsed < 0) continue;
      const progress = THREE.MathUtils.clamp(elapsed / entry.duration, 0, 1);
      entry.root.position.lerpVectors(entry.start, entry.target, ease(progress));
      if (progress < 1) continue;
      this.triggerVehicleBoardingPulse(entry.vehicleId, time);
      this.vehicleEffects?.spawnAboardSmoke(entry.vehicleId);
      this.hooks.onPassengerAboard?.(entry.vehicleId);
      this.scene.remove(entry.root);
      entry.material.dispose();
      this.boardingViews.splice(index, 1);
    }
  }

  pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.vehicleViews.values()], true);
    let object = hits[0]?.object;
    while (object && object.userData.vehicleId == null) object = object.parent;
    if (object?.userData.vehicleId != null) this.onVehicleClick(object.userData.vehicleId);
  }

  projectWorldToCanvas({ x = 0, y = 0, z = 0 } = {}) {
    const rect = this.canvas.getBoundingClientRect();
    const point = new THREE.Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0).project(this.camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      return null;
    }
    return {
      x: (point.x + 1) * rect.width / 2,
      y: (1 - point.y) * rect.height / 2,
      depth: point.z
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || innerWidth));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || innerHeight));
    const aspect = width / height;
    const camera = SCENE_TUNING.camera;
    const crop = SCENE_TUNING.sourceCrop;
    const cropEnabled = Boolean(crop?.enabled);
    const responsiveCrop = cropEnabled
      ? resolveResponsiveCropFit({
        width,
        height,
        crop,
        background: SCENE_TUNING.background
      })
      : null;
    const halfHeight = cropEnabled
      ? calculateDesignCoverHalfHeight({
        width,
        height,
        designWidth: SCENE_TUNING.preview?.width ?? 1080,
        designHeight: SCENE_TUNING.preview?.height ?? 2160,
        fitHeight: camera.fitHeight
      })
      : calculateOrthographicHalfHeight({
        width,
        height,
        ...resolveCameraFit({
          camera,
          responsiveCrop,
          cropEnabled
        }),
        padding: camera.padding
      });
    const distance = calculatePerspectiveDistance(halfHeight, camera.fovDegrees);
    const elevation = deg(camera.elevationDegrees);
    const cropOffsetX = cropEnabled
      ? responsiveCrop.cropOffsetX
      : 0;
    const cropOffsetZ = cropEnabled
      ? responsiveCrop.cropOffsetY
      : 0;
    const target = new THREE.Vector3(
      camera.targetX + cropOffsetX,
      camera.targetY,
      camera.targetZ + cropOffsetZ
    );
    this.camera.fov = camera.fovDegrees;
    this.camera.aspect = aspect;
    this.camera.position.set(
      target.x,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(elevation) * distance
    );
    this.camera.lookAt(target);

    const background = SCENE_TUNING.background;
    const backgroundDistance = distance + background.distanceOffset;
    const backgroundWidth = background.width;
    const backgroundHeight = background.height;
    this.backgroundPlane.position.set(
      background.offsetX - cropOffsetX,
      background.offsetY + cropOffsetZ,
      -backgroundDistance
    );
    this.backgroundPlane.scale.set(
      backgroundWidth,
      backgroundHeight,
      1
    );
    this.camera.near = Math.max(0.1, distance - 35);
    this.camera.far = backgroundDistance + 5;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.renderer.setSize(width, height, false);
    if (this.fullQueueCurves) this.updateQueueCurvesForCamera();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
