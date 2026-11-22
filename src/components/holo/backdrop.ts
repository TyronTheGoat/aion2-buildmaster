import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { loadImage } from "./assets";

/**
 * Hero backdrop: the dungeon / forest hologram painting from the Hero Refinement Pack as a 2.5D layer.
 *
 * It is composited after bloom (so the painting itself does not bloom) and the hologram is added on top
 * as light. Depth comes from a slight parallax with the camera, two drifting fog layers, a vignette with
 * a light pool on the character, and falling leaves in the 3D scene (see createLeaves).
 */

export interface BackdropImage {
  file: string;
  /** centre of the painted platform circle (uv, y from the top) and its radius as a fraction of the width */
  circle: [number, number, number];
}
const WIDE: BackdropImage = { file: "hero/forest_dungeon_primary.webp", circle: [0.507, 0.78, 0.273] };
const TALL: BackdropImage = { file: "hero/forest_dungeon_mobile.webp", circle: [0.5, 0.67, 0.457] };

export interface Backdrop {
  pass: ShaderPass;
  /** screen-space y (0 = top) of the character's feet and the platform radius in px, for the overview */
  layout(w: number, h: number, feetY: number, platformPx: number): number;
  update(t: number, azimuth: number, polar: number, zoom: number, focus: boolean): void;
  dispose(): void;
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D tDiffuse; uniform sampler2D uBg;
uniform vec2 uScale; uniform vec2 uOffset; uniform vec2 uPan; uniform float uZoom;
uniform float uTime; uniform float uDim; uniform vec2 uSpot;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 3.7) + 0.15 * noise(p * 4.3 + 1.3); }
void main() {
  vec4 fg = texture2D(tDiffuse, vUv);
  // screen → painting (cover fit, anchored on the platform), with parallax and a gentle zoom
  vec2 s = (vUv - uOffset) / uScale;
  vec2 uv = (s - 0.5) / uZoom + 0.5 + uPan;
  vec3 bg = texture2D(uBg, clamp(uv, 0.001, 0.999)).rgb;
  // fog: two layers drifting at different speeds, thicker towards the floor
  float low = smoothstep(0.75, 0.05, uv.y);
  float f1 = fbm(vec2(uv.x * 3.0 + uTime * 0.018, uv.y * 7.0 - uTime * 0.004));
  float f2 = fbm(vec2(uv.x * 6.0 - uTime * 0.031, uv.y * 11.0 + 5.0));
  float fog = (smoothstep(0.35, 0.85, f1) * 0.65 + smoothstep(0.45, 0.9, f2) * 0.35) * (0.35 + 0.65 * low);
  bg += vec3(0.16, 0.42, 0.62) * fog * 0.16;
  // depth: edges sink into darkness, the character stands in a soft pool of light
  vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
  float vig = smoothstep(0.95, 0.2, length(d));
  vec2 sp = (vUv - uSpot) * vec2(2.2, 1.2);
  float spot = exp(-dot(sp, sp) * 2.5);
  bg *= uDim * (0.38 + 0.62 * vig) * (0.72 + 0.45 * spot);
  gl_FragColor = vec4(fg.rgb + bg, 1.0);
}`;

export async function loadBackdrop(tall: boolean): Promise<Backdrop | null> {
  // the portrait painting on phones, the wide one elsewhere; either one as fallback
  let info = tall ? TALL : WIDE;
  let img = await loadImage(info.file);
  if (!img) { info = tall ? WIDE : TALL; img = await loadImage(info.file); }
  if (!img) return null;
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  const aspect = img.naturalWidth / img.naturalHeight;
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uBg: { value: tex },
      uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) },
      uPan: { value: new THREE.Vector2(0, 0) }, uZoom: { value: 1.06 },
      uTime: { value: 0 }, uDim: { value: 1 }, uSpot: { value: new THREE.Vector2(0.5, 0.45) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  });
  const u = pass.uniforms;
  let dim = 1;
  return {
    pass,
    layout(w, h, feetY, platformPx) {
      // scale so the painted platform circle matches ours, but always cover the screen
      const [cx, cy, cr] = info.circle;
      const cover = Math.max(w / (h * aspect), 1) * h * aspect; // painting width in px at cover fit
      const want = platformPx / cr;
      // big enough that the circle can sit under the feet without showing the painting's edge
      const anchor = Math.max(feetY / cy, (h - feetY) / (1 - cy)) * aspect;
      const pw = Math.max(cover, anchor, Math.min(want, cover * 1.6));
      const ph = pw / aspect;
      u.uScale.value.set(pw / w, ph / h);
      // place the circle centre under the feet (screen uv, y up)
      const sx = 0.5 - cx * (pw / w);
      let sy = (1 - feetY / h) - (1 - cy) * (ph / h);
      sy = Math.min(0, Math.max(1 - ph / h, sy)); // never show the painting's edge
      u.uOffset.value.set(Math.min(0, Math.max(1 - pw / w, sx)), sy);
      u.uSpot.value.set(0.5, 1 - (feetY - h * 0.33) / h);
      return pw * cr; // painted circle radius in px
    },
    update(t, azimuth, polar, zoom, focus) {
      u.uTime.value = t;
      u.uPan.value.set(-Math.sin(azimuth) * 0.025, (polar - Math.PI / 2) * 0.03);
      u.uZoom.value = 1.06 + zoom * 0.06;
      dim += ((focus ? 0.55 : 1) - dim) * 0.05;
      u.uDim.value = dim;
    },
    dispose() { tex.dispose(); pass.dispose(); },
  };
}

/** A few softly falling leaves around and in front of the character (cyan hologram style). */
export function createLeaves(count: number, reduce: boolean) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  const base: [number, number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const front = i % 4 === 0; // a few close to the camera for depth
    const x = (Math.random() - 0.5) * (front ? 3 : 6);
    const z = front ? 1.2 + Math.random() * 1.6 : -3.5 + Math.random() * 3.5;
    base.push([x, Math.random() * 3, z, 0.04 + Math.random() * 0.05]);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; varying float vRot; varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(90.0 / -mv.z, 2.0, 46.0);
        vRot = aSeed * 6.28 + uTime * (0.6 + aSeed);
        vFade = smoothstep(0.0, 0.4, position.y) * smoothstep(3.0, 2.4, position.y) * (0.5 + 0.5 * aSeed);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vRot; varying float vFade;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        p = mat2(c, -s, s, c) * p;
        p.y *= 0.55 + 0.45 * abs(sin(vRot * 0.7)); // tumbling
        // leaf: pointed ellipse with a midrib
        float leaf = 1.0 - smoothstep(0.0, 0.06, abs(p.x) * 2.3 + p.y * p.y * 4.0 - 0.42 + p.y * 0.25);
        float rib = (1.0 - smoothstep(0.0, 0.025, abs(p.x))) * step(abs(p.y), 0.38);
        float a = clamp(leaf * 0.7 + rib * 0.5, 0.0, 1.0) * vFade;
        gl_FragColor = vec4(vec3(0.25, 0.7, 0.95) * a * 0.45, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(t: number) {
      mat.uniforms.uTime.value = t;
      for (let i = 0; i < count; i++) {
        const [x, y0, z, speed] = base[i];
        const k = reduce ? 0 : t;
        const y = 3 - ((3 - y0 + k * speed * 1.4) % 3);
        pos[i * 3] = x + Math.sin(k * 0.5 + seed[i] * 9) * 0.35;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z + Math.cos(k * 0.4 + seed[i] * 5) * 0.2;
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
