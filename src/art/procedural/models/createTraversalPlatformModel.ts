import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Traversal Moving Platform
// Sculpt build pass: structural-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createTraversalMovingPlatformModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Traversal Moving Platform";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40, "aspect": 1, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}, "positionHint": [0, 0, 3], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["shell-white"] = createSculptMaterial(
    "shell-white",
    {"id": "shell-white", "name": "Cool white coated shell", "type": "physical", "shaderModel": "MeshPhysicalMaterial / PBR approximation", "qualityTier": "hero", "baseColor": "#EBEFF0", "color": "#EBEFF0", "albedo": {"dominant": "#DDDCE3", "secondary": ["#1C2227", "#D4D3DA", "#EEEEF2"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "./public/textures/platform/shell-white_albedo.png", "url": "/textures/platform/shell-white_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#DDDCE3", "#1C2227", "#D4D3DA", "#EEEEF2", "#A19FA5"], "pattern": "reference-derived pixel palette", "amplitude": 0.35, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Stable object-space density; no stretching under runtime platform scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.52, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.256, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.115, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.686, "variation": 0.05, "map": {"path": "./public/textures/platform/shell-white_roughness.png", "url": "/textures/platform/shell-white_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 1.0, "variation": 0.04}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.186, "map": {"path": "./public/textures/platform/shell-white_normal.png", "url": "/textures/platform/shell-white_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "./public/textures/platform/shell-white_height.png", "url": "/textures/platform/shell-white_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.011, "map": {"path": "./public/textures/platform/shell-white_height.png", "url": "/textures/platform/shell-white_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "./public/textures/platform/shell-white_ao.png", "url": "/textures/platform/shell-white_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.08, "scratches": ["sparse cool-gray hairlines at corners"], "chips": []}, "dirt": {"amount": 0.025, "cavityBias": 0.72, "color": "#111820"}, "localOverrides": [{"id": "traversal-mark", "type": "decal", "region": "front fascia center", "baseColor": "#101820", "roughness": 0.42, "evidenceRefs": ["front-fascia"]}, {"id": "sparse-edge-wear", "type": "scratch-cluster", "region": "deck perimeter and corners", "baseColor": "#AEB8BC", "roughness": 0.68, "amplitude": 0.08, "evidenceRefs": ["top-deck"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Independent PBR channels come from reference evidence extraction.", "Keep wear restrained and cyan emission localized.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Approved Traversal platform material family.", "finishClass": "brushed-steel", "texturePalette": ["#161C21", "#A8A9B0", "#DBDAE0", "#D4D3D8", "#BCBAC0"], "proceduralTexture": "brushed", "clearcoat": {"base": 0.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.0, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 1.0, "anisotropy": {"base": 1.0}, "referencePbr": {"version": "1.0", "sourceImage": "./docs/art/platform-system/material-crops/shell-white.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./public/textures/platform/shell-white_albedo.png", "url": "/textures/platform/shell-white_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./public/textures/platform/shell-white_roughness.png", "url": "/textures/platform/shell-white_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./public/textures/platform/shell-white_height.png", "url": "/textures/platform/shell-white_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./public/textures/platform/shell-white_normal.png", "url": "/textures/platform/shell-white_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./public/textures/platform/shell-white_ao.png", "url": "/textures/platform/shell-white_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 300, "sourceHeight": 88, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 300, "height": 88}, "mask": {"backgroundColor": "#161B1F", "backgroundNoise": 24.249, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.9955}, "mapStats": {"valueRange": 0.8383, "heightP90Gradient": 0.02517, "roughnessBase": 0.686, "roughnessVariation": 0.05, "normalStrength": 0.186, "blurRadius": 21}, "palette": ["#DDDCE3", "#1C2227", "#D4D3DA", "#EEEEF2", "#A19FA5"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["graphite"] = createSculptMaterial(
    "graphite",
    {"id": "graphite", "name": "Graphite structural metal", "type": "physical", "shaderModel": "MeshPhysicalMaterial / PBR approximation", "qualityTier": "hero", "baseColor": "#1A222A", "color": "#1A222A", "albedo": {"dominant": "#0F1417", "secondary": ["#181E23", "#07080A", "#6AA8C1"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "./public/textures/platform/graphite_albedo.png", "url": "/textures/platform/graphite_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#0F1417", "#181E23", "#07080A", "#6AA8C1", "#2C4959"], "pattern": "reference-derived pixel palette", "amplitude": 0.182, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Stable object-space density; no stretching under runtime platform scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.431, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.248, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.111, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.683, "variation": 0.05, "map": {"path": "./public/textures/platform/graphite_roughness.png", "url": "/textures/platform/graphite_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0.35, "variation": 0.04}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.184, "map": {"path": "./public/textures/platform/graphite_normal.png", "url": "/textures/platform/graphite_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "./public/textures/platform/graphite_height.png", "url": "/textures/platform/graphite_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.011, "map": {"path": "./public/textures/platform/graphite_height.png", "url": "/textures/platform/graphite_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "./public/textures/platform/graphite_ao.png", "url": "/textures/platform/graphite_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.035, "scratches": [], "chips": []}, "dirt": {"amount": 0.015, "cavityBias": 0.72, "color": "#111820"}, "localOverrides": [{"id": "cassette-cavity", "type": "cavity-darkening", "region": "central underside recess", "baseColor": "#05080B", "roughness": 0.48, "evidenceRefs": ["underside"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Independent PBR channels come from reference evidence extraction.", "Keep wear restrained and cyan emission localized.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Approved Traversal platform material family.", "finishClass": "candy-coat", "texturePalette": ["#AAA9AD", "#4D5358", "#1D1F21", "#15191B", "#0E1317"], "proceduralTexture": "gradient-smoke", "clearcoat": {"base": 0.6, "variation": 0.0}, "clearcoatRoughness": {"base": 0.15, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 0.7, "referencePbr": {"version": "1.0", "sourceImage": "./docs/art/platform-system/material-crops/graphite.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./public/textures/platform/graphite_albedo.png", "url": "/textures/platform/graphite_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./public/textures/platform/graphite_roughness.png", "url": "/textures/platform/graphite_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./public/textures/platform/graphite_height.png", "url": "/textures/platform/graphite_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./public/textures/platform/graphite_normal.png", "url": "/textures/platform/graphite_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./public/textures/platform/graphite_ao.png", "url": "/textures/platform/graphite_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 260, "sourceHeight": 82, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 260, "height": 82}, "mask": {"backgroundColor": "#141519", "backgroundNoise": 166.856, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.4108}, "mapStats": {"valueRange": 0.4325, "heightP90Gradient": 0.02335, "roughnessBase": 0.683, "roughnessVariation": 0.05, "normalStrength": 0.184, "blurRadius": 21}, "palette": ["#0F1417", "#181E23", "#07080A", "#6AA8C1", "#2C4959"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["emitter-cyan"] = createSculptMaterial(
    "emitter-cyan",
    {"id": "emitter-cyan", "name": "Cyan emitter polymer", "type": "physical", "shaderModel": "MeshPhysicalMaterial / PBR approximation", "qualityTier": "hero", "baseColor": "#5CEFFF", "color": "#5CEFFF", "albedo": {"dominant": "#161C21", "secondary": ["#A1A2A8", "#090A0C", "#E5F3F8"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "./public/textures/platform/emitter-cyan_albedo.png", "url": "/textures/platform/emitter-cyan_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#161C21", "#A1A2A8", "#090A0C", "#E5F3F8", "#536472"], "pattern": "reference-derived pixel palette", "amplitude": 0.241, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Stable object-space density; no stretching under runtime platform scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.48, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.24, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.107, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.683, "variation": 0.05, "map": {"path": "./public/textures/platform/emitter-cyan_roughness.png", "url": "/textures/platform/emitter-cyan_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0.0, "variation": 0.04}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.181, "map": {"path": "./public/textures/platform/emitter-cyan_normal.png", "url": "/textures/platform/emitter-cyan_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "./public/textures/platform/emitter-cyan_height.png", "url": "/textures/platform/emitter-cyan_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "./public/textures/platform/emitter-cyan_height.png", "url": "/textures/platform/emitter-cyan_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "./public/textures/platform/emitter-cyan_ao.png", "url": "/textures/platform/emitter-cyan_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.035, "scratches": [], "chips": []}, "dirt": {"amount": 0.015, "cavityBias": 0.72, "color": "#111820"}, "localOverrides": [{"id": "front-rail", "type": "emissive", "region": "+Z fascia rails", "emissive": "#18DFFF", "emissiveIntensity": 4.2, "bloom": true, "evidenceRefs": ["front-fascia"]}, {"id": "side-rails", "type": "emissive", "region": "+/-X fascia rails", "emissive": "#18DFFF", "emissiveIntensity": 3.6, "bloom": true, "evidenceRefs": ["full-object"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Independent PBR channels come from reference evidence extraction.", "Keep wear restrained and cyan emission localized.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Approved Traversal platform material family.", "finishClass": "painted-metal", "texturePalette": ["#9FA2A9", "#6C6C71", "#3B3D41", "#171C20", "#151A1E"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 1.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.05, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 1.0, "referencePbr": {"version": "1.0", "sourceImage": "./docs/art/platform-system/material-crops/emitter-cyan.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./public/textures/platform/emitter-cyan_albedo.png", "url": "/textures/platform/emitter-cyan_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./public/textures/platform/emitter-cyan_roughness.png", "url": "/textures/platform/emitter-cyan_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./public/textures/platform/emitter-cyan_height.png", "url": "/textures/platform/emitter-cyan_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./public/textures/platform/emitter-cyan_normal.png", "url": "/textures/platform/emitter-cyan_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./public/textures/platform/emitter-cyan_ao.png", "url": "/textures/platform/emitter-cyan_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 130, "sourceHeight": 62, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 130, "height": 62}, "mask": {"backgroundColor": "#29292B", "backgroundNoise": 61.205, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.7795}, "mapStats": {"valueRange": 0.5728, "heightP90Gradient": 0.02153, "roughnessBase": 0.683, "roughnessVariation": 0.05, "normalStrength": 0.181, "blurRadius": 21}, "palette": ["#161C21", "#A1A2A8", "#090A0C", "#E5F3F8", "#536472"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["dark-detail"] = createSculptMaterial(
    "dark-detail",
    {"id": "dark-detail", "name": "Dark machined hardware", "type": "physical", "shaderModel": "MeshPhysicalMaterial / PBR approximation", "qualityTier": "hero", "baseColor": "#414C55", "color": "#414C55", "albedo": {"dominant": "#0E1316", "secondary": ["#07090B", "#D5DAE0", "#28363F"], "samplingNotes": "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", "map": {"path": "./public/textures/platform/dark-detail_albedo.png", "url": "/textures/platform/dark-detail_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#0E1316", "#07090B", "#D5DAE0", "#28363F", "#5892AA"], "pattern": "reference-derived pixel palette", "amplitude": 0.35, "heightCorrelation": 0.42}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2, 2], "anisotropy": 8, "texelDensityIntent": "Stable object-space density; no stretching under runtime platform scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.52, "role": "reference-derived broad albedo and height breakup"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.215, "role": "reference-derived cracks, ridges, pores, grain, or leaf clusters"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.092, "role": "reference-derived micro highlight breakup under grazing light"}], "roughness": {"base": 0.682, "variation": 0.05, "map": {"path": "./public/textures/platform/dark-detail_roughness.png", "url": "/textures/platform/dark-detail_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "localResponse": "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother"}, "metalness": {"base": 0.0, "variation": 0.04}, "normal": {"pattern": "reference-derived height-gradient normal map", "strength": 0.174, "map": {"path": "./public/textures/platform/dark-detail_normal.png", "url": "/textures/platform/dark-detail_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "heightSource": {"path": "./public/textures/platform/dark-detail_height.png", "url": "/textures/platform/dark-detail_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "space": "tangent"}, "bump": {"pattern": "reference-derived height field", "amplitude": 0.01, "map": {"path": "./public/textures/platform/dark-detail_height.png", "url": "/textures/platform/dark-detail_height.png", "channel": "height", "source": "reference-pixel-extraction"}}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.38, "contactShadowBias": 0.35, "map": {"path": "./public/textures/platform/dark-detail_ao.png", "url": "/textures/platform/dark-detail_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}, "notes": "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot."}, "wear": {"edgeWear": 0.035, "scratches": [], "chips": []}, "dirt": {"amount": 0.015, "cavityBias": 0.72, "color": "#111820"}, "localOverrides": [{"id": "bevel-polish", "type": "roughness", "region": "corner cap and fastener crowns", "roughness": 0.22, "evidenceRefs": ["front-fascia"]}, {"id": "reference-pbr-pixel-evidence", "type": "material-map-evidence", "evidenceRefs": ["full-object"], "channels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "notes": "Use generated maps as material evidence, then refine after browser screenshot comparison."}], "shaderNotes": ["Independent PBR channels come from reference evidence extraction.", "Keep wear restrained and cyan emission localized.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], "notes": "Approved Traversal platform material family.", "finishClass": "painted-metal", "texturePalette": ["#9C9EA5", "#5A5C61", "#20282C", "#131619", "#0F1214"], "proceduralTexture": "flat-clearcoat", "clearcoat": {"base": 1.0, "variation": 0.0}, "clearcoatRoughness": {"base": 0.05, "variation": 0.0}, "transmission": {"base": 0.0, "variation": 0.0}, "ior": {"base": 1.5, "value": 1.5}, "envMapIntensity": 1.0, "referencePbr": {"version": "1.0", "sourceImage": "./docs/art/platform-system/material-crops/dark-detail.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./public/textures/platform/dark-detail_albedo.png", "url": "/textures/platform/dark-detail_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./public/textures/platform/dark-detail_roughness.png", "url": "/textures/platform/dark-detail_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./public/textures/platform/dark-detail_height.png", "url": "/textures/platform/dark-detail_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./public/textures/platform/dark-detail_normal.png", "url": "/textures/platform/dark-detail_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./public/textures/platform/dark-detail_ao.png", "url": "/textures/platform/dark-detail_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 165, "sourceHeight": 74, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 165, "height": 74}, "mask": {"backgroundColor": "#0F1315", "backgroundNoise": 99.358, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.4712}, "mapStats": {"valueRange": 0.8745, "heightP90Gradient": 0.01541, "roughnessBase": 0.682, "roughnessVariation": 0.05, "normalStrength": 0.174, "blurRadius": 21}, "palette": ["#0E1316", "#07090B", "#D5DAE0", "#28363F", "#5892AA"]}, "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Platform motion root__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.12, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Platform motion root", "level": "macro", "role": "body", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": null, "attachment": null, "dimensions": {"width": 0.72, "height": 0.08, "depth": 0.66, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [0.72, 0.08, 0.66]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "root-surface", "localPosition": [0, 0, 0], "localRotation": [0, 0, 0]}, {"id": "deck-surface", "localPosition": [0, 0.5, 0], "localRotation": [0, 0, 0]}, {"id": "emitter-front", "localPosition": [0, 0.25, 0.51], "localRotation": [0, 0, 0]}, {"id": "emitter-left", "localPosition": [-0.51, 0.25, 0], "localRotation": [0, 1.5707963267948966, 0]}], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "root-surface", "localPosition": [0, 0, 0], "localRotation": [0, 0, 0]}, {"id": "deck-surface", "localPosition": [0, 0.5, 0], "localRotation": [0, 0, 0]}, {"id": "emitter-front", "localPosition": [0, 0.25, 0.51], "localRotation": [0, 0, 0]}, {"id": "emitter-left", "localPosition": [-0.51, 0.25, 0], "localRotation": [0, 1.5707963267948966, 0]}], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.72, 0.08, 0.66);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["graphite"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Platform motion root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Platform motion root", "level": "macro", "role": "body", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": null, "attachment": null, "dimensions": {"width": 0.72, "height": 0.08, "depth": 0.66, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.12, 0], "rotation": [0, 0, 0], "scale": [0.72, 0.08, 0.66]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "root-surface", "localPosition": [0, 0, 0], "localRotation": [0, 0, 0]}, {"id": "deck-surface", "localPosition": [0, 0.5, 0], "localRotation": [0, 0, 0]}, {"id": "emitter-front", "localPosition": [0, 0.25, 0.51], "localRotation": [0, 0, 0]}, {"id": "emitter-left", "localPosition": [-0.51, 0.25, 0], "localRotation": [0, 1.5707963267948966, 0]}], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_root_surface_0 = new THREE.Object3D();
  socket_root_root_surface_0.name = "root-surface";
  socket_root_root_surface_0.position.set(0.0, 0.0, 0.0);
  socket_root_root_surface_0.rotation.set(0.0, 0.0, 0.0);
  socket_root_root_surface_0.userData.socket = {"id": "root-surface", "localPosition": [0, 0, 0], "localRotation": [0, 0, 0]};
  node_root_0.add(socket_root_root_surface_0);
  sockets["root:root-surface"] = socket_root_root_surface_0;
  const socket_root_deck_surface_1 = new THREE.Object3D();
  socket_root_deck_surface_1.name = "deck-surface";
  socket_root_deck_surface_1.position.set(0.0, 0.5, 0.0);
  socket_root_deck_surface_1.rotation.set(0.0, 0.0, 0.0);
  socket_root_deck_surface_1.userData.socket = {"id": "deck-surface", "localPosition": [0, 0.5, 0], "localRotation": [0, 0, 0]};
  node_root_0.add(socket_root_deck_surface_1);
  sockets["root:deck-surface"] = socket_root_deck_surface_1;
  const socket_root_emitter_front_2 = new THREE.Object3D();
  socket_root_emitter_front_2.name = "emitter-front";
  socket_root_emitter_front_2.position.set(0.0, 0.25, 0.51);
  socket_root_emitter_front_2.rotation.set(0.0, 0.0, 0.0);
  socket_root_emitter_front_2.userData.socket = {"id": "emitter-front", "localPosition": [0, 0.25, 0.51], "localRotation": [0, 0, 0]};
  node_root_0.add(socket_root_emitter_front_2);
  sockets["root:emitter-front"] = socket_root_emitter_front_2;
  const socket_root_emitter_left_3 = new THREE.Object3D();
  socket_root_emitter_left_3.name = "emitter-left";
  socket_root_emitter_left_3.position.set(-0.51, 0.25, 0.0);
  socket_root_emitter_left_3.rotation.set(0.0, 1.5707963267948966, 0.0);
  socket_root_emitter_left_3.userData.socket = {"id": "emitter-left", "localPosition": [-0.51, 0.25, 0], "localRotation": [0, 1.5707963267948966, 0]};
  node_root_0.add(socket_root_emitter_left_3);
  sockets["root:emitter-left"] = socket_root_emitter_left_3;

  const endpoint_deck_shell_1 = makeAttachmentEndpoint(null);
  const node_deck_shell_1 = new THREE.Group();
  node_deck_shell_1.name = "Cool-white upper deck shell__pivot";
  node_deck_shell_1.scale.set(1, 1, 1);
  if (endpoint_deck_shell_1) {
    node_deck_shell_1.position.copy(endpoint_deck_shell_1.start);
    node_deck_shell_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_deck_shell_1.position.set(0.0, 0.375, 0.0);
    node_deck_shell_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_deck_shell_1.userData.sculptComponent = {"id": "deck-shell", "name": "Cool-white upper deck shell", "level": "macro", "role": "shell", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-surface", "contactType": "overlap", "localStart": [0, 0.375, 0], "localEnd": [0, 0.375, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 1, "height": 0.25, "depth": 1, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.375, 0], "rotation": [0, 0, 0], "scale": [1, 0.25, 1]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["perimeter-chamfer", "top-panel-seams"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck", "full-object"], "details": ["perimeter-chamfer", "top-panel-seams"], "fidelityTier": "blockout"};
  node_deck_shell_1.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["root"] ?? root).add(node_deck_shell_1);
  nodes["deck-shell"] = node_deck_shell_1;
  const mesh_deck_shell_1Geometry = endpoint_deck_shell_1
    ? new THREE.CylinderGeometry(endpoint_deck_shell_1.endRadius, endpoint_deck_shell_1.baseRadius, endpoint_deck_shell_1.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_deck_shell_1) {
    mesh_deck_shell_1Geometry.scale(1.0, 0.25, 1.0);
  }
  const mesh_deck_shell_1 = new THREE.Mesh(
    mesh_deck_shell_1Geometry,
    materialMap["shell-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_shell_1.name = "Cool-white upper deck shell";
  if (endpoint_deck_shell_1) {
    mesh_deck_shell_1.position.copy(endpoint_deck_shell_1.midpoint);
    mesh_deck_shell_1.quaternion.copy(endpoint_deck_shell_1.quaternion);
  }
  mesh_deck_shell_1.castShadow = options.castShadow ?? true;
  mesh_deck_shell_1.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_shell_1.userData.sculptComponent = {"id": "deck-shell", "name": "Cool-white upper deck shell", "level": "macro", "role": "shell", "importance": 1, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-surface", "contactType": "overlap", "localStart": [0, 0.375, 0], "localEnd": [0, 0.375, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 1, "height": 0.25, "depth": 1, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.375, 0], "rotation": [0, 0, 0], "scale": [1, 0.25, 1]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "deck-shell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["perimeter-chamfer", "top-panel-seams"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck", "full-object"], "details": ["perimeter-chamfer", "top-panel-seams"], "fidelityTier": "blockout"};
  node_deck_shell_1.add(mesh_deck_shell_1);
  meshes["deck-shell"] = mesh_deck_shell_1;
  colliders["deck-shell"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["deck-shell"] ??= [];
  destructionGroups["deck-shell"].push(node_deck_shell_1);

  const endpoint_undercarriage_2 = makeAttachmentEndpoint(null);
  const node_undercarriage_2 = new THREE.Group();
  node_undercarriage_2.name = "Inset graphite undercarriage__pivot";
  node_undercarriage_2.scale.set(1, 1, 1);
  if (endpoint_undercarriage_2) {
    node_undercarriage_2.position.copy(endpoint_undercarriage_2.start);
    node_undercarriage_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_undercarriage_2.position.set(0.0, 0.17, 0.0);
    node_undercarriage_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_undercarriage_2.userData.sculptComponent = {"id": "undercarriage", "name": "Inset graphite undercarriage", "level": "macro", "role": "chassis", "importance": 0.95, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-surface", "contactType": "overlap", "localStart": [0, 0.17, 0], "localEnd": [0, 0.17, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.9, "height": 0.24, "depth": 0.86, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.17, 0], "rotation": [0, 0, 0], "scale": [0.9, 0.24, 0.86]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "undercarriage", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["central-cassette", "support-fins"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside", "full-object"], "details": ["central-cassette", "support-fins"], "fidelityTier": "blockout"};
  node_undercarriage_2.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "undercarriage", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["root"] ?? root).add(node_undercarriage_2);
  nodes["undercarriage"] = node_undercarriage_2;
  const mesh_undercarriage_2Geometry = endpoint_undercarriage_2
    ? new THREE.CylinderGeometry(endpoint_undercarriage_2.endRadius, endpoint_undercarriage_2.baseRadius, endpoint_undercarriage_2.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_undercarriage_2) {
    mesh_undercarriage_2Geometry.scale(0.9, 0.24, 0.86);
  }
  const mesh_undercarriage_2 = new THREE.Mesh(
    mesh_undercarriage_2Geometry,
    materialMap["graphite"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_undercarriage_2.name = "Inset graphite undercarriage";
  if (endpoint_undercarriage_2) {
    mesh_undercarriage_2.position.copy(endpoint_undercarriage_2.midpoint);
    mesh_undercarriage_2.quaternion.copy(endpoint_undercarriage_2.quaternion);
  }
  mesh_undercarriage_2.castShadow = options.castShadow ?? true;
  mesh_undercarriage_2.receiveShadow = options.receiveShadow ?? true;
  mesh_undercarriage_2.userData.sculptComponent = {"id": "undercarriage", "name": "Inset graphite undercarriage", "level": "macro", "role": "chassis", "importance": 0.95, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-surface", "contactType": "overlap", "localStart": [0, 0.17, 0], "localEnd": [0, 0.17, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.9, "height": 0.24, "depth": 0.86, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.17, 0], "rotation": [0, 0, 0], "scale": [0.9, 0.24, 0.86]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "undercarriage", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["central-cassette", "support-fins"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside", "full-object"], "details": ["central-cassette", "support-fins"], "fidelityTier": "blockout"};
  node_undercarriage_2.add(mesh_undercarriage_2);
  meshes["undercarriage"] = mesh_undercarriage_2;
  colliders["undercarriage"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["undercarriage"] ??= [];
  destructionGroups["undercarriage"].push(node_undercarriage_2);

  const endpoint_top_panel_x_3 = makeAttachmentEndpoint(null);
  const node_top_panel_x_3 = new THREE.Group();
  node_top_panel_x_3.name = "Top longitudinal panel seam__pivot";
  node_top_panel_x_3.scale.set(1, 1, 1);
  if (endpoint_top_panel_x_3) {
    node_top_panel_x_3.position.copy(endpoint_top_panel_x_3.start);
    node_top_panel_x_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_top_panel_x_3.position.set(0.0, 0.13, 0.0);
    node_top_panel_x_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_top_panel_x_3.userData.sculptComponent = {"id": "top-panel-x", "name": "Top longitudinal panel seam", "level": "meso", "role": "seam", "importance": 0.72, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, 0.13, 0], "localEnd": [0, 0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 0.012, "height": 0.008, "depth": 0.78, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.13, 0], "rotation": [0, 0, 0], "scale": [0.012, 0.008, 0.78]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-x", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["top-seam-longitudinal"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck"], "details": ["top-seam-longitudinal"], "fidelityTier": "structural"};
  node_top_panel_x_3.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-x", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_top_panel_x_3);
  nodes["top-panel-x"] = node_top_panel_x_3;
  const mesh_top_panel_x_3Geometry = endpoint_top_panel_x_3
    ? new THREE.CylinderGeometry(endpoint_top_panel_x_3.endRadius, endpoint_top_panel_x_3.baseRadius, endpoint_top_panel_x_3.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_top_panel_x_3) {
    mesh_top_panel_x_3Geometry.scale(0.012, 0.008, 0.78);
  }
  const mesh_top_panel_x_3 = new THREE.Mesh(
    mesh_top_panel_x_3Geometry,
    materialMap["dark-detail"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_top_panel_x_3.name = "Top longitudinal panel seam";
  if (endpoint_top_panel_x_3) {
    mesh_top_panel_x_3.position.copy(endpoint_top_panel_x_3.midpoint);
    mesh_top_panel_x_3.quaternion.copy(endpoint_top_panel_x_3.quaternion);
  }
  mesh_top_panel_x_3.castShadow = options.castShadow ?? true;
  mesh_top_panel_x_3.receiveShadow = options.receiveShadow ?? true;
  mesh_top_panel_x_3.userData.sculptComponent = {"id": "top-panel-x", "name": "Top longitudinal panel seam", "level": "meso", "role": "seam", "importance": 0.72, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, 0.13, 0], "localEnd": [0, 0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 0.012, "height": 0.008, "depth": 0.78, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.13, 0], "rotation": [0, 0, 0], "scale": [0.012, 0.008, 0.78]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-x", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["top-seam-longitudinal"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck"], "details": ["top-seam-longitudinal"], "fidelityTier": "structural"};
  node_top_panel_x_3.add(mesh_top_panel_x_3);
  meshes["top-panel-x"] = mesh_top_panel_x_3;
  colliders["top-panel-x"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["top-panel-x"] ??= [];
  destructionGroups["top-panel-x"].push(node_top_panel_x_3);

  const endpoint_top_panel_z_4 = makeAttachmentEndpoint(null);
  const node_top_panel_z_4 = new THREE.Group();
  node_top_panel_z_4.name = "Top lateral panel seam__pivot";
  node_top_panel_z_4.scale.set(1, 1, 1);
  if (endpoint_top_panel_z_4) {
    node_top_panel_z_4.position.copy(endpoint_top_panel_z_4.start);
    node_top_panel_z_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_top_panel_z_4.position.set(0.0, 0.13, 0.0);
    node_top_panel_z_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_top_panel_z_4.userData.sculptComponent = {"id": "top-panel-z", "name": "Top lateral panel seam", "level": "meso", "role": "seam", "importance": 0.72, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, 0.13, 0], "localEnd": [0, 0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 0.78, "height": 0.008, "depth": 0.012, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.13, 0], "rotation": [0, 0, 0], "scale": [0.78, 0.008, 0.012]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-z", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["top-seam-lateral"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck"], "details": ["top-seam-lateral"], "fidelityTier": "structural"};
  node_top_panel_z_4.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-z", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_top_panel_z_4);
  nodes["top-panel-z"] = node_top_panel_z_4;
  const mesh_top_panel_z_4Geometry = endpoint_top_panel_z_4
    ? new THREE.CylinderGeometry(endpoint_top_panel_z_4.endRadius, endpoint_top_panel_z_4.baseRadius, endpoint_top_panel_z_4.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_top_panel_z_4) {
    mesh_top_panel_z_4Geometry.scale(0.78, 0.008, 0.012);
  }
  const mesh_top_panel_z_4 = new THREE.Mesh(
    mesh_top_panel_z_4Geometry,
    materialMap["dark-detail"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_top_panel_z_4.name = "Top lateral panel seam";
  if (endpoint_top_panel_z_4) {
    mesh_top_panel_z_4.position.copy(endpoint_top_panel_z_4.midpoint);
    mesh_top_panel_z_4.quaternion.copy(endpoint_top_panel_z_4.quaternion);
  }
  mesh_top_panel_z_4.castShadow = options.castShadow ?? true;
  mesh_top_panel_z_4.receiveShadow = options.receiveShadow ?? true;
  mesh_top_panel_z_4.userData.sculptComponent = {"id": "top-panel-z", "name": "Top lateral panel seam", "level": "meso", "role": "seam", "importance": 0.72, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, 0.13, 0], "localEnd": [0, 0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["top-deck"]}, "dimensions": {"width": 0.78, "height": 0.008, "depth": 0.012, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, 0.13, 0], "rotation": [0, 0, 0], "scale": [0.78, 0.008, 0.012]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "top-panel-z", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["top-seam-lateral"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["top-deck"], "details": ["top-seam-lateral"], "fidelityTier": "structural"};
  node_top_panel_z_4.add(mesh_top_panel_z_4);
  meshes["top-panel-z"] = mesh_top_panel_z_4;
  colliders["top-panel-z"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["top-panel-z"] ??= [];
  destructionGroups["top-panel-z"].push(node_top_panel_z_4);

  const endpoint_fascia_5 = makeAttachmentEndpoint(null);
  const node_fascia_5 = new THREE.Group();
  node_fascia_5.name = "Segmented perimeter fascia__pivot";
  node_fascia_5.scale.set(1, 1, 1);
  if (endpoint_fascia_5) {
    node_fascia_5.position.copy(endpoint_fascia_5.start);
    node_fascia_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fascia_5.position.set(0.0, -0.05, 0.475);
    node_fascia_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_fascia_5.userData.sculptComponent = {"id": "fascia", "name": "Segmented perimeter fascia", "level": "meso", "role": "panel", "importance": 0.86, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, -0.05, 0.475], "localEnd": [0, -0.05, 0.475], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["front-fascia"]}, "dimensions": {"width": 0.76, "height": 0.14, "depth": 0.07, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.05, 0.475], "rotation": [0, 0, 0], "scale": [0.76, 0.14, 0.07]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["front-fascia"], "details": ["panel-grooves"], "fidelityTier": "structural"};
  node_fascia_5.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_fascia_5);
  nodes["fascia"] = node_fascia_5;
  const mesh_fascia_5Geometry = endpoint_fascia_5
    ? new THREE.CylinderGeometry(endpoint_fascia_5.endRadius, endpoint_fascia_5.baseRadius, endpoint_fascia_5.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_fascia_5) {
    mesh_fascia_5Geometry.scale(0.76, 0.14, 0.07);
  }
  const mesh_fascia_5 = new THREE.Mesh(
    mesh_fascia_5Geometry,
    materialMap["shell-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fascia_5.name = "Segmented perimeter fascia";
  if (endpoint_fascia_5) {
    mesh_fascia_5.position.copy(endpoint_fascia_5.midpoint);
    mesh_fascia_5.quaternion.copy(endpoint_fascia_5.quaternion);
  }
  mesh_fascia_5.castShadow = options.castShadow ?? true;
  mesh_fascia_5.receiveShadow = options.receiveShadow ?? true;
  mesh_fascia_5.userData.sculptComponent = {"id": "fascia", "name": "Segmented perimeter fascia", "level": "meso", "role": "panel", "importance": 0.86, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, -0.05, 0.475], "localEnd": [0, -0.05, 0.475], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["front-fascia"]}, "dimensions": {"width": 0.76, "height": 0.14, "depth": 0.07, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.05, 0.475], "rotation": [0, 0, 0], "scale": [0.76, 0.14, 0.07]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["front-fascia"], "details": ["panel-grooves"], "fidelityTier": "structural"};
  node_fascia_5.add(mesh_fascia_5);
  meshes["fascia"] = mesh_fascia_5;
  colliders["fascia"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["fascia"] ??= [];
  destructionGroups["fascia"].push(node_fascia_5);

  const endpoint_rear_fascia_6 = makeAttachmentEndpoint(null);
  const node_rear_fascia_6 = new THREE.Group();
  node_rear_fascia_6.name = "Rear fascia__pivot";
  node_rear_fascia_6.scale.set(1, 1, 1);
  if (endpoint_rear_fascia_6) {
    node_rear_fascia_6.position.copy(endpoint_rear_fascia_6.start);
    node_rear_fascia_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_rear_fascia_6.position.set(0.0, -0.05, -0.475);
    node_rear_fascia_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_rear_fascia_6.userData.sculptComponent = {"id": "rear-fascia", "name": "Rear fascia", "level": "meso", "role": "panel", "importance": 0.68, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, -0.05, -0.475], "localEnd": [0, -0.05, -0.475], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.76, "height": 0.14, "depth": 0.07, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.05, -0.475], "rotation": [0, 0, 0], "scale": [0.76, 0.14, 0.07]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["rear-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["rear-panel-grooves"], "fidelityTier": "structural"};
  node_rear_fascia_6.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_rear_fascia_6);
  nodes["rear-fascia"] = node_rear_fascia_6;
  const mesh_rear_fascia_6Geometry = endpoint_rear_fascia_6
    ? new THREE.CylinderGeometry(endpoint_rear_fascia_6.endRadius, endpoint_rear_fascia_6.baseRadius, endpoint_rear_fascia_6.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_rear_fascia_6) {
    mesh_rear_fascia_6Geometry.scale(0.76, 0.14, 0.07);
  }
  const mesh_rear_fascia_6 = new THREE.Mesh(
    mesh_rear_fascia_6Geometry,
    materialMap["shell-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rear_fascia_6.name = "Rear fascia";
  if (endpoint_rear_fascia_6) {
    mesh_rear_fascia_6.position.copy(endpoint_rear_fascia_6.midpoint);
    mesh_rear_fascia_6.quaternion.copy(endpoint_rear_fascia_6.quaternion);
  }
  mesh_rear_fascia_6.castShadow = options.castShadow ?? true;
  mesh_rear_fascia_6.receiveShadow = options.receiveShadow ?? true;
  mesh_rear_fascia_6.userData.sculptComponent = {"id": "rear-fascia", "name": "Rear fascia", "level": "meso", "role": "panel", "importance": 0.68, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0, -0.05, -0.475], "localEnd": [0, -0.05, -0.475], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.76, "height": 0.14, "depth": 0.07, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.05, -0.475], "rotation": [0, 0, 0], "scale": [0.76, 0.14, 0.07]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["rear-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["rear-panel-grooves"], "fidelityTier": "structural"};
  node_rear_fascia_6.add(mesh_rear_fascia_6);
  meshes["rear-fascia"] = mesh_rear_fascia_6;
  colliders["rear-fascia"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["rear-fascia"] ??= [];
  destructionGroups["rear-fascia"].push(node_rear_fascia_6);

  const endpoint_left_fascia_7 = makeAttachmentEndpoint(null);
  const node_left_fascia_7 = new THREE.Group();
  node_left_fascia_7.name = "Left lateral fascia__pivot";
  node_left_fascia_7.scale.set(1, 1, 1);
  if (endpoint_left_fascia_7) {
    node_left_fascia_7.position.copy(endpoint_left_fascia_7.start);
    node_left_fascia_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_left_fascia_7.position.set(-0.475, -0.05, 0.0);
    node_left_fascia_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_left_fascia_7.userData.sculptComponent = {"id": "left-fascia", "name": "Left lateral fascia", "level": "meso", "role": "panel", "importance": 0.76, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [-0.475, -0.05, 0], "localEnd": [-0.475, -0.05, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.14, "depth": 0.76, "units": "relative", "confidence": 0.94}, "transform": {"position": [-0.475, -0.05, 0], "rotation": [0, 0, 0], "scale": [0.07, 0.14, 0.76]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["left-panel-grooves"], "fidelityTier": "structural"};
  node_left_fascia_7.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_left_fascia_7);
  nodes["left-fascia"] = node_left_fascia_7;
  const mesh_left_fascia_7Geometry = endpoint_left_fascia_7
    ? new THREE.CylinderGeometry(endpoint_left_fascia_7.endRadius, endpoint_left_fascia_7.baseRadius, endpoint_left_fascia_7.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_left_fascia_7) {
    mesh_left_fascia_7Geometry.scale(0.07, 0.14, 0.76);
  }
  const mesh_left_fascia_7 = new THREE.Mesh(
    mesh_left_fascia_7Geometry,
    materialMap["shell-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_fascia_7.name = "Left lateral fascia";
  if (endpoint_left_fascia_7) {
    mesh_left_fascia_7.position.copy(endpoint_left_fascia_7.midpoint);
    mesh_left_fascia_7.quaternion.copy(endpoint_left_fascia_7.quaternion);
  }
  mesh_left_fascia_7.castShadow = options.castShadow ?? true;
  mesh_left_fascia_7.receiveShadow = options.receiveShadow ?? true;
  mesh_left_fascia_7.userData.sculptComponent = {"id": "left-fascia", "name": "Left lateral fascia", "level": "meso", "role": "panel", "importance": 0.76, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [-0.475, -0.05, 0], "localEnd": [-0.475, -0.05, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.14, "depth": 0.76, "units": "relative", "confidence": 0.94}, "transform": {"position": [-0.475, -0.05, 0], "rotation": [0, 0, 0], "scale": [0.07, 0.14, 0.76]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["left-panel-grooves"], "fidelityTier": "structural"};
  node_left_fascia_7.add(mesh_left_fascia_7);
  meshes["left-fascia"] = mesh_left_fascia_7;
  colliders["left-fascia"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["left-fascia"] ??= [];
  destructionGroups["left-fascia"].push(node_left_fascia_7);

  const endpoint_right_fascia_8 = makeAttachmentEndpoint(null);
  const node_right_fascia_8 = new THREE.Group();
  node_right_fascia_8.name = "Right lateral fascia__pivot";
  node_right_fascia_8.scale.set(1, 1, 1);
  if (endpoint_right_fascia_8) {
    node_right_fascia_8.position.copy(endpoint_right_fascia_8.start);
    node_right_fascia_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_right_fascia_8.position.set(0.475, -0.05, 0.0);
    node_right_fascia_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_right_fascia_8.userData.sculptComponent = {"id": "right-fascia", "name": "Right lateral fascia", "level": "meso", "role": "panel", "importance": 0.76, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0.475, -0.05, 0], "localEnd": [0.475, -0.05, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.14, "depth": 0.76, "units": "relative", "confidence": 0.94}, "transform": {"position": [0.475, -0.05, 0], "rotation": [0, 0, 0], "scale": [0.07, 0.14, 0.76]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["right-panel-grooves"], "fidelityTier": "structural"};
  node_right_fascia_8.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["deck-shell"] ?? root).add(node_right_fascia_8);
  nodes["right-fascia"] = node_right_fascia_8;
  const mesh_right_fascia_8Geometry = endpoint_right_fascia_8
    ? new THREE.CylinderGeometry(endpoint_right_fascia_8.endRadius, endpoint_right_fascia_8.baseRadius, endpoint_right_fascia_8.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_right_fascia_8) {
    mesh_right_fascia_8Geometry.scale(0.07, 0.14, 0.76);
  }
  const mesh_right_fascia_8 = new THREE.Mesh(
    mesh_right_fascia_8Geometry,
    materialMap["shell-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_fascia_8.name = "Right lateral fascia";
  if (endpoint_right_fascia_8) {
    mesh_right_fascia_8.position.copy(endpoint_right_fascia_8.midpoint);
    mesh_right_fascia_8.quaternion.copy(endpoint_right_fascia_8.quaternion);
  }
  mesh_right_fascia_8.castShadow = options.castShadow ?? true;
  mesh_right_fascia_8.receiveShadow = options.receiveShadow ?? true;
  mesh_right_fascia_8.userData.sculptComponent = {"id": "right-fascia", "name": "Right lateral fascia", "level": "meso", "role": "panel", "importance": 0.76, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(235, 239, 240, 1)", "secondaryAlbedo": "rgba(194, 203, 207, 1)", "materialClass": "metal", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(194, 203, 207, 1)"}, {"position": 1, "color": "rgba(235, 239, 240, 1)"}]}}, "parent": "deck-shell", "attachment": {"parentId": "deck-shell", "parentSocket": "deck-shell-surface", "contactType": "overlap", "localStart": [0.475, -0.05, 0], "localEnd": [0.475, -0.05, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.07, "height": 0.14, "depth": 0.76, "units": "relative", "confidence": 0.94}, "transform": {"position": [0.475, -0.05, 0], "rotation": [0, 0, 0], "scale": [0.07, 0.14, 0.76]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-fascia", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "shell-white", "materialLayers": ["shell-white"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-panel-grooves"], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.06, "bumpAmplitude": 0.012, "normalPattern": "reference-derived fine painted-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "sparse cool-gray edge scuffs near corners", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["full-object"], "details": ["right-panel-grooves"], "fidelityTier": "structural"};
  node_right_fascia_8.add(mesh_right_fascia_8);
  meshes["right-fascia"] = mesh_right_fascia_8;
  colliders["right-fascia"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["right-fascia"] ??= [];
  destructionGroups["right-fascia"].push(node_right_fascia_8);

  const endpoint_central_cassette_9 = makeAttachmentEndpoint(null);
  const node_central_cassette_9 = new THREE.Group();
  node_central_cassette_9.name = "Central underside cassette__pivot";
  node_central_cassette_9.scale.set(1, 1, 1);
  if (endpoint_central_cassette_9) {
    node_central_cassette_9.position.copy(endpoint_central_cassette_9.start);
    node_central_cassette_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_central_cassette_9.position.set(0.0, -0.155, 0.02);
    node_central_cassette_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_central_cassette_9.userData.sculptComponent = {"id": "central-cassette", "name": "Central underside cassette", "level": "meso", "role": "support", "importance": 0.82, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [0, -0.155, 0.02], "localEnd": [0, -0.155, 0.02], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.38, "height": 0.23, "depth": 0.42, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.155, 0.02], "rotation": [0, 0, 0], "scale": [0.38, 0.23, 0.42]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "central-cassette", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["cassette-recess", "cassette-frame"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["cassette-recess", "cassette-frame"], "fidelityTier": "structural"};
  node_central_cassette_9.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "central-cassette", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["undercarriage"] ?? root).add(node_central_cassette_9);
  nodes["central-cassette"] = node_central_cassette_9;
  const mesh_central_cassette_9Geometry = endpoint_central_cassette_9
    ? new THREE.CylinderGeometry(endpoint_central_cassette_9.endRadius, endpoint_central_cassette_9.baseRadius, endpoint_central_cassette_9.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_central_cassette_9) {
    mesh_central_cassette_9Geometry.scale(0.38, 0.23, 0.42);
  }
  const mesh_central_cassette_9 = new THREE.Mesh(
    mesh_central_cassette_9Geometry,
    materialMap["graphite"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_central_cassette_9.name = "Central underside cassette";
  if (endpoint_central_cassette_9) {
    mesh_central_cassette_9.position.copy(endpoint_central_cassette_9.midpoint);
    mesh_central_cassette_9.quaternion.copy(endpoint_central_cassette_9.quaternion);
  }
  mesh_central_cassette_9.castShadow = options.castShadow ?? true;
  mesh_central_cassette_9.receiveShadow = options.receiveShadow ?? true;
  mesh_central_cassette_9.userData.sculptComponent = {"id": "central-cassette", "name": "Central underside cassette", "level": "meso", "role": "support", "importance": 0.82, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(26, 34, 42, 1)", "secondaryAlbedo": "rgba(7, 12, 17, 1)", "materialClass": "metal", "materialClassConfidence": 0.94, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(7, 12, 17, 1)"}, {"position": 1, "color": "rgba(26, 34, 42, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [0, -0.155, 0.02], "localEnd": [0, -0.155, 0.02], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.38, "height": 0.23, "depth": 0.42, "units": "relative", "confidence": 0.94}, "transform": {"position": [0, -0.155, 0.02], "rotation": [0, 0, 0], "scale": [0.38, 0.23, 0.42]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "central-cassette", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "graphite", "materialLayers": ["graphite"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["cassette-recess", "cassette-frame"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["cassette-recess", "cassette-frame"], "fidelityTier": "structural"};
  node_central_cassette_9.add(mesh_central_cassette_9);
  meshes["central-cassette"] = mesh_central_cassette_9;
  colliders["central-cassette"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["central-cassette"] ??= [];
  destructionGroups["central-cassette"].push(node_central_cassette_9);

  const endpoint_support_fin_left_10 = makeAttachmentEndpoint(null);
  const node_support_fin_left_10 = new THREE.Group();
  node_support_fin_left_10.name = "Left underside support fin__pivot";
  node_support_fin_left_10.scale.set(1, 1, 1);
  if (endpoint_support_fin_left_10) {
    node_support_fin_left_10.position.copy(endpoint_support_fin_left_10.start);
    node_support_fin_left_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_support_fin_left_10.position.set(-0.28, -0.13, 0.0);
    node_support_fin_left_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_support_fin_left_10.userData.sculptComponent = {"id": "support-fin-left", "name": "Left underside support fin", "level": "meso", "role": "support", "importance": 0.66, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [-0.28, -0.13, 0], "localEnd": [-0.28, -0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.16, "height": 0.24, "depth": 0.5, "units": "relative", "confidence": 0.94}, "transform": {"position": [-0.28, -0.13, 0], "rotation": [0, 0, 0], "scale": [0.16, 0.24, 0.5]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["angled-fin-left"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["angled-fin-left"], "fidelityTier": "structural"};
  node_support_fin_left_10.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["undercarriage"] ?? root).add(node_support_fin_left_10);
  nodes["support-fin-left"] = node_support_fin_left_10;
  const mesh_support_fin_left_10Geometry = endpoint_support_fin_left_10
    ? new THREE.CylinderGeometry(endpoint_support_fin_left_10.endRadius, endpoint_support_fin_left_10.baseRadius, endpoint_support_fin_left_10.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_support_fin_left_10) {
    mesh_support_fin_left_10Geometry.scale(0.16, 0.24, 0.5);
  }
  const mesh_support_fin_left_10 = new THREE.Mesh(
    mesh_support_fin_left_10Geometry,
    materialMap["dark-detail"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_support_fin_left_10.name = "Left underside support fin";
  if (endpoint_support_fin_left_10) {
    mesh_support_fin_left_10.position.copy(endpoint_support_fin_left_10.midpoint);
    mesh_support_fin_left_10.quaternion.copy(endpoint_support_fin_left_10.quaternion);
  }
  mesh_support_fin_left_10.castShadow = options.castShadow ?? true;
  mesh_support_fin_left_10.receiveShadow = options.receiveShadow ?? true;
  mesh_support_fin_left_10.userData.sculptComponent = {"id": "support-fin-left", "name": "Left underside support fin", "level": "meso", "role": "support", "importance": 0.66, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [-0.28, -0.13, 0], "localEnd": [-0.28, -0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.16, "height": 0.24, "depth": 0.5, "units": "relative", "confidence": 0.94}, "transform": {"position": [-0.28, -0.13, 0], "rotation": [0, 0, 0], "scale": [0.16, 0.24, 0.5]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["angled-fin-left"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["angled-fin-left"], "fidelityTier": "structural"};
  node_support_fin_left_10.add(mesh_support_fin_left_10);
  meshes["support-fin-left"] = mesh_support_fin_left_10;
  colliders["support-fin-left"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["support-fin-left"] ??= [];
  destructionGroups["support-fin-left"].push(node_support_fin_left_10);

  const endpoint_support_fin_right_11 = makeAttachmentEndpoint(null);
  const node_support_fin_right_11 = new THREE.Group();
  node_support_fin_right_11.name = "Right underside support fin__pivot";
  node_support_fin_right_11.scale.set(1, 1, 1);
  if (endpoint_support_fin_right_11) {
    node_support_fin_right_11.position.copy(endpoint_support_fin_right_11.start);
    node_support_fin_right_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_support_fin_right_11.position.set(0.28, -0.13, 0.0);
    node_support_fin_right_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_support_fin_right_11.userData.sculptComponent = {"id": "support-fin-right", "name": "Right underside support fin", "level": "meso", "role": "support", "importance": 0.66, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [0.28, -0.13, 0], "localEnd": [0.28, -0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.16, "height": 0.24, "depth": 0.5, "units": "relative", "confidence": 0.94}, "transform": {"position": [0.28, -0.13, 0], "rotation": [0, 0, 0], "scale": [0.16, 0.24, 0.5]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["angled-fin-right"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["angled-fin-right"], "fidelityTier": "structural"};
  node_support_fin_right_11.userData.actionProfile = {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}};
  (nodes["undercarriage"] ?? root).add(node_support_fin_right_11);
  nodes["support-fin-right"] = node_support_fin_right_11;
  const mesh_support_fin_right_11Geometry = endpoint_support_fin_right_11
    ? new THREE.CylinderGeometry(endpoint_support_fin_right_11.endRadius, endpoint_support_fin_right_11.baseRadius, endpoint_support_fin_right_11.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_support_fin_right_11) {
    mesh_support_fin_right_11Geometry.scale(0.16, 0.24, 0.5);
  }
  const mesh_support_fin_right_11 = new THREE.Mesh(
    mesh_support_fin_right_11Geometry,
    materialMap["dark-detail"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_support_fin_right_11.name = "Right underside support fin";
  if (endpoint_support_fin_right_11) {
    mesh_support_fin_right_11.position.copy(endpoint_support_fin_right_11.midpoint);
    mesh_support_fin_right_11.quaternion.copy(endpoint_support_fin_right_11.quaternion);
  }
  mesh_support_fin_right_11.castShadow = options.castShadow ?? true;
  mesh_support_fin_right_11.receiveShadow = options.receiveShadow ?? true;
  mesh_support_fin_right_11.userData.sculptComponent = {"id": "support-fin-right", "name": "Right underside support fin", "level": "meso", "role": "support", "importance": 0.66, "confidence": 0.84, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "The reference shows a discrete rigid hard-surface part with countable planar faces and manufactured seams.", "geometryDescriptor": {"topologyIntent": "beveled hard-surface game prop", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.018, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "weighted vertex normals from generated geometry"}, "colorMaterialRecipe": {"dominantAlbedo": "rgba(65, 76, 85, 1)", "secondaryAlbedo": "rgba(12, 17, 22, 1)", "materialClass": "metal", "materialClassConfidence": 0.93, "colorGradient": {"type": "linear", "axis": [0, 1, 0], "stops": [{"position": 0, "color": "rgba(12, 17, 22, 1)"}, {"position": 1, "color": "rgba(65, 76, 85, 1)"}]}}, "parent": "undercarriage", "attachment": {"parentId": "undercarriage", "parentSocket": "undercarriage-surface", "contactType": "overlap", "localStart": [0.28, -0.13, 0], "localEnd": [0.28, -0.13, 0], "contactNormal": [0, 1, 0], "overlap": 0.025, "embedDepth": 0.025, "gapTolerance": 0.01, "evidenceRefs": ["underside"]}, "dimensions": {"width": 0.16, "height": 0.24, "depth": 0.5, "units": "relative", "confidence": 0.94}, "transform": {"position": [0.28, -0.13, 0], "rotation": [0, 0, 0], "scale": [0.16, 0.24, 0.5]}, "actionProfile": {"animationRole": "static-presentation", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.95}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "support-fin-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "graphite"}}, "material": "dark-detail", "materialLayers": ["dark-detail"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["angled-fin-right"], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.08, "bumpAmplitude": 0.008, "normalPattern": "fine machined-metal variation", "displacementPattern": "none; silhouette relief is geometry", "occlusionPattern": "darken sockets, seams, and chassis overlaps", "edgeWearPattern": "subtle polished bevel crests", "notes": "Keep microstructure below gameplay silhouette scale."}, "evidenceRefs": ["underside"], "details": ["angled-fin-right"], "fidelityTier": "structural"};
  node_support_fin_right_11.add(mesh_support_fin_right_11);
  meshes["support-fin-right"] = mesh_support_fin_right_11;
  colliders["support-fin-right"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Presentation-only; authoritative collision remains on the parent gameplay mesh."};
  destructionGroups["support-fin-right"] ??= [];
  destructionGroups["support-fin-right"].push(node_support_fin_right_11);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createTraversalMovingPlatformLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Traversal Moving Platform look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["Key light: large cool-white area source above/front-left, intensity 2.4, soft shadows.", "Fill light: low-intensity neutral fill from front-right, intensity 0.65, preserves graphite detail.", "Rim/environment: cyan-neutral environment reflection plus subtle rear rim, intensity 0.8.", "Exposure/tone mapping: ACES Filmic, exposure 1.05, near-black blue background #071016.", "Contact shadow: soft AO/contact shadow directly below cassette and support fins."];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createTraversalMovingPlatformEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameTraversalMovingPlatformCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createTraversalMovingPlatformPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureTraversalMovingPlatformRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createTraversalMovingPlatformInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
