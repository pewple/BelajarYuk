/**
 * The pony in Kuda: a three.js scene meshed from signed-distance fields and
 * auto-rigged when the screen opens. No models, no textures.
 *
 * Based on "Horse" from typescript.dev (https://www.typescript.dev/), a
 * procedural horse with gaits, steering and rearing. Changed here into a pony
 * for a three-year-old: shorter legs and a bigger head, no eyes, a fuller mane,
 * reworked hind legs, a coat and mane that can be recoloured, carrots and
 * apples to eat, and none of the grown-up controls (x-ray, speed readout).
 *
 * `createPony` owns everything it makes and `dispose` gives it all back, so
 * the screen can come and go as often as the child likes.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import type { FoodId, KindId, PatternId } from '../data/kuda';

/* ───────────────────────────── helpers ───────────────────────────── */
type Vec3 = [number, number, number];
const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const wrapPi = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const damp = (a: number, b: number, k: number, dt: number) => lerp(a, b, 1 - Math.exp(-k * dt));
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(i: number, j: number, k: number) {
  let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  let fx = x - i, fy = y - j, fz = z - k;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = lerp(lerp(hash3(i, j, k), hash3(i + 1, j, k), fx), lerp(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), fx), fy);
  const b = lerp(
    lerp(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), fx),
    lerp(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), fx),
    fy,
  );
  return lerp(a, b, fz);
}
/** Distance to the nearest of a scatter of points, one per unit cell: round spots, wherever it is small. */
function worley(x: number, y: number, z: number) {
  const i0 = Math.floor(x), j0 = Math.floor(y), k0 = Math.floor(z);
  let d = 9;
  for (let i = i0 - 1; i <= i0 + 1; i++)
    for (let j = j0 - 1; j <= j0 + 1; j++)
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        const px = i + hash3(i, j, k), py = j + hash3(j + 31, k, i), pz = k + hash3(k, i + 57, j);
        d = Math.min(d, Math.hypot(x - px, y - py, z - pz));
      }
  return d;
}
function keys(k: [number, number][], x: number) {
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++)
    if (x <= k[i][0]) {
      const t = (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return lerp(k[i - 1][1], k[i][1], t * t * (3 - 2 * t));
    }
  return k[k.length - 1][1];
}
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const rgb = (hex: string): Vec3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ───────────────────────────── proportions: foal, pony, grown horse ─────────────────────────────
   The anatomy below is written for a 16-hand horse. Every point goes through
   `P` on its way in, which reshapes it for the chosen age: the legs are
   stretched or squashed between the fetlock and the belly, the trunk is made
   shorter and slimmer for a foal, the neck is shortened toward the withers
   but keeps its girth, and the head grows about the throat. The finished
   animal is then scaled as a whole - a foal is small. */
export type PonyAge = KindId;
type Build = {
  /** Leg length between fetlock and belly, against a horse's. */
  legK: number;
  /** Trunk length, front to back. */
  xLen: number;
  /** Girth of the trunk and neck, and of the lower legs. */
  girth: number;
  legR: number;
  /** How much of the neck's length is kept, and how much the head grows on top of that. */
  neckS: number;
  headGrow: number;
  /** Face length from poll to muzzle. */
  face: number;
  /** Mane and tail length. */
  mane: number;
  tail: number;
  /** The whole animal, as built. */
  size: number;
  /** How far the forehand sinks to graze: a leggy foal has to splay its front legs to reach the ground. */
  grazeDrop: number;
  /** A unicorn's horn on the forehead. */
  horn?: boolean;
};
const BUILDS: Record<PonyAge, Build> = {
  // A foal (belo): about two thirds of a grown horse's height at the withers, but nearly all of
  // that is leg - its legs are three quarters as long as its mother's - under a short slim body,
  // a big head on a short neck, a brush of mane and a stub of a tail.
  anak: { legK: 1.25, xLen: 0.82, girth: 0.82, legR: 0.8, neckS: 0.8, headGrow: 1.4, face: 0.78, mane: 0.4, tail: 0.42, size: 0.58, grazeDrop: 0.5 },
  // A pony foal: a pony's short legs, lengthened a little the way a foal's are, on a short,
  // round, chubby body; a big head, a fluffy brush of mane and a stub of a tail. Small: a
  // little over half the height of a grown horse at the withers.
  poni: { legK: 0.86, xLen: 0.84, girth: 0.92, legR: 0.9, neckS: 0.74, headGrow: 1.5, face: 0.76, mane: 0.45, tail: 0.45, size: 0.6, grazeDrop: 0.2 },
  // A grown horse, much as "Horse" draws it.
  dewasa: { legK: 1, xLen: 1, girth: 0.96, legR: 1, neckS: 1, headGrow: 1, face: 1, mane: 0.88, tail: 1.05, size: 1, grazeDrop: 0.22 },
  // A unicorn: the grown horse, with a horn.
  unikorn: { legK: 1, xLen: 1, girth: 0.96, legR: 1, neckS: 1, headGrow: 1, face: 1, mane: 0.88, tail: 1.05, size: 1, grazeDrop: 0.22, horn: true },
};
const FOOT = 0.1, LEG_TOP = 1.0;
/** Where the neck leaves the chest. */
const NECK_BASE = [0.55, 1.38];
/** The throat the head grows about, in horse space. */
const HEAD_PIVOT = [1.04, 1.85];
export type Region = 'body' | 'neck' | 'head';
/** The reshaping for one age: points in, points out. */
function shaper(bd: Build) {
  const DROP = (LEG_TOP - FOOT) * (1 - bd.legK);
  const warpY = (y: number) => (y <= FOOT ? y : y < LEG_TOP ? FOOT + (y - FOOT) * bd.legK : y - DROP);
  const unwarpY = (y: number) => (y <= FOOT ? y : y < LEG_TOP - DROP ? FOOT + (y - FOOT) / bd.legK : y + DROP);
  /** How big the head ends up against a horse's. */
  const HEAD_S = bd.neckS * bd.headGrow;
  const P = (p: readonly number[], region: Region = 'body'): Vec3 => {
    let x = p[0], y = p[1], z = p[2] ?? 0;
    if (region !== 'body') {
      x = NECK_BASE[0] + (x - NECK_BASE[0]) * bd.neckS;
      y = NECK_BASE[1] + (y - NECK_BASE[1]) * bd.neckS;
    }
    if (region === 'head') {
      const px = NECK_BASE[0] + (HEAD_PIVOT[0] - NECK_BASE[0]) * bd.neckS, py = NECK_BASE[1] + (HEAD_PIVOT[1] - NECK_BASE[1]) * bd.neckS;
      x = px + (x - px) * bd.headGrow;
      y = py + (y - py) * bd.headGrow;
      z *= HEAD_S;
    } else z *= bd.girth;
    // A shorter trunk squeezes toward the middle; the neck and head ride along with the withers.
    x = region === 'body' ? x * bd.xLen : x + NECK_BASE[0] * (bd.xLen - 1);
    return [x, warpY(y), z];
  };
  return { warpY, unwarpY, P, HEAD_S };
}

/* ───────────────────────────── gaits ───────────────────────────── */
/** What the buttons offer: stand, walk, trot, gallop. */
export type PonyGait = 0 | 1 | 2 | 3;
export const GAIT_COUNT = 4;
// A pony's stride is shorter than a horse's, so every speed is lower too.
const GAITS = [0, 1.1, 2.5, 7.0];
// footfall offsets are [FL, FR, HL, HR] as fractions of the stride; duty = share of the stride each hoof is grounded
type GaitKey = {
  v: number; T: number; duty: number; off: number[]; hF: number; hH: number; knee: number; load: number;
  base: number; amp: number; W: number; spine: number; neck: number;
};
const KEYS: GaitKey[] = [
  { v: 0.0, T: 1.3, duty: 0.8, off: [0.25, 0.75, 0, 0.5], hF: 0.05, hH: 0.04, knee: 40, load: 5, base: 0, amp: 0, W: 0.5, spine: 0, neck: 0 },
  { v: 1.1, T: 0.95, duty: 0.63, off: [0.25, 0.75, 0, 0.5], hF: 0.085, hH: 0.07, knee: 60, load: 8, base: -0.02, amp: 0.025, W: 0.5, spine: 0, neck: 2 },
  { v: 2.5, T: 0.6, duty: 0.42, off: [0.5, 1.0, 0, 0.5], hF: 0.14, hH: 0.14, knee: 84, load: 12, base: 0.015, amp: -0.05, W: 0.5, spine: 0, neck: 4 },
  { v: 4.3, T: 0.55, duty: 0.32, off: [0.28, 0.56, 0, 0.28], hF: 0.2, hH: 0.2, knee: 96, load: 15, base: 0.01, amp: -0.04, W: 0.6, spine: 6, neck: 10 },
  { v: 7.0, T: 0.5, duty: 0.25, off: [0.4, 0.53, 0, 0.13], hF: 0.24, hH: 0.25, knee: 106, load: 18, base: 0.0, amp: -0.04, W: 0.6, spine: 10, neck: 20 },
];
const GAIT_KEYS = ['T', 'duty', 'hF', 'hH', 'knee', 'load', 'base', 'amp', 'W', 'spine', 'neck'] as const;

/* ───────────────────────────── public api ───────────────────────────── */
export type PonyColors = {
  body: string;
  points: string;
  muzzle: string;
  maneDark: string;
  maneLight: string;
  rainbow?: boolean;
  /** A pattern over the coat: none, appaloosa spots, pinto patches, or dapples. */
  pattern?: PatternId;
};

export type PonyEvents = {
  /** The pony is built and moving. */
  onReady?: () => void;
  /** The pony changed gait by itself (it stops to eat, or to rear). */
  onGait?: (gait: PonyGait) => void;
  /** It finished eating. */
  onAte?: (food: FoodId) => void;
  /** Building failed: no WebGL, or out of memory. */
  onError?: (error: unknown) => void;
};

export type PonyApi = {
  setGait: (gait: PonyGait) => void;
  /** 1 = left, -1 = right, 0 = straight on. */
  steer: (dir: -1 | 0 | 1) => void;
  rear: () => void;
  /** Puts the food down in front of the pony; it stops and eats it. False if it is busy eating already. */
  feed: (food: FoodId) => boolean;
  /** True while there is food down or being eaten. */
  isEating: () => boolean;
  setColors: (colors: PonyColors) => void;
  dispose: () => void;
};

/** True when this browser can draw the pony at all. */
export function canDrawPony(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    // Hand the test context straight back: browsers allow only a few at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/* ───────────────────────────── the scene ───────────────────────────── */
export function createPony(canvas: HTMLCanvasElement, colors: PonyColors, events: PonyEvents = {}, age: PonyAge = 'anak'): PonyApi {
  const bd = BUILDS[age];
  const { unwarpY, P, HEAD_S } = shaper(bd);
  /** The whole animal's scale: a foal is built like the others, then made small. */
  const S = bd.size;
  /** The camera is the same for every horse, so a foal looks as small beside the field as it is. */
  const tall = 1.0;
  let disposed = false;
  let raf = 0;
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement | Window,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ) => {
    el.addEventListener(type, fn as EventListener);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener));
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.56;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 8000);
  camera.position.set(3.0 * tall, 1.2 * tall, 3.6 * tall);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.25 * tall, 0.74 * tall, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.9;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.update();

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A tall phone screen would crop the pony's nose and tail: pull back instead.
    camera.fov = w < h ? 34 + 16 * clamp(h / w - 1, 0, 1) : 34;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  cleanups.push(() => ro?.disconnect());

  const FOG = new THREE.Color(0xc9d6e2);
  scene.fog = new THREE.Fog(FOG, 30, 520);

  const sunDir = new V3(-0.5, 0.5, 0.72).normalize();
  const sky = new Sky();
  sky.scale.setScalar(4000);
  {
    const u = sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.9;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(sunDir);
  }
  let envTexture: THREE.Texture | null = null;
  {
    // image-based lighting from the sky + a green ground bounce
    const envScene = new THREE.Scene();
    envScene.add(sky);
    const bounce = new THREE.Mesh(new THREE.CircleGeometry(3000, 32), new THREE.MeshBasicMaterial({ color: 0x5d7a35 }));
    bounce.rotation.x = -Math.PI / 2;
    bounce.position.y = -3;
    envScene.add(bounce);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0, 0.1, 9000).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();
    bounce.geometry.dispose();
    (bounce.material as THREE.Material).dispose();
    scene.add(sky);
  }
  const sun = new THREE.DirectionalLight(0xffedd2, 5.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  {
    const c = sun.shadow.camera;
    c.left = -2.6; c.right = 2.6; c.top = 2.6; c.bottom = -2.6; c.near = 1; c.far = 80;
  }
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xc4d8f0, 0x5d7038, 1.25));

  /* ───────────────────────────── environment ───────────────────────────── */
  function groundTexture() {
    const S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#6d8b3c';
    g.fillRect(0, 0, S, S);
    const r = mulberry(7);
    const cols = ['#587a30', '#7a9a44', '#64853a', '#8ea24c', '#4f7030', '#9aa353'];
    for (let i = 0; i < 5200; i++) {
      const x = r() * S, y = r() * S, rad = 2 + r() * r() * 26;
      g.globalAlpha = 0.05 + r() * 0.13;
      g.fillStyle = cols[(r() * cols.length) | 0];
      const rx = rad, ry = rad * (0.5 + r() * 0.5), rot = r() * 3.14;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, rx, ry, rot, 0, TAU);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const GROUND_TILE = 14;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  ground.material.map!.repeat.setScalar(4000 / GROUND_TILE);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // distant hills (acts like a backdrop: follows the pony)
  const hills = (() => {
    const N = 360, R = 1700, pos: number[] = [], col: number[] = [], idx: number[] = [];
    const far = new THREE.Color(0x9bafc6), c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const n = vnoise(ca * 2.2 + 5, sa * 2.2 + 5, 0) * 0.6 + vnoise(ca * 6 + 9, sa * 6, 3) * 0.28 + vnoise(ca * 17, sa * 17, 7) * 0.12;
      const h = 40 + 330 * Math.pow(n, 1.6);
      pos.push(ca * R, -10, sa * R, ca * R, h, sa * R);
      c.copy(FOG);
      col.push(c.r, c.g, c.b);
      c.copy(FOG).lerp(far, clamp(h / 300, 0.2, 0.9));
      col.push(c.r, c.g, c.b);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  })();

  // grass: 3×3 identical instanced tiles that leapfrog around the pony
  const GRASS_S = 16, GRASS_N = 26000;
  const grassU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uFade: { value: new THREE.Vector2(14, 22) } };
  const grassTiles = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.33, 0.5, 0.07, 0.33, 0.5, 0.07, 0, 1, 0.24], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 1.1, 1.1, 1.1], 3));
    g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader =
        'uniform float uTime; uniform vec2 uCenter; uniform vec2 uFade;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ipos = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
        float ph = ipos.x * 0.55 + ipos.z * 0.4;
        float sway = (sin(uTime * 1.5 + ph) + 0.5 * sin(uTime * 2.7 + ph * 1.9)) * 0.09 * position.y * position.y;
        transformed.x += sway; transformed.z += sway * 0.5;
        transformed *= 1.0 - smoothstep(uFade.x, uFade.y, distance(ipos.xz, uCenter));
      #endif`,
        );
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n normal = normalize(vNormal);',
      );
    };
    const first = new THREE.InstancedMesh(g, mat, GRASS_N);
    const r = mulberry(99), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), s = new V3(), up = new V3(0, 1, 0);
    const c = new THREE.Color(), cA = new THREE.Color(0x6a9236), cB = new THREE.Color(0x98b550), cC = new THREE.Color(0xc4bd6a);
    for (let i = 0; i < GRASS_N; i++) {
      p.set((r() - 0.5) * GRASS_S, 0, (r() - 0.5) * GRASS_S);
      const patch = vnoise(p.x * 0.35 + 40, p.z * 0.35 + 40, 1);
      const h = (0.045 + 0.12 * r() * r()) * (0.6 + 0.9 * patch);
      q.setFromAxisAngle(up, r() * TAU);
      s.set(0.022 + r() * 0.024, h, h * 0.9);
      first.setMatrixAt(i, m4.compose(p, q, s));
      c.copy(cA).lerp(cB, r());
      if (r() < 0.14) c.lerp(cC, 0.4 + r() * 0.5);
      c.multiplyScalar(0.75 + 0.5 * patch);
      first.setColorAt(i, c);
    }
    const tiles: THREE.InstancedMesh[] = [];
    for (let i = 0; i < 9; i++) {
      const t = i === 0 ? first : new THREE.InstancedMesh(g, mat, GRASS_N);
      if (i) {
        t.instanceMatrix = first.instanceMatrix;
        t.instanceColor = first.instanceColor;
      }
      t.receiveShadow = true;
      t.userData.o = [(i % 3) - 1, ((i / 3) | 0) - 1];
      scene.add(t);
      tiles.push(t);
    }
    return tiles;
  })();

  /* ───────────────────────────── skeleton ─────────────────────────────
     Rest pose, metres. +X = forward, +Y = up, +Z = the pony's right. */
  const REST: Record<string, Vec3> = {};
  const HEAD_BONES = new Set(['head', 'earR', 'earL']);
  const NECK_BONES = new Set(['neck1', 'neck2', 'neck3']);
  const regionOf = (bone: string): Region => (HEAD_BONES.has(bone) ? 'head' : NECK_BONES.has(bone) ? 'neck' : 'body');
  const TRUNK_BONES = new Set(['body', 'ribs', 'chest', 'loin', 'hips', 'tail0', 'neck1', 'neck2', 'neck3']);
  const UPPER_LIMB = new Set(['scap', 'hum', 'fem']);
  const LOWER_LIMB = new Set(['rad', 'can', 'pas', 'tib', 'hcan', 'hpas']);
  /** How much a muscle's thickness changes with the age. */
  const radiusScale = (bone: string) => {
    if (HEAD_BONES.has(bone)) return HEAD_S;
    if (TRUNK_BONES.has(bone) || UPPER_LIMB.has(bone.slice(0, -1))) return bd.girth;
    if (LOWER_LIMB.has(bone.slice(0, -1))) return bd.legR;
    return 1;
  };
  const BONE_DEFS: [string, string | null, number[]][] = [
    ['body', null, [0.02, 1.28, 0]], ['ribs', 'body', [0.02, 1.28, 0]],
    ['chest', 'body', [0.4, 1.3, 0]],
    ['neck1', 'chest', [0.6, 1.41, 0]], ['neck2', 'neck1', [0.74, 1.55, 0]], ['neck3', 'neck2', [0.88, 1.69, 0]],
    ['head', 'neck3', [1.12, 1.89, 0]],
    ['loin', 'body', [-0.3, 1.34, 0]], ['hips', 'loin', [-0.6, 1.36, 0]],
    ['tail0', 'hips', [-0.9, 1.46, 0]], ['tail1', 'tail0', [-0.97, 1.3, 0]], ['tail2', 'tail1', [-1.01, 1.1, 0]],
    ['tail3', 'tail2', [-1.02, 0.88, 0]], ['tail4', 'tail3', [-1.02, 0.66, 0]],
  ];
  for (const s of [1, -1]) {
    const x = s > 0 ? 'R' : 'L';
    BONE_DEFS.push(
      ['ear' + x, 'head', [1.225, 1.99, s * 0.064]],
      ['scap' + x, 'chest', [0.42, 1.5, s * 0.12]], ['hum' + x, 'scap' + x, [0.68, 1.17, s * 0.19]],
      ['rad' + x, 'hum' + x, [0.47, 0.92, s * 0.185]], ['can' + x, 'rad' + x, [0.455, 0.5, s * 0.16]],
      ['pas' + x, 'can' + x, [0.45, 0.19, s * 0.15]], ['hoof' + x, 'pas' + x, [0.525, 0.08, s * 0.15]],
      // hind: hip, stifle, hock, fetlock, hoof
      ['fem' + x, 'hips', [-0.66, 1.27, s * 0.16]], ['tib' + x, 'fem' + x, [-0.48, 0.97, s * 0.21]],
      ['hcan' + x, 'tib' + x, [-0.76, 0.61, s * 0.165]], ['hpas' + x, 'hcan' + x, [-0.775, 0.21, s * 0.16]],
      ['hhoof' + x, 'hpas' + x, [-0.7, 0.08, s * 0.16]],
    );
  }
  const B: Record<string, THREE.Bone> = {};
  const boneList: THREE.Bone[] = [];
  const boneIndex: Record<string, number> = {};
  for (const [name, parent, p] of BONE_DEFS) {
    const b = new THREE.Bone();
    b.name = name;
    const rp = P(p, regionOf(name));
    REST[name] = rp;
    const pp = parent ? REST[parent] : [0, 0, 0];
    b.position.set(rp[0] - pp[0], rp[1] - pp[1], rp[2] - pp[2]);
    if (parent) B[parent].add(b);
    B[name] = b;
    boneIndex[name] = boneList.length;
    boneList.push(b);
  }

  /* ───────────────────────────── anatomy as distance fields ───────────────────────────── */
  type Prim = {
    t: 0 | 1; bone: number; k: number; f: number; sub: boolean; bb: number[];
    ax: number; ay: number; az: number; bax: number; bay: number; baz: number; l2: number; rr: number; a2: number; il2: number;
    r1: number; r2: number; sz: number; zc: number;
    cx: number; cy: number; cz: number; rx: number; ry: number; rz: number; co: number; si: number; rot: boolean; minr: number;
  };
  type PrimOpts = { sz?: number; k?: number; f?: number; sub?: boolean; rot?: number };
  const BLANK = {
    ax: 0, ay: 0, az: 0, bax: 0, bay: 0, baz: 0, l2: 1, rr: 0, a2: 1, il2: 1, r1: 0, r2: 0, sz: 1, zc: 0,
    cx: 0, cy: 0, cz: 0, rx: 1, ry: 1, rz: 1, co: 1, si: 0, rot: false, minr: 1,
  };
  const prims: Prim[] = [];
  /** Round cone (capsule with two radii), optional lateral squash. Points are in horse space; P() makes them pony. */
  function RC(bone: string, a0: readonly number[], b0: readonly number[], r1: number, r2: number, o: PrimOpts = {}) {
    const region = regionOf(bone), hs = region === 'head' ? HEAD_S : 1, rs = radiusScale(bone);
    const a = P(a0, region), b = P(b0, region);
    r1 *= rs; r2 *= rs;
    const sz = o.sz ?? 1, zc = (a[2] + b[2]) / 2;
    const az = zc + (a[2] - zc) / sz, bz = zc + (b[2] - zc) / sz;
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = bz - az;
    const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2;
    const k = (o.k ?? 0.03) * hs, f = (o.f ?? 0.065) * hs, R = Math.max(r1, r2), pad = Math.max(k + 0.03, f + 0.01);
    prims.push({
      ...BLANK, t: 0, bone: boneIndex[bone], ax: a[0], ay: a[1], az, bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2,
      r1, r2, sz, zc, k, f, sub: !!o.sub,
      bb: [Math.min(a[0], b[0]) - R - pad, Math.min(a[1], b[1]) - R - pad, Math.min(a[2], b[2]) - R - pad,
        Math.max(a[0], b[0]) + R + pad, Math.max(a[1], b[1]) + R + pad, Math.max(a[2], b[2]) + R + pad],
    });
  }
  /** Ellipsoid, optional tilt in the sagittal plane. */
  function EL(bone: string, c0: readonly number[], r0: readonly number[], o: PrimOpts = {}) {
    const region = regionOf(bone), hs = region === 'head' ? HEAD_S : 1, rs = radiusScale(bone);
    const c = P(c0, region);
    const r = [r0[0] * rs, r0[1] * rs, r0[2] * rs];
    // An ellipsoid that sits wholly within the stretched or squashed part of a leg goes with it.
    if (!o.rot && c0[1] + r0[1] < LEG_TOP && c0[1] - r0[1] > FOOT) r[1] *= bd.legK;
    const k = (o.k ?? 0.03) * hs, f = (o.f ?? 0.065) * hs, pad = Math.max(k + 0.03, f + 0.01), rot = (o.rot ?? 0) * D2R;
    const R = rot ? Math.max(r[0], r[1]) : 0;
    prims.push({
      ...BLANK, t: 1, bone: boneIndex[bone], cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2],
      co: Math.cos(rot), si: Math.sin(rot), rot: !!rot, k, f, sub: !!o.sub, minr: Math.min(r[0], r[1], r[2]),
      bb: [c[0] - (R || r[0]) - pad, c[1] - (R || r[1]) - pad, c[2] - r[2] - pad, c[0] + (R || r[0]) + pad, c[1] + (R || r[1]) + pad, c[2] + r[2] + pad],
    });
  }
  function evalPrim(Pr: Prim, x: number, y: number, z: number) {
    if (Pr.t === 0) {
      const pax = x - Pr.ax, pay = y - Pr.ay, paz = Pr.zc + (z - Pr.zc) / Pr.sz - Pr.az;
      const yy = pax * Pr.bax + pay * Pr.bay + paz * Pr.baz, zz = yy - Pr.l2;
      const q0 = pax * Pr.l2 - Pr.bax * yy, q1 = pay * Pr.l2 - Pr.bay * yy, q2 = paz * Pr.l2 - Pr.baz * yy;
      const x2 = q0 * q0 + q1 * q1 + q2 * q2, y2 = yy * yy * Pr.l2, z2 = zz * zz * Pr.l2;
      const k = Math.sign(Pr.rr) * Pr.rr * Pr.rr * x2;
      if (Math.sign(zz) * Pr.a2 * z2 > k) return Math.sqrt(x2 + z2) * Pr.il2 - Pr.r2;
      if (Math.sign(yy) * Pr.a2 * y2 < k) return Math.sqrt(x2 + y2) * Pr.il2 - Pr.r1;
      return (Math.sqrt(x2 * Pr.a2 * Pr.il2) + yy * Pr.rr) * Pr.il2 - Pr.r1;
    }
    let dx = x - Pr.cx, dy = y - Pr.cy;
    const dz = z - Pr.cz;
    if (Pr.rot) {
      const t = dx * Pr.co + dy * Pr.si;
      dy = -dx * Pr.si + dy * Pr.co;
      dx = t;
    }
    const ax = dx / Pr.rx, ay = dy / Pr.ry, az = dz / Pr.rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / Pr.rx, by = ay / Pr.ry, bz = az / Pr.rz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Pr.minr : (k0 * (k0 - 1)) / k1;
  }

  // head frame (horse space): poll, face-line direction d, and n pointing toward the jaw
  const POLL = [1.26, 1.98], HD = [0.62, -0.78], HN = [-0.78, -0.62];
  // A pony's face is short: everything along the face line comes a little closer to the poll.
  const FACE = bd.face;
  const HP = (a: number, b: number, z = 0): Vec3 => [POLL[0] + HD[0] * a * FACE + HN[0] * b, POLL[1] + HD[1] * a * FACE + HN[1] * b, z];
  const MUZZLE = P(HP(0.555, 0.075), 'head'), STAR = P(HP(0.15, 0.0), 'head'), NOSTRIL = P(HP(0.56, 0.03), 'head');

  function defineAnatomy() {
    const T = { k: 0.065, f: 0.14 };
    // barrel: a pony is round
    RC('chest', [0.42, 1.185, 0], [0.16, 1.195, 0], 0.345, 0.35, { sz: 0.9, ...T });
    RC('ribs', [0.16, 1.195, 0], [-0.14, 1.235, 0], 0.35, 0.315, { sz: 0.94, ...T });
    RC('loin', [-0.14, 1.235, 0], [-0.42, 1.3, 0], 0.315, 0.26, { sz: 0.94, ...T });
    RC('chest', [0.5, 1.51, 0], [0.2, 1.48, 0], 0.1, 0.06, { sz: 0.5, k: 0.09, f: 0.12 }); // withers
    RC('loin', [0.15, 1.455, 0], [-0.45, 1.5, 0], 0.07, 0.075, { sz: 1.6, k: 0.08, f: 0.12 }); // back muscles
    // hindquarters
    EL('hips', [-0.6, 1.31, 0], [0.34, 0.3, 0.29], { k: 0.07, f: 0.13 });
    for (const s of [1, -1]) EL('hips', [-0.6, 1.4, s * 0.12], [0.26, 0.21, 0.18], { k: 0.07, f: 0.12 });
    RC('tail0', [-0.89, 1.46, 0], [-0.975, 1.27, 0], 0.05, 0.032, { k: 0.04, f: 0.06 });
    // chest
    EL('chest', [0.59, 1.22, 0], [0.21, 0.25, 0.24], { k: 0.07, f: 0.12 });
    for (const s of [1, -1]) EL('chest', [0.62, 1.05, s * 0.075], [0.1, 0.12, 0.08], { k: 0.05, f: 0.09 });
    // neck: thicker and shorter-looking than a horse's
    RC('neck1', [0.6, 1.4, 0], [0.74, 1.547, 0], 0.3, 0.255, { sz: 0.64, k: 0.09, f: 0.13 });
    RC('neck2', [0.74, 1.547, 0], [0.88, 1.693, 0], 0.255, 0.21, { sz: 0.58, k: 0.06, f: 0.11 });
    RC('neck3', [0.88, 1.693, 0], [1.02, 1.84, 0], 0.21, 0.16, { sz: 0.58, k: 0.05, f: 0.1 });
    RC('neck2', [0.47, 1.615, 0], [0.96, 1.95, 0], 0.055, 0.05, { sz: 0.6, k: 0.06, f: 0.07 }); // crest
    RC('neck3', [1.0, 1.89, 0], [1.17, 1.925, 0], 0.1, 0.088, { sz: 0.62, k: 0.05, f: 0.08 }); // atlas
    // head: shorter face, rounder forehead. No eyes - just a soft brow.
    RC('head', HP(0.1, 0.125), HP(0.34, 0.08), 0.128, 0.082, { sz: 0.78, k: 0.04, f: 0.08 });
    RC('head', HP(0.34, 0.08), HP(0.5, 0.068), 0.082, 0.07, { sz: 0.88, k: 0.04, f: 0.08 });
    EL('head', HP(0.035, 0.07), [0.1, 0.1, 0.095], { k: 0.04, f: 0.08 });
    EL('head', HP(0.515, 0.12), [0.042, 0.036, 0.042], { k: 0.03 }); // chin
    EL('head', HP(0.555, 0.07), [0.05, 0.055, 0.056], { k: 0.03 }); // muzzle
    for (const s of [1, -1]) {
      EL('head', HP(0.125, 0.165, s * 0.054), [0.105, 0.095, 0.046], { rot: -51.5, k: 0.035 }); // jowl
      EL('head', HP(0.535, 0.035, s * 0.045), [0.036, 0.03, 0.03], { k: 0.025 }); // nostril flare
      const n = HP(0.56, 0.03);
      EL('head', [n[0], n[1], s * 0.057], [0.022, 0.013, 0.016], { rot: -35, k: 0.012, sub: true });
    }
    for (const s of [1, -1]) {
      const x = s > 0 ? 'R' : 'L', L = { k: 0.025, f: 0.05 };
      // forelimb
      RC('scap' + x, [0.46, 1.44, s * 0.14], [0.66, 1.19, s * 0.19], 0.1, 0.115, { sz: 0.6, k: 0.06, f: 0.1 });
      EL('hum' + x, [0.68, 1.17, s * 0.18], [0.095, 0.1, 0.08], { k: 0.05, f: 0.09 });
      RC('hum' + x, [0.67, 1.16, s * 0.19], [0.49, 0.95, s * 0.19], 0.11, 0.1, { sz: 0.7, k: 0.05, f: 0.09 });
      EL('hum' + x, [0.44, 1.1, s * 0.205], [0.13, 0.17, 0.075], { k: 0.06, f: 0.09 }); // triceps
      RC('rad' + x, [0.475, 0.92, s * 0.185], [0.457, 0.56, s * 0.162], 0.1, 0.055, { sz: 0.78, k: 0.035, f: 0.06 });
      EL('rad' + x, [0.505, 0.82, s * 0.185], [0.062, 0.13, 0.058], { k: 0.03, f: 0.06 });
      EL('rad' + x, [0.4, 0.935, s * 0.185], [0.055, 0.065, 0.042], { k: 0.03, f: 0.06 }); // elbow
      EL('rad' + x, [0.46, 0.5, s * 0.16], [0.056, 0.064, 0.052], L); // knee
      RC('can' + x, [0.455, 0.48, s * 0.16], [0.45, 0.21, s * 0.15], 0.04, 0.037, L);
      RC('can' + x, [0.428, 0.46, s * 0.16], [0.423, 0.22, s * 0.15], 0.023, 0.025, L); // tendons
      EL('can' + x, [0.447, 0.19, s * 0.15], [0.05, 0.052, 0.045], L); // fetlock
      EL('pas' + x, [0.418, 0.175, s * 0.15], [0.032, 0.032, 0.03], L);
      RC('pas' + x, [0.455, 0.185, s * 0.15], [0.515, 0.09, s * 0.15], 0.038, 0.046, { k: 0.02, f: 0.04 });
      // Hindlimb. A horse's hind leg read as a pair of shock absorbers: a fat
      // sleeve of thigh with a thin rod of cannon sliding out of it. Here the
      // thigh stops at the stifle, the gaskin shows as its own muscle angling
      // back to a hock that sticks out behind, a straight hamstring-and-tendon
      // line runs from the buttock to the point of the hock, and the cannon is
      // flat and deep rather than round.
      EL('fem' + x, [-0.6, 1.13, s * 0.19], [0.27, 0.26, 0.14], { k: 0.08, f: 0.1 }); // thigh
      RC('fem' + x, [-0.56, 1.24, s * 0.19], [-0.49, 1.0, s * 0.205], 0.14, 0.095, { sz: 0.8, k: 0.06, f: 0.09 }); // quadriceps to the stifle
      RC('fem' + x, [-0.82, 1.3, s * 0.13], [-0.79, 0.94, s * 0.16], 0.12, 0.085, { sz: 0.85, k: 0.08, f: 0.09 }); // hamstrings, down into the gaskin
      EL('tib' + x, [-0.49, 0.965, s * 0.205], [0.07, 0.075, 0.06], { k: 0.05, f: 0.07 }); // stifle
      RC('tib' + x, [-0.56, 0.94, s * 0.195], [-0.75, 0.68, s * 0.17], 0.125, 0.07, { sz: 0.66, k: 0.07, f: 0.08 }); // gaskin: a broad wedge, not a rod
      RC('tib' + x, [-0.76, 0.95, s * 0.17], [-0.85, 0.665, s * 0.166], 0.08, 0.034, { sz: 0.66, k: 0.07, f: 0.07 }); // back of the gaskin to the point of the hock
      EL('tib' + x, [-0.78, 0.615, s * 0.166], [0.07, 0.068, 0.05], { k: 0.035, f: 0.06 }); // hock
      RC('tib' + x, [-0.79, 0.63, s * 0.166], [-0.862, 0.655, s * 0.166], 0.036, 0.03, { k: 0.03, f: 0.05 }); // point of hock
      RC('hcan' + x, [-0.772, 0.57, s * 0.165], [-0.776, 0.24, s * 0.16], 0.046, 0.04, { sz: 0.78, k: 0.035, f: 0.05 }); // cannon
      RC('hcan' + x, [-0.81, 0.56, s * 0.165], [-0.806, 0.24, s * 0.16], 0.024, 0.026, { sz: 0.8, k: 0.03, f: 0.05 }); // tendons
      EL('hcan' + x, [-0.782, 0.21, s * 0.16], [0.052, 0.054, 0.046], L); // fetlock
      EL('hpas' + x, [-0.81, 0.195, s * 0.16], [0.032, 0.032, 0.03], L);
      RC('hpas' + x, [-0.77, 0.205, s * 0.16], [-0.71, 0.09, s * 0.16], 0.04, 0.047, { k: 0.02, f: 0.04 });
    }
  }
  function field(x: number, y: number, z: number) {
    let d = 1e3;
    for (let i = 0; i < prims.length; i++) {
      const Pr = prims[i], b = Pr.bb;
      if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]) continue;
      const v = evalPrim(Pr, x, y, z);
      d = Pr.sub ? smax(d, -v, Pr.k) : smin(d, v, Pr.k);
    }
    return d;
  }
  function fieldNormal(x: number, y: number, z: number, out: number[]) {
    const e = 0.005;
    out[0] = field(x + e, y, z) - field(x - e, y, z);
    out[1] = field(x, y + e, z) - field(x, y - e, z);
    out[2] = field(x, y, z + e) - field(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  }
  const wb = new Float32Array(64);
  /** bone weights from each muscle's own distance field */
  function weightsAt(x: number, y: number, z: number, idx: ArrayLike<number> & { [n: number]: number }, wts: ArrayLike<number> & { [n: number]: number }, o: number) {
    wb.fill(0);
    for (let i = 0; i < prims.length; i++) {
      const Pr = prims[i];
      if (Pr.sub) continue;
      const b = Pr.bb;
      if (x < b[0] || x > b[3] || y < b[1] || y > b[4] || z < b[2] || z > b[5]) continue;
      const t = 1 - evalPrim(Pr, x, y, z) / Pr.f;
      if (t <= 0) continue;
      const w = t >= 1 ? 1 : t * t;
      if (w > wb[Pr.bone]) wb[Pr.bone] = w;
    }
    let sum = 0;
    for (let n = 0; n < 4; n++) {
      let bi = 0, bw = 0;
      for (let i = 0; i < boneList.length; i++) if (wb[i] > bw) { bw = wb[i]; bi = i; }
      idx[o + n] = bi;
      wts[o + n] = bw;
      sum += bw;
      wb[bi] = 0;
    }
    if (sum < 1e-6) { idx[o] = boneIndex.body; wts[o] = 1; sum = 1; }
    for (let n = 0; n < 4; n++) wts[o + n] /= sum;
  }

  /** naive surface nets: field → watertight quad mesh */
  function meshField(h: number) {
    // The box is fitted to the muscles themselves: a foal stands taller than a pony, and a box
    // that is too small slices the top off its head.
    let X0 = Infinity, X1 = -Infinity, Y1 = -Infinity, ZM = 0;
    for (const Pr of prims) {
      const b = Pr.bb;
      X0 = Math.min(X0, b[0]); X1 = Math.max(X1, b[3]); Y1 = Math.max(Y1, b[4]);
      ZM = Math.max(ZM, -b[2], b[5]);
    }
    X0 -= 2 * h; X1 += 2 * h; Y1 += 2 * h;
    const Y0 = 0.02, hz = Math.ceil(ZM / h) + 2, Z0 = -hz * h;
    const nx = Math.round((X1 - X0) / h) + 1, ny = Math.round((Y1 - Y0) / h) + 1, nz = 2 * hz + 1, sxy = nx * ny;
    const F = new Float32Array(nx * ny * nz).fill(1e3);
    for (const pass of [false, true])
      for (const Pr of prims) {
        if (Pr.sub !== pass) continue;
        const b = Pr.bb;
        const i0 = Math.max(0, Math.floor((b[0] - X0) / h)), i1 = Math.min(nx - 1, Math.ceil((b[3] - X0) / h));
        const j0 = Math.max(0, Math.floor((b[1] - Y0) / h)), j1 = Math.min(ny - 1, Math.ceil((b[4] - Y0) / h));
        const k0 = Math.max(0, Math.floor((b[2] - Z0) / h)), k1 = Math.min(nz - 1, Math.ceil((b[5] - Z0) / h));
        for (let k = k0; k <= k1; k++) {
          const z = Z0 + k * h;
          for (let j = j0; j <= j1; j++) {
            const y = Y0 + j * h;
            let id = i0 + nx * (j + ny * k);
            for (let i = i0; i <= i1; i++, id++) {
              const d = evalPrim(Pr, X0 + i * h, y, z);
              F[id] = pass ? smax(F[id], -d, Pr.k) : smin(F[id], d, Pr.k);
            }
          }
        }
      }
    const cx = nx - 1, cy = ny - 1, cz = nz - 1, cellV = new Int32Array(cx * cy * cz).fill(-1);
    const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
    const E = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
    const f = new Float32Array(8), pos: number[] = [];
    for (let k = 0; k < cz; k++)
      for (let j = 0; j < cy; j++) {
        let base = nx * (j + ny * k);
        for (let i = 0; i < cx; i++, base++) {
          let mask = 0;
          for (let c = 0; c < 8; c++) {
            const v = F[base + off[c]];
            f[c] = v;
            if (v < 0) mask |= 1 << c;
          }
          if (mask === 0 || mask === 255) continue;
          let sx = 0, sy = 0, sz = 0, n = 0;
          for (let e = 0; e < 24; e += 2) {
            const a = E[e], b = E[e + 1];
            if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
            const t = f[a] / (f[a] - f[b]);
            sx += (a & 1) + ((b & 1) - (a & 1)) * t;
            sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
            sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
            n++;
          }
          cellV[i + cx * (j + cy * k)] = pos.length / 3;
          pos.push(X0 + (i + sx / n) * h, Y0 + (j + sy / n) * h, Z0 + (k + sz / n) * h);
        }
      }
    const idx: number[] = [], cv = (i: number, j: number, k: number) => cellV[i + cx * (j + cy * k)];
    const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
      if (flip) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    };
    for (let k = 1; k < nz - 1; k++)
      for (let j = 1; j < ny - 1; j++)
        for (let i = 1; i < nx - 1; i++) {
          const id = i + nx * (j + ny * k), in0 = F[id] < 0;
          if (in0 !== F[id + 1] < 0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !in0);
          if (in0 !== F[id + nx] < 0) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !in0);
          if (in0 !== F[id + sxy] < 0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !in0);
        }
    return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
  }

  /* ── coat: a pattern worked out once, painted in whatever colours are chosen ──
     For each vertex the weights of every layer are kept, in order: shading,
     lighter belly, darker topline, darker crest, stockings, muzzle, nostril,
     star, (unused), dock, and then the four layers the bought patterns use:
     spots, pinto patches, dapples, and the white blanket over the rump that
     appaloosa spots sit on. Recolouring repaints from these without rebuilding. */
  const COAT_LAYERS = 14;
  const dist3 = (x: number, y: number, z: number, p: Vec3, pz = 0) => Math.hypot(x - p[0], y - p[1], z - pz);
  function coatWeights(x: number, y: number, z: number, out: Float32Array, o: number) {
    const y0 = unwarpY(y);
    const n1 = vnoise(x * 5 + 3, y0 * 5, z * 5), n2 = vnoise(x * 16, y0 * 16 + 5, z * 16);
    x /= bd.xLen; // the pattern's landmarks are in horse lengths
    const trunk = sstep(-0.95, -0.6, x) * sstep(0.85, 0.55, x);
    const hs = HEAD_S;
    out[o] = clamp((n1 - 0.45) * 0.7 + (n2 - 0.5) * 0.25, 0, 1);
    out[o + 1] = 0.55 * sstep(1.18, 0.9, y0) * trunk;
    out[o + 2] = 0.45 * sstep(1.38, 1.6, y0) * sstep(0.7, 0.4, x);
    out[o + 3] = 0.6 * sstep(0.06, 0.0, Math.abs(z)) * sstep(1.45, 1.6, y0 - (x > 0.5 ? (x - 0.5) * 0.8 : 0));
    out[o + 4] = sstep(0.62, 0.36, y0 + (n1 - 0.5) * 0.14);
    out[o + 5] = sstep(0.17 * hs, 0.07 * hs, dist3(x, y, z, MUZZLE) + (n2 - 0.5) * 0.03);
    out[o + 6] = sstep(0.03 * hs, 0.014 * hs, dist3(x, y, Math.abs(z), NOSTRIL, 0.054 * hs));
    const sx = (x - STAR[0]) / hs, sy = (y - STAR[1]) / hs, zz = z / hs;
    out[o + 7] =
      sstep(0.05, 0.034, Math.hypot(sx * 0.62 + sy * -0.78, zz * 1.25) + Math.abs(sx * 0.78 + sy * 0.62) * 0.2 + (n2 - 0.5) * 0.02) *
      sstep(0.05, 0.02, Math.hypot(sx, sy) - 0.07);
    out[o + 8] = 0; // (was a white sock on one hind leg; every leg matches the coat now)
    out[o + 9] = 0;
    // Patterns live on the trunk, neck and upper legs, never on the lower legs or the face.
    const legs = sstep(0.62, 0.85, y0);
    const face = sstep(0.14 * hs, 0.34 * hs, dist3(x, y, z, MUZZLE));
    out[o + 10] = sstep(0.27, 0.19, worley(x * 8 + 11, y0 * 8, z * 8)) * legs * face; // spots
    const patch = vnoise(x * 2.1 + 4, y0 * 2.1, z * 1.6 + 9) * 0.72 + vnoise(x * 6, y0 * 6 + 3, z * 6) * 0.28;
    out[o + 11] = sstep(0.5, 0.56, patch) * sstep(0.45, 0.7, y0) * face; // pinto patches, down into the legs too
    out[o + 12] = sstep(0.42, 0.18, worley(x * 7 + 3, y0 * 7 + 7, z * 7)) * sstep(0.8, 1.05, y0) * trunk; // dapples
    out[o + 13] = sstep(-0.05, -0.45, x + (n1 - 0.5) * 0.18) * sstep(1.0, 1.25, y0 + (n2 - 0.5) * 0.06); // blanket
  }
  type CoatPalette = { body: Vec3; light: Vec3; dark: Vec3; points: Vec3; muzzle: Vec3; white: Vec3; nostril: Vec3 };
  function coatPalette(c: PonyColors): CoatPalette {
    const body = rgb(c.body);
    const lum = 0.3 * body[0] + 0.59 * body[1] + 0.11 * body[2];
    return {
      body,
      // Colours here are linear, so lighter is a gentle multiply, not a mix toward white.
      light: lum > 0.2 ? mix3(body, [1, 1, 1], 0.07) : [Math.min(1, body[0] * 1.45), Math.min(1, body[1] * 1.45), Math.min(1, body[2] * 1.45)],
      dark: mix3(body, [0, 0, 0], lum > 0.5 ? 0.1 : 0.45),
      points: rgb(c.points),
      muzzle: rgb(c.muzzle),
      white: [0.913, 0.886, 0.84],
      nostril: mix3(rgb(c.muzzle), [0, 0, 0], 0.6),
    };
  }
  function paintCoat(w: Float32Array, out: Float32Array, pal: CoatPalette, pattern: PatternId) {
    // Spots are the coat's own colour, deepened; on a pale coat they take the colour of the points.
    const lum = 0.3 * pal.body[0] + 0.59 * pal.body[1] + 0.11 * pal.body[2];
    const spot = lum > 0.35 ? mix3(pal.points, [0, 0, 0], 0.35) : mix3(pal.body, [0, 0, 0], 0.5);
    const dappleLight = mix3(pal.body, [1, 1, 1], lum > 0.35 ? 0.35 : 0.22);
    const n = out.length / 3;
    for (let i = 0; i < n; i++) {
      const o = i * COAT_LAYERS;
      let r = pal.body[0], g = pal.body[1], b = pal.body[2];
      const step = (c: Vec3, t: number) => {
        if (t <= 0) return;
        r += (c[0] - r) * t; g += (c[1] - g) * t; b += (c[2] - b) * t;
      };
      step(pal.light, w[o]);
      step(pal.light, w[o + 1]);
      step(pal.dark, w[o + 2]);
      step(pal.dark, w[o + 3]);
      if (pattern === 'bintik') {
        // dapples: a slightly deeper coat, with paler rings showing through
        step(pal.dark, 0.2 * (1 - w[o + 12]));
        step(dappleLight, 0.75 * w[o + 12]);
      } else if (pattern === 'belang') step(pal.white, w[o + 11]);
      else if (pattern === 'totol') {
        step(pal.white, w[o + 13]);
        step(spot, w[o + 10]);
      }
      step(pal.points, w[o + 4]);
      step(pal.muzzle, w[o + 5]);
      step(pal.nostril, w[o + 6]);
      step(pal.white, w[o + 7]);
      step(pal.white, w[o + 8]);
      step(pal.points, w[o + 9]);
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
    }
  }

  /* ───────────────────────────── build the pony ───────────────────────────── */
  const pony = new THREE.Group();
  pony.scale.setScalar(S);
  scene.add(pony);
  pony.add(B.body);
  let skeleton: THREE.Skeleton | null = null;
  let bodyMesh: THREE.SkinnedMesh | null = null;
  let coatMat: THREE.MeshPhysicalMaterial | null = null;
  const hairU: { uTime: { value: number }; uWind: { value: number }; uAmt: { value: number } }[] = [];
  const rnd = mulberry(1337);
  type Paintable = { weights: Float32Array; attr: THREE.BufferAttribute };
  const coatParts: Paintable[] = [];
  const hairParts: { tone: Float32Array; shade: Float32Array; hue: Float32Array; attr: THREE.BufferAttribute }[] = [];
  const earInMat = new THREE.MeshStandardMaterial({ color: 0x241a17, roughness: 0.8, side: THREE.BackSide });
  const hornMat = new THREE.MeshPhysicalMaterial({ color: 0xf6e7b6, roughness: 0.28, metalness: 0.15, clearcoat: 0.6, iridescence: 0.6, iridescenceIOR: 1.4, side: THREE.DoubleSide });
  const hoofDark = new THREE.MeshStandardMaterial({ color: 0x2a221e, roughness: 0.36 });

  function makeCoatMaterial() {
    const m = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.6, metalness: 0, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xb98a5a),
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
      varying vec3 vRest;
      float h31(vec3 p){ p = fract(p * 0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
      float hairN = vn(vRest * vec3(60.0, 150.0, 150.0)) * 0.5 + vn(vRest * 320.0) * 0.5;
      diffuseColor.rgb *= 0.9 + 0.2 * hairN;`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (hairN - 0.5) * 0.16, 0.08, 1.0);`,
        );
    };
    return m;
  }
  function makeHairMaterial(amount: number) {
    const u = { uTime: { value: 0 }, uWind: { value: 0 }, uAmt: { value: amount } };
    hairU.push(u);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.1, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader =
        'attribute vec2 hair; uniform float uTime; uniform float uWind; uniform float uAmt;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
      { float tip = hair.x * hair.x * uAmt, ph = hair.y * 6.2831;
        transformed.x -= tip * (0.13 * uWind * (0.8 + 0.2 * sin(uTime * 9.0 + ph)) + 0.006 * sin(uTime * 1.1 + ph));
        transformed.y += tip * 0.10 * uWind * (0.65 + 0.35 * sin(uTime * 12.0 + ph + position.x * 8.0));
        transformed.z += tip * (uWind * (0.05 + 0.03 * sin(uTime * 14.0 + ph * 2.0)) + 0.005 * sin(uTime * 1.4 + ph)); }`,
        );
    };
    return m;
  }

  type Skin = (p: number[], s: number) => number[];
  /** hair as skinned ribbons */
  class Strands {
    pos: number[] = []; nor: number[] = []; si: number[] = []; sw: number[] = []; hair: number[] = []; idx: number[] = [];
    tone: number[] = []; shade: number[] = []; hue: number[] = [];
    add(pts: number[][], side: number[] | number[][], nrm: number[][], w0: number, w1: number, tone: number, hue: number, phase: number, skin: Skin, tipOf?: (s: number) => number) {
      const base = this.pos.length / 3, n = pts.length;
      for (let j = 0; j < n; j++) {
        const s = j / (n - 1), w = lerp(w0, w1, s * s) * 0.5 * (0.35 + 0.65 * Math.min(1, s * 5)), p = pts[j];
        const sd = (Array.isArray(side[j]) ? side[j] : side) as number[], nm = nrm[j], sk = skin(p, s);
        for (const e of [-1, 1]) {
          this.pos.push(p[0] + sd[0] * w * e, p[1] + sd[1] * w * e, p[2] + sd[2] * w * e);
          this.nor.push(nm[0], nm[1], nm[2]);
          this.tone.push(tone);
          this.shade.push(0.75 + 0.5 * s);
          this.hue.push(hue);
          this.si.push(sk[0], sk[1], sk[2], sk[3]);
          this.sw.push(sk[4], sk[5], sk[6], sk[7]);
          this.hair.push(tipOf ? tipOf(s) : s, phase);
        }
        if (j) {
          const a = base + (j - 1) * 2;
          this.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    mesh(mat: THREE.Material) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      const col = new THREE.Float32BufferAttribute(new Float32Array(this.pos.length), 3);
      g.setAttribute('color', col);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
      g.setAttribute('hair', new THREE.Float32BufferAttribute(this.hair, 2));
      g.setIndex(this.idx);
      const m = new THREE.SkinnedMesh(g, mat);
      m.castShadow = true;
      m.frustumCulled = false;
      pony.add(m);
      m.bind(skeleton!);
      hairParts.push({ tone: new Float32Array(this.tone), shade: new Float32Array(this.shade), hue: new Float32Array(this.hue), attr: col });
      return m;
    }
  }
  function pushOut(p: number[], margin: number) {
    const n = [0, 0, 0];
    for (let it = 0; it < 3; it++) {
      const d = field(p[0], p[1], p[2]);
      if (d >= margin) break;
      fieldNormal(p[0], p[1], p[2], n);
      const m = margin - d;
      p[0] += n[0] * m; p[1] += n[1] * m; p[2] += n[2] * m;
    }
    return p;
  }
  function topY(x: number, z = 0) {
    let y = 2.2;
    while (y > 0.4 && field(x, y, z) > 0) y -= 0.004;
    let a = y, b = y + 0.004;
    for (let i = 0; i < 8; i++) {
      const m = (a + b) / 2;
      if (field(x, m, z) > 0) b = m;
      else a = m;
    }
    return a;
  }
  function orientOutward(g: THREE.BufferGeometry, cx: number, cy: number, cz: number) {
    const p = g.attributes.position.array, ix = g.index!.array as Uint16Array | Uint32Array;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (p[a] + p[b] + p[c]) / 3 - cx, my = (p[a + 1] + p[b + 1] + p[c + 1]) / 3 - cy, mz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3 - cz;
      if (nx * mx + ny * my + nz * mz < 0) {
        const s = ix[t + 1];
        ix[t + 1] = ix[t + 2];
        ix[t + 2] = s;
      }
    }
  }
  function hoofGeometry() {
    const N = 32, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < N; i++) {
      // wall: ground ring + coronet ring
      const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a), back = Math.max(0, -ca);
      pos.push(0.012 + 0.067 * ca * (1 - 0.1 * back), -0.08, 0.061 * sa * (1 - 0.14 * back));
      pos.push(-0.004 + 0.05 * ca, lerp(-0.028, 0.016, (ca + 1) / 2), 0.048 * sa);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = ((i + 1) % N) * 2;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
    const cap = (ring: number, cx: number, cy: number) => {
      const c0 = pos.length / 3;
      pos.push(cx, cy, 0);
      for (let i = 0; i < N; i++) pos.push(pos[(i * 2 + ring) * 3], pos[(i * 2 + ring) * 3 + 1], pos[(i * 2 + ring) * 3 + 2]);
      for (let i = 0; i < N; i++) idx.push(c0, c0 + 1 + i, c0 + 1 + ((i + 1) % N));
    };
    cap(0, 0.012, -0.08);
    cap(1, -0.004, 0.0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    orientOutward(g, 0, -0.035, 0);
    g.computeVertexNormals();
    return g;
  }
  function earGeometry() {
    const rows = 12, cols = 14, H = 0.15, pos: number[] = [], idx: number[] = [];
    const w = new Float32Array((rows + 1) * (cols + 1) * COAT_LAYERS);
    let vi = 0;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows, rad = 0.04 * Math.pow(Math.sin(Math.PI * (0.14 + 0.86 * v)), 0.85) * (1 - 0.15 * v);
      for (let q = 0; q <= cols; q++) {
        const u = q / cols, al = (-155 + 310 * u) * D2R;
        pos.push(-Math.cos(al) * rad * 0.75 + 0.03 * v * v, H * v, Math.sin(al) * rad);
        // ear tips and edges take the colour of the points
        w[vi * COAT_LAYERS + 9] = clamp(sstep(0.55, 1, v) + sstep(0.3, 0.5, Math.abs(u - 0.5)) * 0.8, 0, 1);
        vi++;
      }
    }
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const a = r * (cols + 1) + q, b = a + 1, d = a + cols + 1, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const col = new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3);
    g.setAttribute('color', col);
    g.setIndex(idx);
    g.computeVertexNormals();
    const mid = (rows / 2) * (cols + 1) + cols / 2; // the back of the ear must face -X
    if (g.attributes.normal.getX(mid) > 0) {
      const ix = g.index!.array as Uint16Array | Uint32Array;
      for (let t = 0; t < ix.length; t += 3) {
        const s = ix[t + 1];
        ix[t + 1] = ix[t + 2];
        ix[t + 2] = s;
      }
      g.computeVertexNormals();
    }
    coatParts.push({ weights: w, attr: col });
    return g;
  }

  function buildPony() {
    defineAnatomy();
    const { pos, idx } = meshField(0.0105);
    const nv = pos.length / 3;
    const col = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const cw = new Float32Array(nv * COAT_LAYERS);
    for (let i = 0; i < nv; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      coatWeights(x, y, z, cw, i * COAT_LAYERS);
      weightsAt(x, y, z, si, sw, i * 4);
      for (let n = 0; n < 4; n++)
        if (si[i * 4 + n] === boneIndex.tail0) cw[i * COAT_LAYERS + 9] = Math.max(cw[i * COAT_LAYERS + 9], sstep(0.25, 0.75, sw[i * 4 + n]));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const colAttr = new THREE.BufferAttribute(col, 3);
    geo.setAttribute('color', colAttr);
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const nor = new Float32Array(nv * 3), nn = [0, 0, 0]; // exact normals straight from the field gradient
    for (let i = 0; i < nv; i++) {
      fieldNormal(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nn);
      nor.set(nn, i * 3);
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    coatParts.push({ weights: cw, attr: colAttr });

    pony.updateMatrixWorld(true);
    skeleton = new THREE.Skeleton(boneList);
    coatMat = makeCoatMaterial();
    bodyMesh = new THREE.SkinnedMesh(geo, coatMat);
    bodyMesh.castShadow = bodyMesh.receiveShadow = true;
    bodyMesh.frustumCulled = false;
    pony.add(bodyMesh);
    bodyMesh.bind(skeleton);

    // hooves
    const hg = hoofGeometry();
    for (const n of ['hoofR', 'hoofL', 'hhoofR', 'hhoofL']) {
      const m = new THREE.Mesh(hg, hoofDark);
      m.scale.setScalar(bd.legR);
      m.castShadow = m.receiveShadow = true;
      B[n].add(m);
    }
    // a unicorn's horn: a twisted cone rising steeply out of the forehead
    if (bd.horn) {
      const base = new V3(...P(HP(0.13, 0), 'head'));
      const out = new V3(-HN[0] * 0.6, -HN[1] * 0.6 + 0.7, 0).normalize(); // about 65 degrees above level
      // walk out of the forehead to its surface, then sink the root in a little
      for (let i = 0; i < 80 && field(base.x, base.y, base.z) < 0; i++) base.addScaledVector(out, 0.004);
      base.addScaledVector(out, -0.012);
      const hornGeo = new THREE.ConeGeometry(0.038, 0.34, 28, 24, true);
      const hp = hornGeo.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
        const a = Math.atan2(z, x), t = y / 0.34 + 0.5; // t: 0 at the root, 1 at the tip
        const groove = 1 + 0.14 * Math.sin(2 * a - t * 22); // the spiral
        hp.setXYZ(i, x * groove, y + 0.17, z * groove); // root at the origin
      }
      hornGeo.computeVertexNormals();
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.castShadow = true;
      horn.position.set(base.x - REST.head[0], base.y - REST.head[1], base.z - REST.head[2]);
      horn.quaternion.setFromUnitVectors(new V3(0, 1, 0), out);
      B.head.add(horn);
    }
    // ears: a pony's are short and set wide
    const eg = earGeometry();
    for (const s of [1, -1]) {
      const bone = B['ear' + (s > 0 ? 'R' : 'L')], r = REST[bone.name];
      const holder = new THREE.Group();
      holder.position.y = topY(r[0], r[2]) - r[1] - 0.024;
      holder.rotation.set(s * 0.34, -s * 0.55, -0.2);
      holder.scale.setScalar(1.05);
      const outer = new THREE.Mesh(eg, coatMat);
      outer.castShadow = true;
      holder.add(outer, new THREE.Mesh(eg, earInMat));
      bone.add(holder);
    }
    // mane + forelock: thick, the way a pony's is
    const skinAt: Skin = (p) => {
      const i = [0, 0, 0, 0], w = [0, 0, 0, 0];
      weightsAt(p[0], p[1], p[2], i, w, 0);
      return [...i, ...w];
    };
    const mane = new Strands(), nrm = [0, 0, 0];
    const maneX0 = P([0.5, 1.5])[0], maneX1 = P([1.17, 1.92], 'neck')[0];
    // A foal's mane is a short brush that stands up; an older animal's falls to the side.
    const brush = bd.mane < 0.6;
    for (let i = 0; i < 760; i++) {
      const t = rnd(), x = lerp(maneX0, maneX1, t), ry = topY(x) - 0.004, rz = lerp(-0.012, 0.02, rnd());
      const L = (0.2 + 0.15 * rnd()) * (0.75 + 0.25 * Math.sin(Math.PI * t)) * bd.mane, layer = rnd(), wig = (rnd() - 0.5) * 0.06 * bd.mane;
      const pts: number[][] = [], ns: number[][] = [];
      for (let j = 0; j <= 9; j++) {
        const s = j / 9;
        const p = brush
          ? [x - 0.07 * s * (L / 0.1) + wig * s * s, ry + L * 0.6 * s, rz + 0.01 * s]
          : [x - 0.06 * s * (L / 0.25) + wig * s * s, ry - L * Math.pow(s, 1.25), rz + 0.035 * s + 0.06 * Math.sin((Math.min(1, s * 2.5) * Math.PI) / 2)];
        pushOut(p, 0.005 + layer * 0.014 + 0.004 * s);
        pts.push(p);
        fieldNormal(p[0], p[1], p[2], nrm);
        ns.push([nrm[0] * 0.8, nrm[1] * 0.8 + 0.2, nrm[2] * 0.8 + 0.3]);
      }
      mane.add(pts, [0.74, 0.67, 0], ns, 0.024, 0.007, rnd() * rnd(), t, rnd(), skinAt);
    }
    const f0 = P([1.2, 1.97], 'head')[0], f1 = P([1.262, 1.97], 'head')[0], HDs = [HD[0], HD[1]];
    for (let i = 0; i < 130; i++) {
      const x = lerp(f0, f1, rnd()), z0 = (rnd() - 0.5) * 0.1, L = (0.14 + 0.12 * rnd()) * Math.max(bd.mane, 0.5), layer = rnd();
      const pts: number[][] = [], ns: number[][] = [];
      for (let j = 0; j <= 7; j++) {
        const s = j / 7, p = [x + HDs[0] * L * s, topY(x, z0) + 0.002 + HDs[1] * L * s, z0 * (1 + 0.7 * s)];
        pushOut(p, 0.005 + layer * 0.01);
        pts.push(p);
        fieldNormal(p[0], p[1], p[2], nrm);
        ns.push([nrm[0], nrm[1], nrm[2]]);
      }
      mane.add(pts, [0, 0, 1], ns, 0.02, 0.006, rnd() * rnd(), 1 - rnd() * 0.25, rnd(), skinAt, (s) => s * 0.5);
    }
    mane.mesh(makeHairMaterial(1));
    // tail
    const tail = new Strands(), tb = [0, 1, 2, 3, 4].map((k) => boneIndex['tail' + k]), ty = tb.map((b) => REST[boneList[b].name][1]);
    const tailSkin: Skin = (p) => {
      const y = p[1];
      if (y >= ty[0]) return [tb[0], 0, 0, 0, 1, 0, 0, 0];
      for (let k = 0; k < 4; k++)
        if (y >= ty[k + 1]) {
          const t = (ty[k] - y) / (ty[k] - ty[k + 1]);
          return [tb[k], tb[k + 1], 0, 0, 1 - t, t, 0, 0];
        }
      return [tb[4], 0, 0, 0, 1, 0, 0, 0];
    };
    const top = ty[0];
    for (let i = 0; i < 1000; i++) {
      const t = Math.pow(rnd(), 0.75), cx0 = lerp(-0.9, -0.98, t), cy0 = lerp(top + 0.015, top - 0.2, t), be = rnd() * TAU;
      const cb = Math.cos(be), sb = Math.sin(be), Rm = (0.025 + 0.11 * Math.sqrt(rnd())) * Math.min(1, 0.4 + bd.tail), kink = (rnd() - 0.5) * 0.06;
      const yEnd = cy0 - (cy0 - (0.2 + 0.3 * rnd() * rnd())) * bd.tail;
      const pts: number[][] = [], sides: number[][] = [], ph = rnd() * TAU;
      for (let j = 0; j <= 13; j++) {
        const s = j / 13, R = 0.02 + Rm * sstep(0, 0.5, s) * (1 - 0.3 * sstep(0.65, 1, s));
        const xc = lerp(cx0, -1.04, sstep(0, 0.45, s)) - 0.02 * Math.sin(Math.PI * s);
        pts.push([
          (Math.min(xc + cb * R * 0.85, lerp(-0.9, -0.955, sstep(0, 0.25, s))) + kink * s * s) * bd.xLen,
          lerp(cy0, yEnd, Math.pow(s, 0.95)),
          sb * R * 1.05 + 0.012 * Math.sin(s * 5 + ph) * s,
        ]);
        const tw = be + s * 1.2 * (kink * 20);
        sides.push([-Math.sin(tw), 0, Math.cos(tw)]);
      }
      const nrmT = [cb * 0.8 - 0.25, 0.2, sb * 0.9];
      tail.add(pts, sides, pts.map(() => nrmT), 0.021, 0.008, rnd() * rnd(), rnd(), rnd(), tailSkin, (s) => s * 0.45);
    }
    tail.mesh(makeHairMaterial(0.25));
  }

  function paint(c: PonyColors) {
    const pal = coatPalette(c);
    for (const part of coatParts) {
      paintCoat(part.weights, part.attr.array as Float32Array, pal, c.pattern ?? 'polos');
      part.attr.needsUpdate = true;
    }
    earInMat.color.setRGB(...mix3(pal.muzzle, pal.body, 0.25));
    coatMat?.sheenColor.setRGB(...mix3(pal.body, [1, 1, 1], 0.15));
    const dark = rgb(c.maneDark), light = rgb(c.maneLight), tmp = new THREE.Color();
    for (const part of hairParts) {
      const out = part.attr.array as Float32Array;
      for (let i = 0; i < part.tone.length; i++) {
        let r: number, g: number, b: number;
        if (c.rainbow) {
          tmp.setHSL(frac(part.hue[i] * 0.85), 0.85, 0.55, THREE.SRGBColorSpace);
          r = tmp.r; g = tmp.g; b = tmp.b;
        } else {
          const t = part.tone[i];
          r = lerp(dark[0], light[0], t); g = lerp(dark[1], light[1], t); b = lerp(dark[2], light[2], t);
        }
        const sh = part.shade[i];
        out[i * 3] = r * sh; out[i * 3 + 1] = g * sh; out[i * 3 + 2] = b * sh;
      }
      part.attr.needsUpdate = true;
    }
  }

  /* ───────────────────────────── food ───────────────────────────── */
  function makeFood(kind: FoodId): THREE.Group {
    const g = new THREE.Group();
    const std = (color: number, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness });
    if (kind === 'wortel') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.24, 16), std(0xf07a1a, 0.5));
      body.rotation.z = Math.PI / 2; // lying down, tip pointing forward
      body.position.set(0.0, 0.034, 0);
      g.add(body);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.13, 6), std(0x3f9b2f, 0.7));
        leaf.rotation.z = Math.PI / 2 + 0.3 * (i - 1.5) * 0.6;
        leaf.rotation.y = (i - 1.5) * 0.5;
        leaf.position.set(-0.17, 0.04, (i - 1.5) * 0.01);
        g.add(leaf);
      }
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 16), std(0xd8222a, 0.35));
      body.scale.set(1, 0.9, 1);
      body.position.y = 0.056;
      g.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.04, 6), std(0x5a3a1c, 0.8));
      stem.position.set(0, 0.12, 0);
      stem.rotation.z = 0.2;
      g.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 6), std(0x3f9b2f, 0.6));
      leaf.scale.set(1, 0.25, 0.5);
      leaf.position.set(0.02, 0.125, 0);
      leaf.rotation.z = -0.5;
      g.add(leaf);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    // Bigger than life, so it stands out of the grass for a small child to see.
    g.scale.setScalar(FOOD_SIZE * Math.max(S, 0.85));
    return g;
  }
  function disposeObject(o: THREE.Object3D) {
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const map = (mat as THREE.MeshStandardMaterial).map;
        map?.dispose();
        mat.dispose();
      }
    });
  }

  /* ───────────────────────────── locomotion ───────────────────────────── */
  const G: Record<(typeof GAIT_KEYS)[number], number> & { off: number[] } = {
    T: 1, duty: 0.8, hF: 0, hH: 0, knee: 0, load: 0, base: 0, amp: 0, W: 0.5, spine: 0, neck: 0, off: [0, 0, 0, 0],
  };
  function sampleGait(v: number) {
    let i = 0;
    while (i < KEYS.length - 2 && v > KEYS[i + 1].v) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((v - a.v) / (b.v - a.v), 0, 1);
    for (const k of GAIT_KEYS) G[k] = lerp(a[k], b[k], t);
    for (let n = 0; n < 4; n++) G.off[n] = lerp(a.off[n], b.off[n], t);
  }
  type Eat = { kind: FoodId; t: number; food: THREE.Group; bites: number };
  const state = {
    x: 0, z: 0, yaw: 0, v: 0, omega: 0, accel: 0, gait: 0 as PonyGait, steer: 0, phase: 0.1, idle: true, act: 0,
    dropF: 0, dropH: 0, time: 0, rear: -1, pendingRear: false, resume: -1, rearR: 0, rearOff: 0, rearLanded: false,
    lookYaw: 0, lookPitch: 0, wind: 0, swish: 9, nextSwish: 3, swishDir: 1, earT: [2, 3.5], earF: [9, 9], pitch: 0,
    pendingEat: null as FoodId | null, eat: null as Eat | null, graze: 0, munch: 0,
  };

  const HOOF_H = 0.08, G_X = 0.012, TOE_X = 0.078, HEEL_X = -0.05;
  type Leg = {
    i: number; front: boolean; s: number; bones: THREE.Bone[]; ang: number[]; phi: number; stance: boolean; sw: number; sw0: number; u: number; p: number;
    lock: THREE.Vector3; p0: THREE.Vector3; gNow: THREE.Vector3; stepScale: number; psi: number; gx: number; gy: number; glideW: number;
    restPos: THREE.Vector3; home: THREE.Vector3; z0: number; pv: number[];
    sv: number[]; hv: number[]; rv: number[]; cv: number[]; L1: number; a: number; b: number; rHum: number; rRad: number; rCan: number; rTF: number;
    l1: number; l2: number; l3: number; rF: number; rT: number; rC: number;
  };
  const legs: Leg[] = [];
  const hyp = (v: number[]) => Math.hypot(v[0], v[1]), ang = (v: number[]) => Math.atan2(v[1], v[0]);
  function makeLeg(i: number, front: boolean, s: number): Leg {
    const x = s > 0 ? 'R' : 'L';
    const names = (front ? ['scap', 'hum', 'rad', 'can', 'pas', 'hoof'] : ['fem', 'tib', 'hcan', 'hpas', 'hhoof']).map((n) => n + x);
    const r = names.map((n) => REST[n]), n = names.length, C = r[n - 1], F = r[n - 2];
    const v2 = (a: number, b: number) => [r[b][0] - r[a][0], r[b][1] - r[a][1]];
    const L: Leg = {
      i, front, s, bones: names.map((nm) => B[nm]), ang: new Array(n).fill(0), phi: 0, stance: true, sw: 0, sw0: 0, u: 0.5, p: 0,
      lock: new V3(), p0: new V3(), gNow: new V3(), stepScale: 1, psi: 0, gx: 0, gy: 0, glideW: 1, restPos: B[names[0]].position.clone(),
      home: new V3(C[0] + G_X, 0, C[2]), z0: C[2] - r[0][2], pv: [C[0] - F[0], C[1] - F[1]],
      sv: [0, 0], hv: [0, 0], rv: [0, 0], cv: [0, 0], L1: 0, a: 0, b: 0, rHum: 0, rRad: 0, rCan: 0, rTF: 0,
      l1: 0, l2: 0, l3: 0, rF: 0, rT: 0, rC: 0,
    };
    if (front) {
      L.sv = v2(0, 1); L.hv = v2(1, 2); L.rv = v2(2, 3); L.cv = v2(3, 4);
      L.L1 = hyp(L.hv); L.a = hyp(L.rv); L.b = hyp(L.cv);
      L.rHum = ang(L.hv); L.rRad = ang(L.rv); L.rCan = ang(L.cv); L.rTF = Math.atan2(F[1] - r[0][1], F[0] - r[0][0]);
    } else {
      const fv = v2(0, 1), tv = v2(1, 2), cv = v2(2, 3);
      L.l1 = hyp(fv); L.l2 = hyp(tv); L.l3 = hyp(cv);
      L.rF = ang(fv); L.rT = ang(tv); L.rC = ang(cv);
    }
    return L;
  }
  const _p = new V3(), _g = new V3(), _t = new V3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qx = new THREE.Quaternion();
  const _gqi = new THREE.Quaternion(), XA = new V3(1, 0, 0), ZA = new V3(0, 0, 1);

  /* Solve one leg toward a hoof target `g` (pony space, bottom-centre of the hoof).
     psi = hoof pitch, thPas = pastern angle, kappa = knee fold (front). Returns how far the leg over-reaches. */
  function solveLeg(L: Leg, g: THREE.Vector3, psi: number, thPas: number, kappa: number, swing: boolean) {
    _p.setFromMatrixPosition(L.bones[0].matrixWorld);
    pony.worldToLocal(_p);
    const dx = g.x - _p.x, dy = g.y - _p.y, dz = g.z - _p.z, z0 = L.z0;
    const v = -Math.sqrt(Math.max(dy * dy + dz * dz - z0 * z0, 1e-6));
    L.phi = wrapPi(Math.atan2(dz, dy) - Math.atan2(z0, v));
    const c = Math.cos(psi), s = Math.sin(psi);
    let px: number, ox: number; // pivot (in-plane x) and its rest offset to the coffin joint
    if (swing) { px = dx; ox = -G_X; }
    else if (psi < 0) { px = dx + (TOE_X - G_X); ox = -TOE_X; }
    else { px = dx + (HEEL_X - G_X); ox = -HEEL_X; }
    const Cx = px + ox * c - HOOF_H * s, Cy = v + ox * s + HOOF_H * c;
    const cp = Math.cos(thPas), sp = Math.sin(thPas);
    const Fx = Cx - (L.pv[0] * cp - L.pv[1] * sp), Fy = Cy - (L.pv[0] * sp + L.pv[1] * cp);
    const n = L.ang.length;
    L.ang[n - 1] = psi;
    L.ang[n - 2] = thPas;
    L.psi = psi;
    let over = 0;
    if (L.front) {
      const rho = clamp(0.5 * wrapPi(Math.atan2(Fy, Fx) - L.rTF), -0.36, 0.36), cr = Math.cos(rho), sr = Math.sin(rho);
      const Sx = L.sv[0] * cr - L.sv[1] * sr, Sy = L.sv[0] * sr + L.sv[1] * cr;
      const L2 = Math.sqrt(L.a * L.a + L.b * L.b + 2 * L.a * L.b * Math.cos(kappa));
      let ddx = Fx - Sx, ddy = Fy - Sy, D = Math.hypot(ddx, ddy);
      const glide = clamp(D - (L.L1 + L2) * 0.985, 0, 0.06); // the shoulder blade slides over the ribcage for extra reach
      L.gx = (ddx / D) * glide; L.gy = (ddy / D) * glide;
      ddx -= L.gx; ddy -= L.gy; D -= glide;
      const delta = Math.atan2(L.b * Math.sin(kappa), L.a + L.b * Math.cos(kappa));
      over = D - (L.L1 + L2) * 0.994;
      const Dc = clamp(D, Math.abs(L.L1 - L2) + 1e-3, (L.L1 + L2) * 0.9995);
      const A = Math.acos(clamp((L.L1 * L.L1 + Dc * Dc - L2 * L2) / (2 * L.L1 * Dc), -1, 1));
      const aSF = Math.atan2(ddy, ddx), aHum = aSF - A;
      const aRad = Math.atan2(Dc * Math.sin(aSF) - L.L1 * Math.sin(aHum), Dc * Math.cos(aSF) - L.L1 * Math.cos(aHum)) + delta;
      L.ang[0] = rho; L.ang[1] = wrapPi(aHum - L.rHum); L.ang[2] = wrapPi(aRad - L.rRad); L.ang[3] = wrapPi(aRad - kappa - L.rCan);
    } else {
      /* The hind leg, after Muybridge's galloping horse. A planted leg is fairly
         straight and straightens right out into the push-off, the hoof far behind.
         Lifted, the hock folds hard and the hoof tucks up; then it opens again as
         the hoof reaches forward under the belly to land.

         What is chosen for each moment is the hock's bend itself - never the
         direction of the cannon - so the hock can only ever bend the right way,
         its point behind, and the leg can never flip from one solution to another
         between two frames. With the hock's bend fixed, gaskin and cannon are one
         rigid link, and hip-stifle-fetlock is solved as two links with the stifle
         forward, just as the foreleg is solved around its knee. Every curve below
         starts and ends at rest and meets the next one where it begins, so the
         motion is smooth through lift-off and landing. */
      const h0 = wrapPi(L.rC - L.rT); // the hock's bend standing square
      const act = state.act, gk = clamp(G.knee / 106, 0, 1) * L.stepScale;
      const pushOff = h0 - 0.14 * act; // straighter as it leaves the ground
      let hock: number;
      if (!swing) {
        const u = L.u;
        // Straightens slowly over the stance, so it never fights the heel lifting at the end of it.
        hock = lerp(h0, pushOff, sstep(0.15, 1, u)) + 0.08 * act * Math.sin(Math.PI * Math.min(1, u / 0.6)) ** 2;
      } else {
        const sw = clamp((L.sw - L.sw0) / (1 - L.sw0), 0, 1);
        const fold = Math.sin(Math.PI * Math.min(1, sw / 0.8)) ** 2; // tucks up, then opens to reach
        hock = lerp(pushOff, h0, sstep(0.35, 1, sw)) + (0.35 + 1.05 * gk) * fold;
      }
      hock = clamp(hock, 0.2, 2.4);
      const l23 = Math.sqrt(L.l2 * L.l2 + L.l3 * L.l3 + 2 * L.l2 * L.l3 * Math.cos(hock));
      const delta = Math.atan2(L.l3 * Math.sin(hock), L.l2 + L.l3 * Math.cos(hock));
      const D = Math.hypot(Fx, Fy);
      over = D - (L.l1 + l23) * 0.996;
      // Out of reach (a hoof trailing far behind just after it leaves the ground), the leg eases
      // toward straight instead of snapping to it: near full stretch the hip angle would otherwise
      // swing wildly for the smallest change in distance.
      const R = (L.l1 + l23) * 0.985, W = 0.05;
      const Dr = D < R - W ? D : R - W * Math.exp(-(D - (R - W)) / W);
      const Dc = Math.max(Dr, Math.abs(L.l1 - l23) + 1e-3);
      const A = Math.acos(clamp((L.l1 * L.l1 + Dc * Dc - l23 * l23) / (2 * L.l1 * Dc), -1, 1));
      const aF = Math.atan2(Fy, Fx), phi1 = aF + A; // the stifle bends forward
      const phiSF = Math.atan2(Dc * Math.sin(aF) - L.l1 * Math.sin(phi1), Dc * Math.cos(aF) - L.l1 * Math.cos(phi1));
      const phi2 = phiSF - delta, phiC = phi2 + hock;
      L.ang[0] = wrapPi(phi1 - L.rF); L.ang[1] = wrapPi(phi2 - L.rT); L.ang[2] = wrapPi(phiC - L.rC);
    }
    return over;
  }
  function applyLeg(L: Leg) {
    L.bones[0].parent!.getWorldQuaternion(_qp);
    _qp.premultiply(_gqi).invert();
    _qx.setFromAxisAngle(XA, L.phi);
    for (let i = 0; i < L.bones.length; i++) {
      if (i === 0) {
        _q.setFromAxisAngle(ZA, L.ang[0]).premultiply(_qx).premultiply(_qp);
        if (L.front) {
          _t.set(L.gx * L.glideW, L.gy * L.glideW, 0).applyQuaternion(_qp);
          L.bones[0].position.copy(L.restPos).add(_t);
        }
      } else _q.setFromAxisAngle(ZA, L.ang[i] - L.ang[i - 1]);
      L.bones[i].quaternion.copy(_q);
    }
  }
  function homeWorld(L: Leg, out: THREE.Vector3, tAhead = 0, lead = 0) {
    const yaw = state.yaw + state.omega * tAhead, c = Math.cos(yaw), s = Math.sin(yaw);
    const fx = state.x + Math.cos(state.yaw) * state.v * tAhead, fz = state.z - Math.sin(state.yaw) * state.v * tAhead;
    const lx = L.home.x * S + lead, lz = L.home.z * S;
    return out.set(fx + c * lx + s * lz, 0, fz - s * lx + c * lz);
  }
  const bump = (p: number, duty: number, W: number) => {
    const x = frac(p - duty / 2 + 0.5) - 0.5;
    return Math.abs(x) > W / 2 ? 0 : 0.5 * (1 + Math.cos((TAU * x) / W));
  };

  const REAR_FK = [6, 30, 78, -42, -84, -100].map((d) => d * D2R);
  function updateLegStates(dt: number, moving: boolean) {
    let allDown = true, settled = true;
    for (const L of legs) {
      const p = frac(state.phase - G.off[L.i]);
      L.p = p;
      if (L.stance) {
        L.u = p < G.duty ? p / G.duty : p > (G.duty + 1) / 2 ? 0 : 1;
        const far = homeWorld(L, _t).distanceTo(L.lock);
        if (far > 0.04) settled = false;
        if (!state.idle && state.rear < 0 && p >= G.duty) {
          const sExp = (p - G.duty) / (1 - G.duty);
          if (sExp < 0.4 && (moving || far > 0.04)) {
            L.stance = false;
            L.sw = sExp;
            L.sw0 = sExp;
            L.p0.copy(L.gNow);
            L.stepScale = moving ? 1 : clamp(far / 0.25, 0.2, 1);
          }
        }
      } else {
        L.sw += dt / ((1 - G.duty) * G.T);
        if (L.sw >= 1) {
          L.stance = true;
          L.sw = 0;
          L.u = 0;
          homeWorld(L, L.lock, 0, state.v * G.duty * G.T * 0.5);
          hoofSound(0.2 + 0.7 * clamp(state.v / 7, 0, 1) * L.stepScale + (moving ? 0 : -0.1));
        }
      }
      if (!L.stance) allDown = false;
    }
    if (moving) state.idle = false;
    else if (allDown && settled && state.rear < 0) state.idle = true;
  }
  function poseTrunk() {
    const a = state.act;
    let bf = 0, bh = 0;
    for (const L of legs) {
      const b = bump(L.p, G.duty, G.W);
      if (L.front) bf += b;
      else bh += b;
    }
    // grazing: the forehand sinks a little as the head goes down
    const offF = a * (G.base + G.amp * bf) - state.dropF + state.rearOff - bd.grazeDrop * state.graze, offH = a * (G.base + G.amp * bh) - state.dropH;
    const r = state.rearR;
    const pitch = Math.asin(clamp((offF - offH) / 1.08, -0.4, 0.4)) + r * 50 * D2R - clamp(state.accel, -4, 4) * 0.006 * a;
    state.pitch = pitch;
    const sp = a * G.spine * D2R * Math.cos(TAU * (state.phase - 0.9));
    B.loin.rotation.z = sp + r * 0.12;
    B.chest.rotation.z = -0.45 * sp - r * 0.1;
    const cl = Math.cos(B.loin.rotation.z), sl = Math.sin(B.loin.rotation.z);
    const lo = REST.loin, hp = REST.hips, fm = REST['femR'], bdy = REST.body;
    // hip joint relative to the body bone, through the bent loin
    const hx0 = hp[0] - lo[0] + (fm[0] - hp[0]), hy0 = hp[1] - lo[1] + (fm[1] - hp[1]);
    const rx = lo[0] - bdy[0] + (hx0 * cl - hy0 * sl), ry = lo[1] - bdy[1] + (hx0 * sl + hy0 * cl);
    const hx = fm[0] - 0.11 * r, hy = fm[1] + offH - 0.085 * r, c = Math.cos(pitch), s = Math.sin(pitch);
    const sway = a * Math.sin(TAU * state.phase) * (state.v / S < 2 ? 0.01 : 0.004);
    B.body.position.set(hx - (c * rx - s * ry), hy - (s * rx + c * ry), sway + Math.sin(state.time * 0.4) * 0.004 * (1 - a));
    B.body.rotation.set(
      -state.omega * state.v * 0.014 + a * 0.012 * Math.sin(TAU * state.phase + 1),
      a * 0.014 * Math.sin(TAU * state.phase),
      pitch,
    );
  }
  function solveAllLegs(): [number, number] {
    let oF = 0, oH = 0;
    const a = state.act, gi = G.knee / 100, wFK = sstep(0.02, 0.3, state.rearR), bodyPitch = state.pitch + B.chest.rotation.z;
    for (const L of legs) {
      let psi: number, thPas: number, kappa = 0;
      const swing = !L.stance;
      if (!swing) {
        const u = L.u;
        // The heel lifts and the hoof rolls onto its toe over the second half of the stance, not in its last moments.
        psi = a * keys([[0, 5], [0.15, 0], [0.45, 0], [1, -34]], u) * D2R;
        thPas = keys([[0, -8 * a], [0.35, G.load * a], [0.5, G.load * a], [1, -14 * a]], u) * D2R;
        _g.copy(L.lock);
        pony.worldToLocal(_g);
        L.gNow.set(_g.x + (TOE_X - G_X) * (1 - Math.cos(psi)) * (psi < 0 ? 1 : 0), psi < 0 ? -(TOE_X - G_X) * Math.sin(psi) : 0, _g.z);
        pony.localToWorld(L.gNow);
      } else {
        // How far along its own path the hoof is. The clock (L.sw) may start late to keep the
        // footfalls in step; the path never does, so nothing jumps on the first frame of a swing.
        const s = clamp((L.sw - L.sw0) / (1 - L.sw0), 0, 1), e = L.front ? s * s * (3 - 2 * s) : 1 - (1 - s) ** 3 * (1 + 3 * s); // hind: from rest, but quickest early, so the hoof never trails
        psi = keys([[0, -34 * a], [0.3, -34 * a - 34 * gi], [0.7, -22 * gi], [0.92, 6 * a], [1, 5 * a]], s) * D2R;
        thPas = keys([[0, -14 * a], [0.35, -14 - 40 * gi], [0.75, -20], [1, -8 * a]], s) * D2R;
        if (L.front) kappa = G.knee * D2R * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 1.1) * L.stepScale;
        homeWorld(L, _t, (1 - L.sw) * (1 - G.duty) * G.T, state.v * G.duty * G.T * 0.5);
        _g.lerpVectors(L.p0, _t, e);
        // The hind hoof rises early and is carried forward in a high arc; every curve here starts
        // and ends at rest, so the lift-off is smooth.
        const lift = (L.front ? G.hF : G.hH) * L.stepScale * S;
        _g.y = lerp(L.p0.y, 0, e) + lift * (L.front ? Math.sin(Math.PI * s) * (1 + 0.35 * Math.cos(Math.PI * s)) : Math.sin(Math.PI * Math.pow(s, 0.8)) ** 2);
        L.gNow.copy(_g);
        pony.worldToLocal(_g);
      }
      L.glideW = 1;
      const over = solveLeg(L, _g, psi, thPas, kappa, swing);
      if (L.front && wFK > 0) {
        // rearing: forelegs fold up and paw
        const paw = Math.sin(state.time * 7 + (L.s > 0 ? 0 : 2.2)) * state.rearR;
        for (let i = 0; i < 6; i++) {
          let t = bodyPitch + REAR_FK[i];
          if (i === 2) t += 0.22 * paw;
          if (i >= 3) t -= 0.2 * paw;
          L.ang[i] = lerp(L.ang[i], t, wFK);
        }
        L.phi *= 1 - wFK;
        L.glideW = 1 - wFK;
      } else if (L.stance) {
        if (L.front) oF = Math.max(oF, over);
        else oH = Math.max(oH, over);
      }
      applyLeg(L);
    }
    return [oF, oH];
  }

  const lookTarget = new V3(), pointer = new THREE.Vector2(0, 0), raycaster = new THREE.Raycaster();
  let pointerTime = -99;
  function poseSecondary(dt: number) {
    const a = state.act, r = state.rearR, t = state.time, w = state.wind, gz = state.graze;
    // neck + head: nod with the gait, stretch out at speed, follow the finger
    let nod = 0;
    if (state.v / S < 2) nod = a * 3.5 * D2R * Math.sin(2 * TAU * (state.phase - G.off[0]) + 0.6);
    else nod = a * (2 + G.neck * 0.25) * D2R * Math.sin(TAU * (state.phase - 0.5));
    let ty = 0, tp = 0;
    if (t - pointerTime < 5 && r < 0.05 && gz < 0.05) {
      raycaster.setFromCamera(pointer, camera);
      B.head.getWorldPosition(_t);
      lookTarget.copy(raycaster.ray.direction).multiplyScalar(Math.max(2, camera.position.distanceTo(_t) * 0.85)).add(raycaster.ray.origin);
      pony.worldToLocal(lookTarget);
      pony.worldToLocal(_t);
      lookTarget.sub(_t);
      const k = 1 - 0.75 * sstep(1, 6, state.v);
      ty = clamp(Math.atan2(-lookTarget.z, lookTarget.x), -1.25, 1.25) * k;
      tp = clamp(Math.atan2(lookTarget.y, Math.hypot(lookTarget.x, lookTarget.z)) + 0.1, -0.5, 0.42) * k;
    }
    state.lookYaw = damp(state.lookYaw, ty, 4, dt);
    state.lookPitch = damp(state.lookPitch, tp, 4, dt);
    const ly = state.lookYaw, lp = state.lookPitch, low = G.neck * D2R * a, idle = (1 - a) * Math.sin(t * 0.6) * 0.012;
    const comp = -state.pitch * 0.5;
    // grazing: the neck reaches down to the ground and the head tucks to it; munching nods the jaw
    const chew = state.munch * Math.sin(t * 13) * 0.05;
    B.neck1.rotation.set(0, ly * 0.22, -low * 0.55 + nod + lp * 0.3 + comp * 0.6 - r * 0.3 + idle - 1.38 * gz);
    B.neck2.rotation.set(0, ly * 0.24, -low * 0.3 + nod * 0.4 + lp * 0.25 - r * 0.2 - 0.12 * gz);
    B.neck3.rotation.set(0, ly * 0.24, -low * 0.15 + lp * 0.2 - r * 0.1 + 0.05 * gz);
    B.head.rotation.set(ly * 0.12, ly * 0.3, low * 0.75 - nod * 0.9 + lp * 0.25 + comp * 0.4 - r * 0.08 + 0.22 * gz + chew);
    // ears: track the finger, pin back at speed, flick now and then, prick up while eating
    for (let i = 0; i < 2; i++) {
      const s = i ? -1 : 1, bone = i ? B.earL : B.earR;
      state.earT[i] -= dt;
      state.earF[i] += dt;
      if (state.earT[i] < 0) {
        state.earT[i] = (state.eat ? 0.8 : 1.5) + Math.random() * (state.eat ? 2 : 5);
        state.earF[i] = 0;
      }
      const fl = state.earF[i] < 0.3 ? Math.sin((state.earF[i] / 0.3) * Math.PI) : 0;
      const back = sstep(3.5, 7, state.v / S) * 0.75 + r * 0.5;
      bone.rotation.set(s * (0.1 * back - 0.12 * fl), ly * 0.35 + s * (0.55 * fl + 1.0 * back), back * 0.65 + 0.12 * fl);
    }
    // breathing
    const br = Math.sin(t * TAU * (0.26 + 0.9 * w)) * (0.011 + 0.012 * w);
    B.ribs.scale.set(1, 1 + br * 0.5, 1 + br);
    // tail: carried higher and streaming with speed, the odd swish when idle
    state.swish += dt;
    state.nextSwish -= dt;
    if (state.nextSwish < 0) {
      state.nextSwish = 3 + Math.random() * 6;
      state.swish = 0;
      state.swishDir = Math.random() < 0.5 ? -1 : 1;
    }
    const lift = [0.62, 0.16, 0.02, -0.05, -0.07], wv = TAU * state.phase, hang = -(state.pitch + B.loin.rotation.z);
    for (let k = 0; k < 5; k++) {
      const tau = Math.max(0, state.swish - k * 0.09);
      const swv = state.swishDir * 0.5 * Math.sin(TAU * 1.5 * tau) * Math.exp(-2.4 * tau) * (1 - 0.6 * w);
      const wave = Math.sin(2 * wv - k * 0.9) * (0.02 + 0.06 * w) * (k ? 1 : 0.4) * a;
      B['tail' + k].rotation.set(swv * (k ? 0.5 : 0.7) + 0.02 * Math.sin(t * 0.9 + k) * (1 - a), 0, -lift[k] * w + (k ? 0 : hang) + wave);
    }
  }

  function setGait(i: number, quiet = false) {
    state.gait = clamp(Math.round(i), 0, GAIT_COUNT - 1) as PonyGait;
    if (state.rear >= 0 || state.pendingRear) state.resume = -1;
    if (!quiet) events.onGait?.(state.gait);
  }
  function updateRear(dt: number) {
    if (state.pendingRear && state.idle && state.rear < 0) {
      state.pendingRear = false;
      state.rear = 0;
      whinny();
    }
    if (state.rear < 0) {
      state.rearR = 0;
      state.rearOff = 0;
      return;
    }
    const t = (state.rear += dt);
    const up = sstep(0.22, 0.95, t), down = sstep(1.55, 2.2, t);
    state.rearR = (up - down) * (1 + 0.03 * Math.sin(t * 9) * (t > 0.9 && t < 1.6 ? 1 : 0));
    state.rearOff =
      (t < 0.28 ? -0.04 * Math.sin((Math.PI * t) / 0.28) : 0) +
      (t > 2.2 ? -0.05 * Math.sin((Math.PI * (t - 2.2)) / 0.45) * Math.exp(-(t - 2.2) * 2) : 0);
    if (t > 2.14 && !state.rearLanded) {
      state.rearLanded = true;
      hoofSound(1);
      window.setTimeout(() => hoofSound(0.9), 70);
    }
    if (t > 2.65) {
      state.rear = -1;
      state.rearLanded = false;
      state.rearR = 0;
      state.rearOff = 0;
      if (state.resume >= 0) {
        setGait(state.resume);
        state.resume = -1;
      }
    }
  }
  /** Where the food goes down: just in front of the forefeet, where the lowered muzzle reaches. */
  /** Where the muzzle ends up with the head all the way down: tried out on the pose, then put back. */
  const muzzleOnGround = (out: THREE.Vector3) => {
    const was = state.graze;
    state.graze = 1;
    poseTrunk();
    poseSecondary(0);
    pony.updateMatrixWorld(true);
    out.set(MUZZLE[0] - REST.head[0], MUZZLE[1] - REST.head[1], 0);
    B.head.localToWorld(out);
    state.graze = was;
    poseTrunk();
    poseSecondary(0);
    pony.updateMatrixWorld(true);
    return out;
  };
  const BITES = [1.35, 2.0, 2.65, 3.3];
  const FOOD_SIZE = 1.6;
  function updateEat(dt: number) {
    if (state.pendingEat && !state.eat && state.idle && state.rear < 0 && !state.pendingRear) {
      const food = makeFood(state.pendingEat);
      muzzleOnGround(_t);
      food.position.set(_t.x, 0, _t.z);
      food.rotation.y = state.yaw + (state.pendingEat === 'wortel' ? 0.6 : 0);
      scene.add(food);
      state.eat = { kind: state.pendingEat, t: 0, food, bites: 0 };
      state.pendingEat = null;
    }
    const e = state.eat;
    let want = 0, munch = 0;
    if (e) {
      e.t += dt;
      want = e.t > 0.25 && e.t < 3.9 ? 1 : 0;
      munch = e.t > 1.2 && e.t < 3.8 ? 1 : 0;
      if (e.bites < BITES.length && e.t >= BITES[e.bites]) {
        e.bites++;
        crunch();
        const left = 1 - e.bites / BITES.length;
        e.food.scale.setScalar(FOOD_SIZE * Math.max(S, 0.85) * Math.max(left, 0.001));
        if (left <= 0) e.food.visible = false;
      }
      if (e.t > 4.7) {
        scene.remove(e.food);
        disposeObject(e.food);
        state.eat = null;
        nicker();
        events.onAte?.(e.kind);
      }
    }
    state.graze = damp(state.graze, want, 3.2, dt);
    state.munch = damp(state.munch, munch, 6, dt);
  }

  function updatePony(dt: number) {
    state.time += dt;
    updateRear(dt);
    updateEat(dt);
    const busy = state.rear >= 0 || state.pendingRear || !!state.pendingEat || !!state.eat;
    const target = busy ? 0 : GAITS[state.gait] * S, v0 = state.v;
    /** Speed in the animal's own lengths, which is what the gait depends on. */
    const vb = state.v / S;
    const acc = target > state.v ? 1.1 + state.v * 0.4 : 2.2 + state.v * 0.55;
    state.v = state.v < target ? Math.min(target, state.v + acc * dt) : Math.max(target, state.v - acc * dt);
    state.accel = damp(state.accel, (state.v - v0) / dt, 6, dt);
    const om = state.steer * 0.95 * sstep(0.05, 1.0, vb) * (1 - 0.4 * sstep(3, 7, vb));
    state.omega = damp(state.omega, om, 3.5, dt);
    state.yaw += state.omega * dt;
    state.x += Math.cos(state.yaw) * state.v * dt;
    state.z -= Math.sin(state.yaw) * state.v * dt;
    pony.position.set(state.x, 0, state.z);
    pony.rotation.y = state.yaw;
    pony.updateMatrixWorld(true);
    _gqi.copy(pony.quaternion).invert();
    state.act = sstep(0.08, 0.8, vb);
    state.wind = damp(state.wind, clamp(vb / 7, 0, 1), 3, dt);
    sampleGait(vb);
    const moving = target > 0 || state.v > 0.03;
    if (!state.idle) state.phase = frac(state.phase + dt / G.T);
    updateLegStates(dt, moving);

    poseTrunk();
    poseSecondary(dt);
    pony.updateMatrixWorld(true);
    const [oF, oH] = solveAllLegs();
    // if a planted leg cannot reach, sink that end of the body just enough (this is what makes the trunk vault)
    const dF = oF > 0 ? Math.min(oF * 1.2, 0.9 * dt) : -0.3 * dt, dH = oH > 0 ? Math.min(oH * 1.2, 0.9 * dt) : -0.3 * dt;
    state.dropF = clamp(state.dropF + dF, 0, 0.15);
    state.dropH = clamp(state.dropH + dH, 0, 0.15);
    if (oF > 0 || oH > 0) {
      poseTrunk();
      pony.updateMatrixWorld(true);
      solveAllLegs();
    }
    for (const u of hairU) {
      u.uTime.value = state.time;
      u.uWind.value = state.wind;
    }
  }

  /* ───────────────────────────── sound ───────────────────────────── */
  let actx: AudioContext | null = null, noiseBuf: AudioBuffer | null = null, master: GainNode | null = null;
  function initAudio() {
    if (actx) {
      if (actx.state === 'suspended') void actx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
    } catch {
      return;
    }
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function hoofSound(vol: number) {
    if (!actx || !master || !noiseBuf || vol <= 0.02) return;
    const t = actx.currentTime, src = actx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 280 + Math.random() * 220 + vol * 300;
    lp.Q.value = 1.1;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.8 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(lp).connect(g).connect(master);
    src.start(t, Math.random() * 0.5, 0.12);
    const o = actx.createOscillator(), og = actx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    og.gain.setValueAtTime(0.6 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.12);
  }
  function crunch() {
    if (!actx || !master || !noiseBuf) return;
    const t = actx.currentTime;
    for (let k = 0; k < 3; k++) {
      const src = actx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 1600;
      bp.Q.value = 0.9;
      const g = actx.createGain(), at = t + k * 0.07 + Math.random() * 0.02;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.5, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      src.connect(bp).connect(g).connect(master);
      src.start(at, Math.random() * 0.5, 0.08);
    }
  }
  function neigh(dur: number, peak: number, base: number, level: number) {
    if (!actx || !master) return;
    const t = actx.currentTime, out = actx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.08);
    out.gain.setValueAtTime(level, t + dur * 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f1 = actx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 1500; f1.Q.value = 1.4;
    const f2 = actx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 2900; f2.Q.value = 2.5;
    const trem = actx.createGain();
    trem.gain.value = 0.7;
    const lfo = actx.createOscillator(), lg = actx.createGain(), tg = actx.createGain();
    lfo.frequency.setValueAtTime(9, t);
    lfo.frequency.linearRampToValueAtTime(15, t + dur);
    lg.gain.setValueAtTime(20, t);
    lg.gain.linearRampToValueAtTime(90, t + dur);
    tg.gain.value = 0.3;
    lfo.connect(tg).connect(trem.gain);
    for (const [mul, type] of [[1, 'sawtooth'], [1.5, 'square']] as const) {
      const o = actx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(base * 1.4 * mul, t);
      o.frequency.exponentialRampToValueAtTime(peak * mul, t + 0.16);
      o.frequency.exponentialRampToValueAtTime(peak * 0.77 * mul, t + dur * 0.45);
      o.frequency.exponentialRampToValueAtTime(base * mul, t + dur);
      lfo.connect(lg).connect(o.frequency);
      const g = actx.createGain();
      g.gain.value = mul === 1 ? 1 : 0.25;
      o.connect(g).connect(trem);
      o.start(t);
      o.stop(t + dur);
    }
    trem.connect(f1).connect(out);
    trem.connect(f2).connect(out);
    out.connect(master);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  // A pony's whinny is higher than a horse's.
  const whinny = () => neigh(1.4, 1750, 480, 0.2);
  const nicker = () => neigh(0.6, 900, 380, 0.12);

  /* ───────────────────────────── input ───────────────────────────── */
  const PICK: [string, number, number, number][] = [['head', 0.1, -0.1, 0.2], ['neck2', 0, 0, 0.22], ['chest', 0.05, -0.12, 0.4], ['body', 0, -0.05, 0.4], ['hips', 0, -0.1, 0.4]];
  function overPony() {
    raycaster.setFromCamera(pointer, camera);
    for (const [n, ox, oy, rad] of PICK) {
      B[n].getWorldPosition(_t);
      _t.y += oy;
      _t.x += Math.cos(state.yaw) * ox;
      _t.z -= Math.sin(state.yaw) * ox;
      if (raycaster.ray.distanceSqToPoint(_t) < rad * rad * S * S) return true;
    }
    return false;
  }
  function rearUp() {
    if (state.rear >= 0 || state.pendingRear || state.eat || state.pendingEat) return;
    if (state.gait !== 0) {
      const g = state.gait;
      setGait(0, true);
      state.resume = g;
    }
    state.pendingRear = true;
  }
  let downAt: [number, number] | null = null;
  const setPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerTime = state.time;
  };
  listen(canvas, 'pointermove', (e) => setPointer(e));
  listen(canvas, 'pointerdown', (e) => {
    initAudio();
    setPointer(e);
    downAt = [e.clientX, e.clientY];
  });
  listen(canvas, 'pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved < 8) {
      setPointer(e);
      if (pony.children.length > 1 && overPony()) rearUp();
    }
  });
  // Any touch on the page is allowed to wake the sound up (browsers insist on a gesture).
  listen(window, 'pointerdown', () => initAudio());
  listen(window, 'keydown', () => initAudio());

  /* ───────────────────────────── main loop ───────────────────────────── */
  let last = performance.now();
  const prev = new V3();
  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    prev.copy(pony.position);
    updatePony(dt);
    // the world follows the pony: camera, light, ground, grass, hills
    _t.subVectors(pony.position, prev);
    camera.position.add(_t);
    controls.target.add(_t);
    controls.update();
    const hx = pony.position.x, hz = pony.position.z;
    sun.target.position.set(hx, 0.7, hz);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 40);
    ground.position.set(Math.round(hx / GROUND_TILE) * GROUND_TILE, 0, Math.round(hz / GROUND_TILE) * GROUND_TILE);
    hills.position.set(hx, 0, hz);
    sky.position.set(hx, 0, hz);
    const bx = Math.round(hx / GRASS_S) * GRASS_S, bz = Math.round(hz / GRASS_S) * GRASS_S;
    for (const t of grassTiles) t.position.set(bx + t.userData.o[0] * GRASS_S, 0, bz + t.userData.o[1] * GRASS_S);
    grassU.uTime.value = state.time;
    grassU.uCenter.value.set(hx, hz);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  renderer.render(scene, camera);
  // Building takes a moment; let the screen paint "getting the pony ready" first.
  const buildTimer = window.setTimeout(() => {
    if (disposed) return;
    try {
      buildPony();
      paint(colors);
      legs.push(makeLeg(0, true, -1), makeLeg(1, true, 1), makeLeg(2, false, -1), makeLeg(3, false, 1));
      pony.updateMatrixWorld(true);
      for (const L of legs) {
        homeWorld(L, L.lock);
        L.gNow.copy(L.lock);
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
      events.onReady?.();
    } catch (err) {
      events.onError?.(err);
    }
  }, 60);

  return {
    setGait: (g) => {
      initAudio();
      if (state.eat || state.pendingEat) return;
      setGait(g, true);
    },
    steer: (dir) => {
      initAudio();
      state.steer = dir;
    },
    rear: () => {
      initAudio();
      rearUp();
    },
    feed: (kind) => {
      initAudio();
      if (state.eat || state.pendingEat) return false;
      state.pendingRear = false;
      state.resume = -1;
      setGait(0);
      state.pendingEat = kind;
      return true;
    },
    isEating: () => !!(state.eat || state.pendingEat),
    setColors: (c) => {
      colors = c;
      if (coatParts.length) paint(c);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(buildTimer);
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      controls.dispose();
      const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) geos.add(m.geometry);
        if (m.material) for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mt);
      });
      for (const mt of mats) {
        const map = (mt as THREE.MeshStandardMaterial).map;
        if (map) texs.add(map);
      }
      geos.forEach((g) => g.dispose());
      mats.forEach((mt) => mt.dispose());
      texs.forEach((t) => t.dispose());
      earInMat.dispose();
      hornMat.dispose();
      hoofDark.dispose();
      envTexture?.dispose();
      skeleton?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      void actx?.close().catch(() => {});
      actx = null;
    },
  };
}
