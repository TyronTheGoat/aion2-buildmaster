import * as THREE from "three";
import type { Gender, WeaponKind } from "@/lib/hologram";

/**
 * Procedural, original hologram figure (male / female base body) built from smooth
 * lathe and ellipsoid shapes, with a simple joint hierarchy for an idle animation.
 * No game assets are used. Every equipment slot gets its own material and a glow
 * shell ("aura") that can be tinted in the item's grade color.
 */

const HOLO_BLUE = new THREE.Color(0x1f7bff);

const VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HOLO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uReveal; uniform float uStrength;
varying vec3 vN; varying vec3 vW;
void main() {
  if (vW.y > uReveal) discard;
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.3);
  float k = vW.y * 150.0;
  float fw = max(fwidth(k), 1e-4);
  float line = (1.0 - min(abs(fract(k) - 0.5) / fw, 1.0)) * clamp(1.4 - fw, 0.0, 1.0);
  float scanY = fract(uTime * 0.16) * 2.6 - 0.2;
  float band = exp(-pow((vW.y - scanY) * 12.0, 2.0));
  float edge = smoothstep(0.08, 0.0, uReveal - vW.y);
  float flicker = 0.965 + 0.035 * sin(uTime * 31.0 + vW.y * 7.0);
  vec3 c = uColor * (0.025 + 0.95 * fres + 0.2 * line + 0.22 * band) + vec3(0.55, 0.85, 1.0) * edge * 1.2;
  gl_FragColor = vec4(c * uStrength * flicker, 1.0);
}`;

const AURA_FRAG = /* glsl */ `
uniform vec3 uAura; uniform float uTime; uniform float uReveal; uniform float uOn; uniform float uFill; uniform float uBoost;
varying vec3 vN; varying vec3 vW;
void main() {
  if (vW.y > uReveal - 0.05 || uOn < 0.01) discard;
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(normalize(vN), v)), 1.7);
  float pulse = 0.72 + 0.28 * sin(uTime * 2.2 + vW.y * 5.0);
  float k = vW.y * 60.0 - uTime * 1.5;
  float ripple = 0.5 + 0.5 * sin(k);
  vec3 c = uAura * (fres * (0.55 + 0.2 * ripple) + uFill * (0.16 + 0.08 * ripple)) * pulse * uOn * uBoost;
  gl_FragColor = vec4(c, 1.0);
}`;

type V3 = [number, number, number];

export interface Figure {
  root: THREE.Group;
  anchors: Record<string, THREE.Object3D>;
  auras: Record<string, THREE.ShaderMaterial>;
  hitTargets: THREE.Mesh[];
  focusPoint(id: string, point: THREE.Vector3): THREE.Object3D | undefined;
  setAura(id: string, hex: number | null, full: boolean): void;
  setFocus(id: string | undefined): void;
  setHover(id: string | undefined): void;
  setPresent(on: boolean): void;
  update(t: number): void;
  dispose(): void;
}

/** Smooth surface of revolution through control points [radius, y] (bottom → top). */
function lathe(pts: [number, number][], segs = 36) {
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)));
  return new THREE.LatheGeometry(curve.getPoints(48), segs);
}

/** Limb hanging down from its joint (y = 0) to y = -len. */
function limb(len: number, rTop: number, rMid: number, rBot: number) {
  return lathe([
    [0, -len - rBot], [rBot * 0.8, -len - rBot * 0.55], [rBot, -len], [rMid, -len * 0.5],
    [rTop, -len * 0.1], [rTop * 0.8, rTop * 0.55], [0, rTop],
  ]);
}

const ellipsoid = () => new THREE.SphereGeometry(1, 40, 28);

export function buildFigure(gender: Gender, weapon: WeaponKind, reduce: boolean): Figure {
  const f = gender === "f";
  const root = new THREE.Group();
  const geos = new Set<THREE.BufferGeometry>();
  const mats: THREE.Material[] = [];
  const shared = { uTime: { value: 0 }, uReveal: { value: reduce ? 3 : -0.1 } };

  const holoMats: Record<string, THREE.ShaderMaterial> = {};
  const auras: Record<string, THREE.ShaderMaterial> = {};
  const auraState: Record<string, { on: number; to: number; fill: number }> = {};
  const anchors: Record<string, THREE.Object3D> = {};
  const hitTargets: THREE.Mesh[] = [];

  const prepass = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const prepassDouble = prepass.clone(); prepassDouble.side = THREE.DoubleSide;
  mats.push(prepass, prepassDouble);

  function holoMat(id: string, side: THREE.Side = THREE.FrontSide, strength = 1) {
    const key = `${id}|${side}|${strength}`;
    if (!holoMats[key]) {
      const m = new THREE.ShaderMaterial({
        uniforms: { ...shared, uColor: { value: HOLO_BLUE.clone() }, uStrength: { value: strength } },
        vertexShader: VERT, fragmentShader: HOLO_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
      });
      m.userData = { id, base: strength };
      holoMats[key] = m;
      mats.push(m);
    }
    return holoMats[key];
  }
  function auraMat(id: string) {
    if (!auras[id]) {
      auras[id] = new THREE.ShaderMaterial({
        uniforms: { ...shared, uAura: { value: new THREE.Color(0xffffff) }, uOn: { value: 0 }, uFill: { value: 0 }, uBoost: { value: 1 } },
        vertexShader: VERT, fragmentShader: AURA_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      auraState[id] = { on: 0, to: 0, fill: 0 };
      mats.push(auras[id]);
    }
    return auras[id];
  }

  interface PartOpts { p?: V3; r?: V3; s?: V3; aura?: V3 | number; side?: THREE.Side; strength?: number; hitOnly?: boolean }
  /** Adds a body / gear part: depth pre-pass + hologram surface + optional grade aura. */
  function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, id: string | null, o: PartOpts = {}) {
    geos.add(geo);
    const g = new THREE.Group();
    if (o.p) g.position.set(...o.p);
    if (o.r) g.rotation.set(...o.r);
    if (o.s) g.scale.set(...o.s);
    parent.add(g);
    if (o.hitOnly) {
      const hit = new THREE.Mesh(geo, hiddenMat);
      hit.userData.slot = id;
      g.add(hit);
      hitTargets.push(hit);
      return g;
    }
    const holo = new THREE.Mesh(geo, holoMat(id ?? "body", o.side, o.strength));
    holo.renderOrder = 2;
    const pre = new THREE.Mesh(geo, o.side === THREE.DoubleSide ? prepassDouble : prepass);
    pre.renderOrder = 1;
    g.add(pre, holo);
    if (id) {
      holo.userData.slot = id;
      hitTargets.push(holo);
      const a = new THREE.Mesh(geo, auraMat(id));
      const s = typeof o.aura === "number" ? [o.aura, o.aura, o.aura] as V3 : o.aura ?? [1.09, 1.03, 1.09];
      a.scale.set(...s);
      a.renderOrder = 3;
      g.add(a);
    }
    return g;
  }
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  mats.push(hiddenMat);
  const markers: Record<string, THREE.Object3D[]> = {};
  /** Camera focus point for a slot. Slots with several markers (both hands) focus the one nearest the click. */
  const marker = (parent: THREE.Object3D, p: V3, id: string) => {
    const m = new THREE.Object3D();
    m.position.set(...p);
    parent.add(m);
    if (!anchors[id]) anchors[id] = m;
    (markers[id] ??= []).push(m);
    return m;
  };

  // ---- proportions --------------------------------------------------------
  const P = f
    ? {
      hipsY: 0.9, shX: 0.165, shY: 0.5, neckTop: 0.67, headY: 0.77, head: [0.088, 0.112, 0.098] as V3,
      upper: [0.27, 0.047, 0.039, 0.033], fore: [0.24, 0.036, 0.031, 0.025], hand: 0.9,
      legX: 0.098, thigh: [0.42, 0.092, 0.07, 0.05], shin: [0.38, 0.05, 0.044, 0.029],
      torso: [[0, 0.0], [0.12, 0.03], [0.15, 0.1], [0.125, 0.2], [0.118, 0.26], [0.135, 0.34], [0.148, 0.43], [0.142, 0.5], [0.1, 0.55], [0.05, 0.58], [0, 0.585]] as [number, number][],
      pelvis: [0.18, 0.13, 0.12] as V3, deltoid: 0.052, neckR: 0.042,
    }
    : {
      hipsY: 0.95, shX: 0.205, shY: 0.53, neckTop: 0.72, headY: 0.83, head: [0.096, 0.12, 0.106] as V3,
      upper: [0.29, 0.06, 0.051, 0.043], fore: [0.26, 0.046, 0.04, 0.03], hand: 1,
      legX: 0.095, thigh: [0.44, 0.09, 0.077, 0.055], shin: [0.4, 0.057, 0.051, 0.033],
      torso: [[0, 0.0], [0.135, 0.03], [0.155, 0.12], [0.145, 0.24], [0.162, 0.36], [0.185, 0.46], [0.18, 0.53], [0.12, 0.59], [0.055, 0.625], [0, 0.63]] as [number, number][],
      pelvis: [0.165, 0.13, 0.115] as V3, deltoid: 0.07, neckR: 0.052,
    };

  // ---- skeleton + body ------------------------------------------------------
  const hips = new THREE.Group(); hips.position.y = P.hipsY; root.add(hips);
  part(hips, ellipsoid(), "pants:0", { p: [0, 0, 0], s: P.pelvis });
  const spine = new THREE.Group(); spine.position.y = 0.02; hips.add(spine);
  const chest = part(spine, lathe(P.torso), "torso:0", { s: [1, 1, 0.64] });
  if (f) {
    part(spine, ellipsoid(), "torso:0", { p: [0.062, 0.415, 0.068], s: [0.06, 0.058, 0.05] });
    part(spine, ellipsoid(), "torso:0", { p: [-0.062, 0.415, 0.068], s: [0.06, 0.058, 0.05] });
  }
  marker(spine, [0, 0.36, 0], "torso:0");
  marker(spine, [0, P.shY, 0], "shoulders:0");
  marker(hips, [0, -0.28, 0], "pants:0");
  // belt
  part(hips, new THREE.TorusGeometry(f ? 0.152 : 0.158, 0.011, 10, 64), "belt:0", { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.68, 1], aura: 1.12 });
  marker(hips, [0, 0.1, 0.1], "belt:0");

  const neck = new THREE.Group(); neck.position.y = P.neckTop - 0.11; spine.add(neck);
  part(neck, lathe([[0, -0.03], [P.neckR * 1.1, 0], [P.neckR, 0.06], [P.neckR * 0.95, 0.12], [0, 0.14]]), "necklace:0", { aura: [1.15, 1, 1.15] });
  part(neck, new THREE.TorusGeometry(P.neckR * 1.35, 0.006, 8, 48), "necklace:0", { p: [0, 0.0, 0.012], r: [Math.PI / 2 - 0.35, 0, 0], aura: 1.3 });
  part(neck, new THREE.OctahedronGeometry(0.014), "necklace:0", { p: [0, -0.035, P.neckR * 1.45], aura: 1.6 });
  marker(neck, [0, 0.02, 0.06], "necklace:0");

  const head = new THREE.Group(); head.position.y = P.headY - (P.neckTop - 0.11); neck.add(head);
  part(head, ellipsoid(), "helmet:0", { s: P.head, aura: 1.1 });
  part(head, ellipsoid(), "helmet:0", { p: [0, -0.055, 0.03], s: [P.head[0] * 0.72, P.head[1] * 0.5, P.head[2] * 0.72], aura: 1.08 });
  marker(head, [0, 0.01, 0], "helmet:0");
  for (const [i, sx] of [[0, -1], [1, 1]] as const) {
    part(head, ellipsoid(), "helmet:0", { p: [sx * P.head[0] * 0.98, 0, -0.005], s: [0.012, 0.028, 0.018] });
    const ear = part(head, new THREE.SphereGeometry(0.011, 16, 12), `earring:${i}`, { p: [sx * P.head[0] * 0.98, -0.04, 0], aura: 2.2 });
    part(ear, new THREE.SphereGeometry(0.035, 10, 8), `earring:${i}`, { hitOnly: true });
    marker(ear, [0, 0, 0], `earring:${i}`);
  }

  // arms: side -1 = character's right (-x), +1 = left (+x)
  const arms: Record<number, { sh: THREE.Group; el: THREE.Group; wr: THREE.Group; hand: THREE.Object3D }> = {};
  for (const side of [-1, 1]) {
    const idx = side < 0 ? 0 : 1;
    const sh = new THREE.Group(); sh.position.set(side * P.shX, P.shY, 0); spine.add(sh);
    part(sh, ellipsoid(), "shoulders:0", { p: [side * 0.012, 0.0, 0], s: [P.deltoid * 1.1, P.deltoid, P.deltoid * 1.05], aura: 1.15 });
    const [ul, ut, um, ub] = P.upper;
    part(sh, limb(ul, ut, um, ub), "shoulders:0", { aura: [1.12, 1.0, 1.12] });
    const el = new THREE.Group(); el.position.y = -ul; sh.add(el);
    const [fl, ft, fm, fb] = P.fore;
    part(el, limb(fl, ft, fm, fb), "gloves:0", { aura: [1.15, 1.02, 1.15] });
    part(el, new THREE.TorusGeometry(fb * 1.25, 0.006, 8, 40), `bracelet:${idx}`, { p: [0, -fl * 0.86, 0], r: [Math.PI / 2, 0, 0], aura: 1.3 });
    part(el, new THREE.SphereGeometry(fb * 1.9, 10, 8), `bracelet:${idx}`, { p: [0, -fl * 0.86, 0.01], hitOnly: true });
    marker(el, [0, -fl * 0.86, 0], `bracelet:${idx}`);
    const wr = new THREE.Group(); wr.position.y = -fl; el.add(wr);
    const hs = P.hand;
    const hand = part(wr, ellipsoid(), "gloves:0", { p: [0, -0.07 * hs, 0.004], s: [0.022 * hs, 0.075 * hs, 0.042 * hs], aura: 1.18 });
    part(wr, ellipsoid(), "gloves:0", { p: [0, -0.045 * hs, 0.035 * hs], s: [0.012 * hs, 0.035 * hs, 0.012 * hs], r: [-0.5, 0, 0] }); // thumb
    part(wr, new THREE.TorusGeometry(0.012 * hs, 0.004, 6, 24), `ring:${idx}`, { p: [side * -0.002, -0.115 * hs, 0.012], r: [Math.PI / 2, 0, 0], aura: 1.6 });
    part(wr, new THREE.SphereGeometry(0.032, 10, 8), `ring:${idx}`, { p: [0, -0.115 * hs, 0.02], hitOnly: true });
    marker(wr, [0, -0.115 * hs, 0.01], `ring:${idx}`);
    void hand;
    arms[side] = { sh, el, wr, hand: marker(wr, [0, -0.07 * hs, 0], "gloves:0") };
  }

  // legs
  const legs: Record<number, { hip: THREE.Group; knee: THREE.Group }> = {};
  marker(root, [0, 0.16, 0.04], "boots:0");
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * P.legX, -0.04, 0); hips.add(hip);
    const [tl, tt, tm, tb] = P.thigh;
    part(hip, limb(tl, tt, tm, tb), "pants:0", { aura: [1.1, 1.0, 1.1] });
    const knee = new THREE.Group(); knee.position.y = -tl; hip.add(knee);
    const [sl, st, sm, sb] = P.shin;
    part(knee, limb(sl, st, sm, sb), "boots:0", { aura: [1.14, 1.01, 1.14] });
    const ankle = new THREE.Group(); ankle.position.y = -sl; knee.add(ankle);
    part(ankle, ellipsoid(), "boots:0", { p: [0, -0.035, 0.045], s: [0.042, 0.034, 0.115], aura: 1.12 });
    legs[side] = { hip, knee };
  }

  // cape
  const capePivot = new THREE.Group(); capePivot.position.set(0, P.shY + 0.03, -0.075); spine.add(capePivot);
  const capeGeo = new THREE.CylinderGeometry(f ? 0.17 : 0.2, f ? 0.3 : 0.34, 1.0, 40, 24, true, Math.PI - 0.95, 1.9);
  capeGeo.translate(0, -0.5, 0.075);
  part(capePivot, capeGeo, "cape:0", { side: THREE.DoubleSide, aura: [1.04, 1, 1.04], strength: 0.7 });
  marker(capePivot, [0, -0.4, -0.15], "cape:0");

  // offhand guard on the left forearm
  const shield = new THREE.Shape();
  shield.moveTo(0, 0.13); shield.quadraticCurveTo(0.1, 0.12, 0.1, 0.02); shield.quadraticCurveTo(0.08, -0.1, 0, -0.16);
  shield.quadraticCurveTo(-0.08, -0.1, -0.1, 0.02); shield.quadraticCurveTo(-0.1, 0.12, 0, 0.13);
  const shieldGeo = new THREE.ExtrudeGeometry(shield, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
  shieldGeo.center();
  const guard = part(arms[1].el, shieldGeo, "offhand:0", { p: [0.065, -P.fore[0] * 0.5, 0.01], r: [0, Math.PI / 2, 0], aura: 1.08 });
  marker(guard, [0, 0, 0], "offhand:0");

  // ---- weapon ---------------------------------------------------------------
  const W = "weapon:0";
  const hold = weapon === "bow" ? 1 : -1; // hand that holds the main weapon
  let floating: THREE.Group | undefined; // orb / spellbook hover next to the hand
  const floatParts: THREE.Object3D[] = [];
  const wGroup = new THREE.Group();
  const blade = (len: number, width: number) => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(width * 0.42, -len * 0.85); s.lineTo(0, -len); s.lineTo(-width * 0.42, -len * 0.85); s.lineTo(-width / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    g.translate(0, 0, -0.003);
    return g;
  };
  const cyl = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 16);
  if (weapon === "orb") {
    floating = wGroup; root.add(wGroup);
    part(wGroup, new THREE.SphereGeometry(0.085, 48, 32), W, { aura: 1.25 });
    part(wGroup, new THREE.IcosahedronGeometry(0.035, 1), W, { strength: 2.2 });
    for (const [i, tilt] of [[0, 0.5], [1, -0.9]] as const) {
      const ring = part(wGroup, new THREE.TorusGeometry(0.125, 0.0035, 8, 96), W, { r: [Math.PI / 2 + tilt, 0, 0], aura: 1.3 });
      ring.userData.spin = i ? -1.2 : 0.8;
      floatParts.push(ring);
    }
    marker(wGroup, [0, 0, 0], W);
  } else if (weapon === "spellbook") {
    floating = wGroup; root.add(wGroup);
    const page = new THREE.BoxGeometry(0.15, 0.2, 0.012);
    part(wGroup, page, W, { p: [-0.072, 0, 0.012], r: [0, 0.35, 0] });
    part(wGroup, page, W, { p: [0.072, 0, 0.012], r: [0, -0.35, 0] });
    part(wGroup, new THREE.OctahedronGeometry(0.03), W, { p: [0, 0.0, 0.09], strength: 2 });
    marker(wGroup, [0, 0, 0], W);
  } else {
    const hand = arms[hold].wr;
    hand.add(wGroup);
    wGroup.position.set(0, -0.07, 0.01);
    const daggerish = weapon === "dagger";
    if (weapon === "sword" || weapon === "greatsword" || daggerish) {
      const L = weapon === "greatsword" ? 1.15 : daggerish ? 0.32 : 0.78;
      const Wd = weapon === "greatsword" ? 0.085 : daggerish ? 0.04 : 0.055;
      const sword = new THREE.Group(); sword.rotation.set(-0.3, 0, 0); wGroup.add(sword);
      part(sword, cyl(0.014, 0.15), W, { p: [0, 0.03, 0] });
      part(sword, new THREE.BoxGeometry(Wd * 2.6, 0.022, 0.035), W, { p: [0, -0.05, 0] });
      part(sword, blade(L, Wd), W, { p: [0, -0.06, 0], aura: [1.25, 1.02, 2] });
      part(sword, new THREE.BoxGeometry(Wd * 1.6, L, 0.09), W, { p: [0, -0.06 - L / 2, 0], hitOnly: true });
      marker(sword, [0, -0.06 - L * 0.45, 0], W);
      if (daggerish) {
        const off = new THREE.Group(); off.position.set(0, -0.07, 0.01); off.rotation.set(-0.3, 0, 0); arms[1].wr.add(off);
        part(off, cyl(0.012, 0.12), W, { p: [0, 0.02, 0] });
        part(off, blade(L, Wd), W, { p: [0, -0.05, 0], aura: [1.25, 1.02, 2] });
      }
    } else if (weapon === "staff" || weapon === "polearm") {
      const st = new THREE.Group(); st.rotation.set(-0.05, 0, 0.3); wGroup.add(st);
      part(st, cyl(0.016, 1.75), W, { p: [0, 0.32, 0], aura: [1.6, 1, 1.6] });
      if (weapon === "staff") {
        part(st, new THREE.TorusGeometry(0.07, 0.008, 8, 48), W, { p: [0, 1.25, 0], aura: 1.3 });
        part(st, new THREE.OctahedronGeometry(0.045), W, { p: [0, 1.25, 0], strength: 2 });
      } else {
        part(st, blade(0.32, 0.07), W, { p: [0, 1.5, 0], r: [0, 0, Math.PI] });
      }
      part(st, new THREE.BoxGeometry(0.12, 1.9, 0.12), W, { p: [0, 0.32, 0], hitOnly: true });
      marker(st, [0, 0.9, 0], W);
    } else if (weapon === "bow") {
      const bow = new THREE.Group(); bow.rotation.set(0, -Math.PI / 2, 0); wGroup.add(bow);
      const arc = new THREE.TorusGeometry(0.55, 0.012, 8, 64, 1.9);
      arc.rotateZ(-0.95); arc.translate(-0.55, 0, 0);
      part(bow, arc, W, { aura: [1, 1, 1.5] });
      part(bow, cyl(0.0025, 0.9), W, { p: [-0.23, 0, 0], strength: 0.8 });
      part(bow, new THREE.BoxGeometry(0.12, 1.0, 0.12), W, { p: [-0.05, 0, 0], hitOnly: true });
      marker(bow, [0, 0, 0], W);
    } else if (weapon === "mace") {
      const m = new THREE.Group(); m.rotation.set(-0.3, 0, 0); wGroup.add(m);
      part(m, cyl(0.015, 0.5), W, { p: [0, -0.18, 0] });
      part(m, new THREE.IcosahedronGeometry(0.075, 0), W, { p: [0, -0.46, 0], aura: 1.25 });
      marker(m, [0, -0.36, 0], W);
    }
  }

  // ---- platform + particles ------------------------------------------------
  const platMat = new THREE.MeshBasicMaterial({ color: 0x2f8dff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const platMatFaint = platMat.clone(); platMatFaint.opacity = 0.18;
  mats.push(platMat, platMatFaint);
  const plat = new THREE.Group(); root.add(plat);
  const rings: THREE.Mesh[] = [];
  for (const [r, wdt, m] of [[0.55, 0.008, platMat], [0.62, 0.003, platMatFaint], [0.8, 0.004, platMatFaint], [0.42, 0.002, platMatFaint]] as const) {
    const g = new THREE.RingGeometry(r, r + wdt, 128); geos.add(g);
    const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.002;
    plat.add(mesh); rings.push(mesh);
  }
  const ticks = new THREE.RingGeometry(0.66, 0.7, 64, 1, 0, Math.PI * 2); geos.add(ticks);
  const tickMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float a = atan(p.y, p.x); float t = step(0.6, fract(a * 9.549 * 2.0 + uTime * 0.2)); gl_FragColor = vec4(vec3(0.18, 0.55, 1.0) * t * 0.5, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  mats.push(tickMat);
  const tickMesh = new THREE.Mesh(ticks, tickMat); tickMesh.rotation.x = -Math.PI / 2; tickMesh.position.y = 0.003; plat.add(tickMesh);
  const glowGeo = new THREE.CircleGeometry(1.2, 64); geos.add(glowGeo);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - d), 2.5); gl_FragColor = vec4(vec3(0.06, 0.25, 0.75) * g * 0.35, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(glowMat);
  const glow = new THREE.Mesh(glowGeo, glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.001; plat.add(glow);

  const N = 220;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.15 + Math.random() * 0.75;
    pos.set([Math.cos(a) * r, Math.random() * 2.4, Math.sin(a) * r], i * 3);
    speed[i] = 0.05 + Math.random() * 0.18;
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geos.add(pGeo);
  const pMat = new THREE.ShaderMaterial({
    vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(18.0 / -mv.z, 1.0, 10.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(vec3(0.2, 0.55, 1.0) * a * 0.8, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(pMat);
  root.add(new THREE.Points(pGeo, pMat));

  // ---- state ----------------------------------------------------------------
  let focus: string | undefined, hover: string | undefined;
  let present = 0, presentTo = 0;
  const strengthTo: Record<string, number> = {};
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function refreshStrength() {
    for (const m of Object.values(holoMats)) {
      const id = m.userData.id as string;
      const base = (m.userData.base as number | undefined) ?? 1;
      strengthTo[m.uuid] = base * (!focus ? (hover === id ? 1.35 : 1) : focus === id ? 1.35 : 0.32);
    }
    for (const id of Object.keys(auras)) {
      auras[id].uniforms.uBoost.value = !focus ? (hover === id ? 1.6 : 1) : focus === id ? 1.7 : 0.3;
    }
  }
  refreshStrength();

  function update(t: number) {
    shared.uTime.value = t;
    if (shared.uReveal.value < 3) shared.uReveal.value = -0.1 + t * 1.0;
    const amp = reduce ? 0.3 : 1;
    present += (presentTo - present) * 0.06;
    const p = ease3(present);

    const b = Math.sin(t * 1.5) * amp, s = Math.sin(t * 0.55) * amp;
    hips.position.x = 0.012 * s;
    hips.rotation.z = 0.012 * s;
    spine.rotation.set(0.015 * b, 0, -0.016 * s);
    chest.scale.set(1 + 0.006 * b, 1 + 0.008 * b, 0.64 * (1 + 0.012 * b));
    head.rotation.y = 0.14 * Math.sin(t * 0.27) * amp * (1 - p) + hold * 0.4 * p;
    head.rotation.x = 0.03 * Math.sin(t * 0.4) * amp + 0.28 * p;
    for (const side of [-1, 1]) {
      const a = arms[side];
      const ph = side < 0 ? 0 : 0.6;
      const pres = side === hold ? p : 0;
      a.sh.rotation.z = side * (0.3 + 0.018 * Math.sin(t * 1.5 + ph) * amp) - side * 0.16 * pres;
      a.sh.rotation.x = 0.03 * Math.sin(t * 0.7 + ph) * amp - 0.45 * pres;
      a.el.rotation.x = -0.14 - 0.03 * b - 1.25 * pres;
      a.wr.rotation.x = 0.05 - 0.2 * pres;
      a.wr.rotation.y = side * 0.25 * pres;
      const l = legs[side];
      l.hip.rotation.z = side * 0.035 - 0.012 * s;
      l.knee.rotation.x = 0.04 + 0.01 * b;
    }
    capePivot.rotation.x = 0.07 + 0.025 * Math.sin(t * 1.1) * amp;
    root.updateMatrixWorld(true);

    if (floating) {
      arms[hold].hand.getWorldPosition(tmp);
      // idle: hover just in front of the hand; presenting: above the raised palm
      tmp2.set(hold * 0.02, -0.03, 0.15).lerp(new THREE.Vector3(0, 0.13, 0.06), p);
      tmp.add(tmp2);
      tmp.y += 0.018 * Math.sin(t * 2.1);
      if (floating.position.lengthSq() === 0) floating.position.copy(tmp);
      floating.position.lerp(tmp, 0.12);
      floating.rotation.y = t * 0.6;
      for (const fp of floatParts) fp.rotation.z = t * (fp.userData.spin as number);
      floating.updateMatrixWorld(true);
    }
    for (const r of rings) r.rotation.z = t * 0.05;
    tickMesh.rotation.z = -t * 0.08;
    const arr = pGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += speed[i] * 0.016;
      if (arr[i * 3 + 1] > 2.4) arr[i * 3 + 1] = 0;
    }
    pGeo.attributes.position.needsUpdate = true;

    for (const m of Object.values(holoMats)) {
      const u = m.uniforms.uStrength;
      u.value += ((strengthTo[m.uuid] ?? 1) - u.value) * 0.1;
    }
    for (const [id, st] of Object.entries(auraState)) {
      st.on += (st.to - st.on) * 0.06;
      auras[id].uniforms.uOn.value = st.on;
      auras[id].uniforms.uFill.value = st.fill;
    }
  }

  return {
    root, anchors, auras, hitTargets,
    focusPoint(id, point) {
      const list = markers[id] ?? [];
      let best = list[0], bestD = Infinity;
      for (const m of list) {
        const d = m.getWorldPosition(tmp).distanceToSquared(point);
        if (d < bestD) { bestD = d; best = m; }
      }
      return best;
    },
    setAura(id, hex, full) {
      const st = auraState[id];
      if (!st) return;
      if (hex !== null) auras[id].uniforms.uAura.value.setHex(hex);
      st.to = hex === null ? 0 : 1;
      st.fill = full ? 1 : 0;
    },
    setFocus(id) { focus = id; refreshStrength(); },
    setHover(id) { hover = id; refreshStrength(); },
    setPresent(on) { presentTo = on ? 1 : 0; },
    update,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

const ease3 = (k: number) => k * k * (3 - 2 * k);
