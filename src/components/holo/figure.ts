import * as THREE from "three";
import type { Grade } from "@/lib/types";
import { GRADE_HEX, GRADE_LEVEL, type Gender, type WeaponKind } from "@/lib/hologram";
import { bodyGeometry, bodySkeleton, buildBody, SKIN_SLOTS, type BoneName } from "./body";

/**
 * Hologram figure: one smooth skinned body (see body.ts) in a combat-ready idle,
 * plus gear pieces (weapon, offhand, cape, jewellery) attached to its bones.
 * Every equipment slot has a status aura whose colour AND strength follow the grade.
 */

const HOLO_BLUE = new THREE.Color(0x1f7bff);

// ---- shaders -------------------------------------------------------------------
const VARY = /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec3 vAura; varying float vLevel; varying float vFocus;`;

const SKIN_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
attribute float aSlot;
uniform vec3 uSlotColor[${SKIN_SLOTS.length}];
uniform float uSlotLevel[${SKIN_SLOTS.length}];
uniform float uSlotFocus[${SKIN_SLOTS.length}];
uniform float uInflate;
${VARY}
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  int s = int(aSlot + 0.5);
  vAura = uSlotColor[s]; vLevel = uSlotLevel[s]; vFocus = uSlotFocus[s];
  transformed += normalize(objectNormal) * uInflate * (0.003 + 0.015 * vLevel);
  vec4 w = modelMatrix * vec4(transformed, 1.0);
  vW = w.xyz;
  vN = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const GEAR_VERT = /* glsl */ `
uniform vec3 uAuraColor; uniform float uLevel; uniform float uFocus; uniform float uInflate;
${VARY}
void main() {
  vAura = uAuraColor; vLevel = uLevel; vFocus = uFocus;
  vec3 p = position + normal * uInflate * (0.003 + 0.012 * uLevel);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HOLO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uReveal; uniform float uStrength;
${VARY}
void main() {
  if (vW.y > uReveal) discard;
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.4);
  float k = vW.y * 88.0;
  float fw = max(fwidth(k), 1e-4);
  float line = (1.0 - min(abs(fract(k) - 0.5) / fw, 1.0)) * clamp(1.6 - 2.0 * fw, 0.0, 1.0);
  float scanY = fract(uTime * 0.14) * 2.6 - 0.2;
  float band = exp(-pow((vW.y - scanY) * 12.0, 2.0));
  float edge = smoothstep(0.08, 0.0, uReveal - vW.y);
  float flicker = 0.97 + 0.03 * sin(uTime * 29.0 + vW.y * 7.0);
  // the rim of a rated part takes on its status colour, the inside stays hologram blue
  vec3 rimCol = mix(uColor, vAura * (0.6 + 0.5 * vLevel), 0.85 * vLevel * vLevel);
  vec3 c = uColor * (0.1 + 0.32 * line + 0.18 * band) + rimCol * 1.05 * fres;
  c += vec3(0.55, 0.85, 1.0) * edge * 1.2;
  gl_FragColor = vec4(c * vFocus * uStrength * flicker, 1.0);
}`;

const AURA_FRAG = /* glsl */ `
uniform float uTime; uniform float uReveal;
${VARY}
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  if (vLevel < 0.01 || vW.y > uReveal - 0.04) discard;
  vec3 v = normalize(cameraPosition - vW);
  float ndv = abs(dot(normalize(vN), v));
  // stronger tiers: wider, brighter rim, faster energy flow, a soft fill; BiS adds sparkles
  float rim = pow(1.0 - ndv, mix(2.6, 1.2, vLevel));
  float speed = 0.5 + 3.2 * vLevel;
  float flow = 0.5 + 0.5 * sin(vW.y * 34.0 - uTime * speed * 2.5 + sin(vW.x * 18.0 + uTime * 0.7) * 1.3);
  float streak = smoothstep(0.8, 1.0, flow) * smoothstep(0.4, 0.62, vLevel);
  float breathe = 0.84 + 0.16 * sin(uTime * (1.1 + 1.6 * vLevel));
  float fill = smoothstep(0.92, 1.0, vLevel) * 0.15 + smoothstep(0.62, 0.75, vLevel) * 0.05;
  float strength = 0.5 + 1.4 * vLevel * vLevel;
  float spark = 0.0;
  if (vLevel > 0.95) spark = step(0.993, hash(floor(vW * 85.0) + floor(uTime * 5.0))) * 2.2;
  vec3 c = vAura * (rim * (0.65 + 0.7 * streak) + fill + streak * 0.3 * vLevel) * strength * breathe;
  c += vec3(1.0, 0.95, 0.8) * spark;
  gl_FragColor = vec4(c * vFocus, 1.0);
}`;

type V3 = [number, number, number];

export interface Figure {
  root: THREE.Group;
  anchors: Record<string, THREE.Object3D>;
  slotIds: string[];
  hitTargets: THREE.Object3D[];
  slotOf(hit: THREE.Intersection): string | undefined;
  focusPoint(id: string, point: THREE.Vector3): THREE.Object3D | undefined;
  setGrade(id: string, grade: Grade | undefined): void;
  setFocus(id: string | undefined): void;
  setHover(id: string | undefined): void;
  setPresent(on: boolean): void;
  update(t: number): void;
  dispose(): void;
}

type Pose = Partial<Record<BoneName, V3>>;

/** Ready stance per weapon family (Euler XYZ per bone, relative to MakeHuman's A-pose). */
function combatPose(weapon: WeaponKind): Pose {
  const base: Pose = {
    "thigh.L": [-0.14, 0, 0.0], "shin.L": [0.2, 0, 0], "foot.L": [-0.06, 0, 0],
    "thigh.R": [0.07, 0, -0.01], "shin.R": [0.15, 0, 0], "foot.R": [-0.21, 0, 0],
    hips: [0, -0.14, 0], spine: [0.03, 0.05, 0], chest: [0.02, 0.04, 0], neck: [0, 0.02, 0], head: [-0.02, 0.07, 0],
  };
  if (weapon === "orb" || weapon === "spellbook") {
    return {
      ...base,
      "upperArm.R": [-0.32, 0, 0.18], "foreArm.R": [-0.85, 0.2, 0], "hand.R": [-0.3, 0, 0],
      "upperArm.L": [-0.08, 0, -0.14], "foreArm.L": [-0.35, 0, 0], "hand.L": [0.1, 0, 0],
    };
  }
  if (weapon === "bow") {
    return {
      ...base,
      "upperArm.L": [-0.7, 0, -0.1], "foreArm.L": [-0.2, 0, 0],
      "upperArm.R": [-0.15, 0, 0.15], "foreArm.R": [-0.4, 0, 0],
    };
  }
  if (weapon === "staff" || weapon === "polearm") {
    return {
      ...base,
      "upperArm.R": [-0.2, 0, 0.25], "foreArm.R": [-0.7, 0, 0],
      "upperArm.L": [-0.08, 0, -0.14], "foreArm.L": [-0.35, 0, 0],
    };
  }
  // swords, mace, daggers
  return {
    ...base,
    "upperArm.R": [-0.25, 0, 0.2], "foreArm.R": [-0.75, 0, 0], "hand.R": [0.3, 0, 0],
    "upperArm.L": [-0.25, 0, -0.15], "foreArm.L": [-0.9, 0, 0],
  };
}
/** Pose while the camera looks at the weapon: lift it towards the face. */
function presentPose(weapon: WeaponKind): Pose {
  if (weapon === "bow") return { "upperArm.L": [-1.1, 0, -0.05], "foreArm.L": [-0.3, 0, 0], head: [0, 0.35, 0] };
  return { "upperArm.R": [-0.75, 0.1, 0.3], "foreArm.R": [-1.35, 0.2, 0], "hand.R": [-0.35, 0, 0], head: [0.12, -0.2, 0] };
}

const ease3 = (k: number) => k * k * (3 - 2 * k);

export function buildFigure(gender: Gender, weapon: WeaponKind, reduce: boolean): Figure {
  const root = new THREE.Group();
  const geos = new Set<THREE.BufferGeometry>();
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const shared = { uTime: { value: 0 }, uReveal: { value: reduce ? 3 : -0.1 } };

  // ---- body -----------------------------------------------------------------
  const data = buildBody(gender);
  const { map: bones, list: boneList, skeleton } = bodySkeleton(data);
  root.add(bones.hips);
  root.updateMatrixWorld(true);
  skeleton.calculateInverses();
  const bodyGeo = bodyGeometry(data);
  geos.add(bodyGeo);
  const n = SKIN_SLOTS.length;
  const slotUniforms = {
    uSlotColor: { value: Array.from({ length: n }, () => new THREE.Color(0x000000)) },
    uSlotLevel: { value: new Array<number>(n).fill(0) },
    uSlotFocus: { value: new Array<number>(n).fill(1) },
  };
  const skinMat = (frag: string, inflate: number) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...slotUniforms, uColor: { value: HOLO_BLUE }, uStrength: { value: 1 }, uInflate: { value: inflate } },
      vertexShader: SKIN_VERT, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    mats.push(m);
    return m;
  };
  const prepass = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const prepassDouble = prepass.clone(); prepassDouble.side = THREE.DoubleSide;
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  mats.push(prepass, prepassDouble, hiddenMat);

  const skinned = (mat: THREE.Material, order: number) => {
    const m = new THREE.SkinnedMesh(bodyGeo, mat);
    m.bind(skeleton);
    m.frustumCulled = false;
    m.renderOrder = order;
    root.add(m);
    return m;
  };
  skinned(prepass, 1);
  const bodyMesh = skinned(skinMat(HOLO_FRAG, 0), 2);
  skinned(skinMat(AURA_FRAG, 1), 3);
  bodyMesh.userData.skin = true;

  // ---- gear parts (non-skinned, attached to bones) -----------------------------
  const gearHolo: Record<string, THREE.ShaderMaterial> = {};
  const gearAura: Record<string, THREE.ShaderMaterial> = {};
  const gearUniforms = (id: string) => ({
    uAuraColor: { value: new THREE.Color(0) }, uLevel: { value: 0 }, uFocus: { value: 1 }, _id: id,
  });
  const gearU: Record<string, ReturnType<typeof gearUniforms>> = {};
  function gearMats(id: string, side: THREE.Side, strength: number) {
    gearU[id] ??= gearUniforms(id);
    const u = gearU[id];
    const key = `${id}|${side}|${strength}`;
    if (!gearHolo[key]) {
      gearHolo[key] = new THREE.ShaderMaterial({
        uniforms: { ...shared, uAuraColor: u.uAuraColor, uLevel: u.uLevel, uFocus: u.uFocus, uColor: { value: HOLO_BLUE }, uStrength: { value: strength }, uInflate: { value: 0 } },
        vertexShader: GEAR_VERT, fragmentShader: HOLO_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
      });
      mats.push(gearHolo[key]);
    }
    if (!gearAura[id]) {
      gearAura[id] = new THREE.ShaderMaterial({
        uniforms: { ...shared, uAuraColor: u.uAuraColor, uLevel: u.uLevel, uFocus: u.uFocus, uInflate: { value: 1 } },
        vertexShader: GEAR_VERT, fragmentShader: AURA_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      mats.push(gearAura[id]);
    }
    return { holo: gearHolo[key], aura: gearAura[id] };
  }

  const hitTargets: THREE.Object3D[] = [bodyMesh];
  interface PartOpts { p?: V3; r?: V3; s?: V3; q?: THREE.Quaternion; side?: THREE.Side; strength?: number; hitOnly?: boolean; noAura?: boolean }
  function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, id: string, o: PartOpts = {}) {
    geos.add(geo);
    const g = new THREE.Group();
    if (o.p) g.position.set(...o.p);
    if (o.q) g.quaternion.copy(o.q);
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
    const m = gearMats(id, o.side ?? THREE.FrontSide, o.strength ?? 1);
    const pre = new THREE.Mesh(geo, o.side === THREE.DoubleSide ? prepassDouble : prepass); pre.renderOrder = 1;
    const holo = new THREE.Mesh(geo, m.holo); holo.renderOrder = 2;
    holo.userData.slot = id;
    hitTargets.push(holo);
    g.add(pre, holo);
    if (!o.noAura) { const a = new THREE.Mesh(geo, m.aura); a.renderOrder = 3; g.add(a); }
    return g;
  }

  const anchors: Record<string, THREE.Object3D> = {};
  const markers: Record<string, THREE.Object3D[]> = {};
  const marker = (parent: THREE.Object3D, p: V3, id?: string) => {
    const m = new THREE.Object3D();
    m.position.set(...p);
    parent.add(m);
    if (id) {
      if (!anchors[id]) anchors[id] = m;
      (markers[id] ??= []).push(m);
    }
    return m;
  };

  const J = data.joint;
  const rel = (bone: BoneName, world: V3): V3 => {
    const b = data.bones.find((x) => x.name === bone)!.pos;
    return [world[0] - b[0], world[1] - b[1], world[2] - b[2]];
  };
  const f = gender === "f";
  const hs = f ? 0.93 : 1;
  const up = new THREE.Vector3(0, 0, 1);

  // body markers for the camera
  marker(bones.head, [0, 0.07 * hs, 0.0], "helmet:0");
  marker(bones.chest, [0, 0.08, 0.04], "torso:0");
  marker(bones.chest, [0, 0.17, 0], "shoulders:0");
  marker(bones.hips, [0, -0.25, 0.03], "pants:0");
  marker(bones["shin.L"], [0, -0.33, 0.02], "boots:0");
  marker(bones["shin.R"], [0, -0.33, 0.02], "boots:0");
  marker(bones.neck, [0, 0.0, 0.05], "necklace:0");

  const hands: Record<"L" | "R", THREE.Object3D> = { L: bones["hand.L"], R: bones["hand.R"] };
  const palm: Record<"L" | "R", THREE.Object3D> = { L: bones["hand.L"], R: bones["hand.R"] };
  for (const side of ["R", "L"] as const) {
    const d = new THREE.Vector3(...data.armDir[side]);
    const idx = side === "R" ? 0 : 1;
    const qArm = new THREE.Quaternion().setFromUnitVectors(up, d);
    palm[side] = marker(hands[side], d.clone().multiplyScalar(0.075).toArray() as V3, "gloves:0");
    // bracelet near the wrist
    const W = J[`wrist.${side}`], E = J[`elbow.${side}`];
    const wristOff = rel(`foreArm.${side}`, [E[0] + (W[0] - E[0]) * 0.86, E[1] + (W[1] - E[1]) * 0.86, E[2] + (W[2] - E[2]) * 0.86]);
    const br = part(bones[`foreArm.${side}`], new THREE.TorusGeometry(f ? 0.03 : 0.035, 0.006, 8, 40), `bracelet:${idx}`, { p: wristOff, q: qArm });
    part(br, new THREE.SphereGeometry(0.055, 10, 8), `bracelet:${idx}`, { hitOnly: true });
    marker(br, [0, 0, 0], `bracelet:${idx}`);
    // ring
    const rg = part(hands[side], new THREE.TorusGeometry(0.013, 0.004, 6, 24), `ring:${idx}`, { p: d.clone().multiplyScalar(0.115).add(new THREE.Vector3(0, 0, 0.018)).toArray() as V3, q: qArm });
    part(rg, new THREE.SphereGeometry(0.03, 10, 8), `ring:${idx}`, { p: [0, 0, 0.012], hitOnly: true });
    marker(rg, [0, 0, 0], `ring:${idx}`);
    // earring
    const sx = side === "L" ? 1 : -1;
    const er = part(bones.head, new THREE.SphereGeometry(0.01, 16, 12), `earring:${idx}`, { p: [sx * 0.071 * hs, 0.03, -0.015] });
    part(er, new THREE.SphereGeometry(0.034, 10, 8), `earring:${idx}`, { hitOnly: true });
    marker(er, [0, 0, 0], `earring:${idx}`);
  }
  // necklace
  part(bones.neck, new THREE.TorusGeometry(f ? 0.058 : 0.066, 0.005, 8, 56), "necklace:0", { p: [0, 0.0, 0.012], r: [Math.PI / 2 - 0.45, 0, 0] });
  part(bones.neck, new THREE.OctahedronGeometry(0.014), "necklace:0", { p: [0, -0.04, f ? 0.07 : 0.08] });
  // belt
  part(bones.hips, new THREE.TorusGeometry(f ? 0.128 : 0.145, 0.011, 10, 64), "belt:0", { p: rel("hips", [0, J.spine[1] - 0.055, -0.005]), r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
  marker(bones.hips, rel("hips", [0, J.spine[1] - 0.055, 0.1]), "belt:0");
  // cape
  const capePivot = new THREE.Group();
  capePivot.position.set(...rel("chest", [0, J["shoulder.L"][1] + 0.02, -0.075]));
  bones.chest.add(capePivot);
  const capeGeo = new THREE.CylinderGeometry(f ? 0.17 : 0.2, f ? 0.3 : 0.34, 1.0, 40, 24, true, Math.PI - 0.95, 1.9);
  capeGeo.translate(0, -0.5, 0.075);
  part(capePivot, capeGeo, "cape:0", { side: THREE.DoubleSide, strength: 0.45 });
  marker(capePivot, [0, -0.4, -0.15], "cape:0");
  // offhand guard on the left forearm
  const shield = new THREE.Shape();
  shield.moveTo(0, 0.13); shield.quadraticCurveTo(0.1, 0.12, 0.1, 0.02); shield.quadraticCurveTo(0.08, -0.1, 0, -0.16);
  shield.quadraticCurveTo(-0.08, -0.1, -0.1, 0.02); shield.quadraticCurveTo(-0.1, 0.12, 0, 0.13);
  const shieldGeo = new THREE.ExtrudeGeometry(shield, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16 });
  shieldGeo.center();
  if (weapon === "sword" || weapon === "mace") {
    // only shield classes carry the offhand visibly; for everyone else it stays in the gear list
    const E = J["elbow.L"], W = J["wrist.L"];
    const mid = rel("foreArm.L", [(E[0] + W[0]) / 2 + 0.05, (E[1] + W[1]) / 2, (E[2] + W[2]) / 2]);
    const guard = part(bones["foreArm.L"], shieldGeo, "offhand:0", { p: mid, r: [0, Math.PI / 2, -0.75] });
    marker(guard, [0, 0, 0], "offhand:0");
  } else {
    geos.add(shieldGeo);
    gearMats("offhand:0", THREE.FrontSide, 1);
    marker(palm.L, [0, 0, 0], "offhand:0");
  }

  // ---- weapon -----------------------------------------------------------------
  const WID = "weapon:0";
  const holdSide: "L" | "R" = weapon === "bow" ? "L" : "R";
  let floating: THREE.Group | undefined;
  const spinners: THREE.Object3D[] = [];
  const wGroup = new THREE.Group();
  const blade = (len: number, width: number) => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(width * 0.42, -len * 0.85); s.lineTo(0, -len); s.lineTo(-width * 0.42, -len * 0.85); s.lineTo(-width / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    g.translate(0, 0, -0.003);
    return g;
  };
  const cyl = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 16);
  let weaponCore: THREE.Mesh | undefined;
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.push(coreMat);
  if (weapon === "orb") {
    floating = wGroup; root.add(wGroup);
    part(wGroup, new THREE.SphereGeometry(0.085, 48, 32), WID);
    const cg = new THREE.IcosahedronGeometry(0.036, 2); geos.add(cg);
    weaponCore = new THREE.Mesh(cg, coreMat); weaponCore.renderOrder = 4; wGroup.add(weaponCore);
    for (const [i, tilt] of [[0, 0.5], [1, -0.9]] as const) {
      const ring = part(wGroup, new THREE.TorusGeometry(0.125, 0.0035, 8, 96), WID, { r: [Math.PI / 2 + tilt, 0, 0] });
      ring.userData.spin = i ? -1.2 : 0.8;
      spinners.push(ring);
    }
    marker(wGroup, [0, 0, 0], WID);
  } else if (weapon === "spellbook") {
    floating = wGroup; root.add(wGroup);
    const page = new THREE.BoxGeometry(0.15, 0.2, 0.012);
    part(wGroup, page, WID, { p: [-0.072, 0, 0.012], r: [0, 0.35, 0] });
    part(wGroup, page, WID, { p: [0.072, 0, 0.012], r: [0, -0.35, 0] });
    const cg = new THREE.OctahedronGeometry(0.03); geos.add(cg);
    weaponCore = new THREE.Mesh(cg, coreMat); weaponCore.position.z = 0.09; wGroup.add(weaponCore);
    marker(wGroup, [0, 0, 0], WID);
  } else {
    hands[holdSide].add(wGroup);
    const d = new THREE.Vector3(...data.armDir[holdSide]);
    wGroup.position.copy(d.clone().multiplyScalar(0.075));
    wGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
    const daggerish = weapon === "dagger";
    if (weapon === "sword" || weapon === "greatsword" || daggerish) {
      const L = weapon === "greatsword" ? 1.15 : daggerish ? 0.32 : 0.8;
      const Wd = weapon === "greatsword" ? 0.085 : daggerish ? 0.04 : 0.055;
      const sword = new THREE.Group(); sword.rotation.set(-Math.PI / 2, 0, 0); wGroup.add(sword);
      part(sword, cyl(0.014, 0.15), WID, { p: [0, 0.03, 0] });
      part(sword, new THREE.BoxGeometry(Wd * 2.6, 0.022, 0.035), WID, { p: [0, -0.05, 0] });
      part(sword, blade(L, Wd), WID, { p: [0, -0.06, 0] });
      part(sword, new THREE.BoxGeometry(Wd * 1.6, L, 0.09), WID, { p: [0, -0.06 - L / 2, 0], hitOnly: true });
      marker(sword, [0, -0.06 - L * 0.45, 0], WID);
      if (daggerish) {
        const off = new THREE.Group();
        const dl = new THREE.Vector3(...data.armDir.L);
        off.position.copy(dl.clone().multiplyScalar(0.075));
        off.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dl);
        hands.L.add(off);
        const s2 = new THREE.Group(); s2.rotation.set(-Math.PI / 2, 0, 0); off.add(s2);
        part(s2, cyl(0.012, 0.12), WID, { p: [0, 0.02, 0] });
        part(s2, blade(L, Wd), WID, { p: [0, -0.05, 0] });
      }
    } else if (weapon === "staff" || weapon === "polearm") {
      const st = new THREE.Group(); st.rotation.set(-Math.PI / 2, 0, 0); wGroup.add(st);
      part(st, cyl(0.016, 1.75), WID, { p: [0, -0.3, 0] });
      if (weapon === "staff") {
        part(st, new THREE.TorusGeometry(0.07, 0.008, 8, 48), WID, { p: [0, -1.2, 0] });
        const cg = new THREE.OctahedronGeometry(0.045); geos.add(cg);
        weaponCore = new THREE.Mesh(cg, coreMat); weaponCore.position.y = -1.2; st.add(weaponCore);
      } else {
        part(st, blade(0.32, 0.07), WID, { p: [0, -1.15, 0] });
      }
      part(st, new THREE.BoxGeometry(0.12, 1.9, 0.12), WID, { p: [0, -0.3, 0], hitOnly: true });
      marker(st, [0, -0.85, 0], WID);
    } else if (weapon === "bow") {
      const bow = new THREE.Group(); bow.rotation.set(-Math.PI / 2, 0, Math.PI / 2); wGroup.add(bow);
      const arc = new THREE.TorusGeometry(0.55, 0.012, 8, 64, 1.9);
      arc.rotateZ(-0.95); arc.translate(-0.55, 0, 0);
      part(bow, arc, WID);
      part(bow, cyl(0.0025, 0.9), WID, { p: [-0.23, 0, 0], strength: 0.8, noAura: true });
      part(bow, new THREE.BoxGeometry(0.12, 1.0, 0.12), WID, { p: [-0.05, 0, 0], hitOnly: true });
      marker(bow, [0, 0, 0], WID);
    } else if (weapon === "mace") {
      const m = new THREE.Group(); m.rotation.set(-Math.PI / 2, 0, 0); wGroup.add(m);
      part(m, cyl(0.015, 0.5), WID, { p: [0, -0.18, 0] });
      part(m, new THREE.IcosahedronGeometry(0.075, 0), WID, { p: [0, -0.46, 0] });
      marker(m, [0, -0.36, 0], WID);
    }
  }

  // weapon status: halo + sparks in the grade colour, amount by grade level
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 128;
  {
    const c = haloCanvas.getContext("2d")!;
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.25, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas); textures.push(haloTex);
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  mats.push(haloMat);
  const halo = new THREE.Sprite(haloMat);
  halo.renderOrder = 0;
  root.add(halo);
  const SPARKS = 64;
  const sparkPos = new Float32Array(SPARKS * 3), sparkSeed = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) sparkSeed[i] = Math.random();
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  geos.add(sparkGeo);
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0) } },
    vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(14.0 / -mv.z, 1.5, 9.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(uColor * a * 1.6, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(sparkMat);
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  root.add(sparks);
  const weaponColor = new THREE.Color(0);

  // ---- platform + particles ---------------------------------------------------
  const platMat = new THREE.MeshBasicMaterial({ color: 0x2f8dff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const platMatFaint = platMat.clone(); platMatFaint.opacity = 0.16;
  mats.push(platMat, platMatFaint);
  const plat = new THREE.Group(); root.add(plat);
  const rings: THREE.Mesh[] = [];
  for (const [r, wdt, m] of [[0.6, 0.007, platMat], [0.68, 0.003, platMatFaint], [0.88, 0.004, platMatFaint], [0.46, 0.002, platMatFaint]] as const) {
    const g = new THREE.RingGeometry(r, r + wdt, 128); geos.add(g);
    const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.002;
    plat.add(mesh); rings.push(mesh);
  }
  const ticks = new THREE.RingGeometry(0.72, 0.76, 64); geos.add(ticks);
  const flatVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const tickMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime },
    vertexShader: flatVert,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float a = atan(p.y, p.x); float t = step(0.6, fract(a * 19.1 + uTime * 0.2)); gl_FragColor = vec4(vec3(0.18, 0.55, 1.0) * t * 0.45, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  mats.push(tickMat);
  const tickMesh = new THREE.Mesh(ticks, tickMat); tickMesh.rotation.x = -Math.PI / 2; tickMesh.position.y = 0.003; plat.add(tickMesh);
  const glowGeo = new THREE.CircleGeometry(1.3, 64); geos.add(glowGeo);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: flatVert,
    fragmentShader: `varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - d), 2.5); gl_FragColor = vec4(vec3(0.06, 0.25, 0.75) * g * 0.35, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(glowMat);
  const glow = new THREE.Mesh(glowGeo, glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.001; plat.add(glow);

  const N = 180;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.8;
    pos.set([Math.cos(a) * r, Math.random() * 2.4, Math.sin(a) * r], i * 3);
    speed[i] = 0.04 + Math.random() * 0.14;
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geos.add(pGeo);
  const pMat = new THREE.ShaderMaterial({
    vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(16.0 / -mv.z, 1.0, 8.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.0); gl_FragColor = vec4(vec3(0.2, 0.55, 1.0) * a * 0.6, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mats.push(pMat);
  const dust = new THREE.Points(pGeo, pMat); dust.frustumCulled = false; root.add(dust);

  // ---- state ------------------------------------------------------------------
  const slotIds = [...new Set([...SKIN_SLOTS, ...Object.keys(gearU)])];
  const grades: Record<string, Grade | undefined> = {};
  let focus: string | undefined, hover: string | undefined;
  let present = 0, presentTo = 0;
  const focusTo: Record<string, number> = {};
  const focusCur: Record<string, number> = {};
  const levelTo: Record<string, number> = {};
  const levelCur: Record<string, number> = {};

  function refreshFocus() {
    for (const id of slotIds) focusTo[id] = !focus ? (hover === id ? 1.45 : 1) : focus === id ? 1.5 : 0.3;
  }
  refreshFocus();

  const combat = combatPose(weapon), pres = presentPose(weapon);
  const bind: Record<string, THREE.Vector3> = {};
  for (const b of boneList) bind[b.name] = b.position.clone();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const rot = (name: BoneName, x: number, y: number, z: number) => {
    const c = combat[name] ?? [0, 0, 0], p = pres[name] ?? c;
    const k = ease3(present);
    bones[name].rotation.set(c[0] + (p[0] - c[0]) * k + x, c[1] + (p[1] - c[1]) * k + y, c[2] + (p[2] - c[2]) * k + z);
  };

  function update(t: number) {
    shared.uTime.value = t;
    if (shared.uReveal.value < 3) shared.uReveal.value = -0.1 + t * 1.0;
    const amp = reduce ? 0.3 : 1;
    present += (presentTo - present) * 0.06;

    // idle: breathing, weight shift between the legs, small guard adjustments, alert head
    const br = Math.sin(t * 1.35) * amp;                 // breath
    const ws = Math.sin(t * 0.62) * amp;                 // weight shift
    const bob = (0.5 - 0.5 * Math.cos(t * 1.24)) * amp;  // knee bounce
    const mic = Math.sin(t * 2.3 + 0.7) * amp;           // micro motion
    const look = Math.sin(t * 0.31) * amp;

    bones.hips.position.set(bind.hips.x + 0.016 * ws, bind.hips.y - 0.018 - 0.005 * bob, bind.hips.z + 0.01);
    rot("hips", 0, 0.03 * ws, 0.016 * ws);
    rot("spine", 0.01 * br, 0, -0.01 * ws);
    rot("chest", 0.024 * br, 0.02 * look, -0.008 * ws);
    rot("neck", -0.01 * br, 0.04 * look, 0);
    rot("head", 0.02 * Math.sin(t * 0.47) * amp, 0.1 * look * (1 - present), 0.01 * ws);
    rot("thigh.L", -0.02 * bob, 0, -0.012 * ws);
    rot("shin.L", 0.045 * bob + 0.02 * ws, 0, 0);
    rot("foot.L", -0.025 * bob - 0.02 * ws, 0, 0);
    rot("thigh.R", -0.02 * bob, 0, -0.012 * ws);
    rot("shin.R", 0.04 * bob - 0.02 * ws, 0, 0);
    rot("foot.R", -0.02 * bob + 0.02 * ws, 0, 0);
    rot("upperArm.R", -0.03 * br, 0.02 * mic, 0.02 * br);
    rot("foreArm.R", -0.04 * Math.sin(t * 1.35 + 0.8) * amp, 0, 0);
    rot("hand.R", 0.04 * mic, 0, 0.03 * Math.sin(t * 1.7) * amp);
    rot("upperArm.L", -0.03 * br, -0.02 * mic, -0.02 * br);
    rot("foreArm.L", -0.05 * Math.sin(t * 1.35 + 1.4) * amp, 0, 0);
    rot("hand.L", -0.04 * mic, 0, -0.03 * Math.sin(t * 1.9) * amp);
    capePivot.rotation.set(0.12 + 0.03 * Math.sin(t * 1.1) * amp + 0.02 * ws, 0, 0.02 * ws);
    root.updateMatrixWorld(true);

    if (floating) {
      palm[holdSide].getWorldPosition(tmp);
      tmp2.set(0.0, 0.1, 0.07).lerp(new THREE.Vector3(0, 0.14, 0.04), ease3(present));
      tmp.add(tmp2);
      tmp.y += 0.016 * Math.sin(t * 2.1);
      if (floating.position.lengthSq() === 0) floating.position.copy(tmp);
      floating.position.lerp(tmp, 0.14);
      floating.rotation.y = t * 0.6;
      floating.updateMatrixWorld(true);
    }
    for (const s of spinners) s.rotation.z = t * (s.userData.spin as number);
    for (const r of rings) r.rotation.z = t * 0.05;
    tickMesh.rotation.z = -t * 0.08;
    const arr = pGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += speed[i] * 0.016;
      if (arr[i * 3 + 1] > 2.4) arr[i * 3 + 1] = 0;
    }
    pGeo.attributes.position.needsUpdate = true;

    // status transitions
    for (const id of slotIds) {
      focusCur[id] = (focusCur[id] ?? 1) + ((focusTo[id] ?? 1) - (focusCur[id] ?? 1)) * 0.1;
      levelCur[id] = (levelCur[id] ?? 0) + ((levelTo[id] ?? 0) - (levelCur[id] ?? 0)) * 0.06;
      const si = (SKIN_SLOTS as readonly string[]).indexOf(id);
      if (si >= 0) {
        slotUniforms.uSlotFocus.value[si] = focusCur[id];
        slotUniforms.uSlotLevel.value[si] = levelCur[id];
      }
      if (gearU[id]) { gearU[id].uFocus.value = focusCur[id]; gearU[id].uLevel.value = levelCur[id]; }
    }

    // weapon status effects
    const wl = levelCur[WID] ?? 0, wf = focusCur[WID] ?? 1;
    const anchor = anchors[WID];
    if (anchor) {
      anchor.getWorldPosition(tmp);
      halo.position.copy(tmp);
      const pulse = 0.85 + 0.15 * Math.sin(t * (1.5 + 2 * wl));
      halo.scale.setScalar((0.16 + 0.42 * wl * wl) * pulse);
      haloMat.color.copy(weaponColor).multiplyScalar(wl * wl * wl * 0.9 * Math.min(wf, 1.2));
      const shown = Math.round(SPARKS * Math.max(0, wl - 0.3) / 0.7);
      sparkGeo.setDrawRange(0, shown);
      for (let i = 0; i < shown; i++) {
        const s = sparkSeed[i];
        const life = (t * (0.35 + 0.5 * wl) + s * 7.3) % 1;
        const a = s * 40 + t * (0.6 + s);
        const r = 0.07 + 0.12 * life * (0.6 + s);
        sparkPos.set([tmp.x + Math.cos(a) * r, tmp.y - 0.05 + life * (0.25 + 0.2 * wl), tmp.z + Math.sin(a) * r], i * 3);
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.uniforms.uColor.value.copy(weaponColor).multiplyScalar(wf);
      if (wl > 0.001) coreMat.color.copy(weaponColor).multiplyScalar(0.25 + 1.4 * wl);
      else coreMat.color.setHex(0x2a6fd6);
    }
  }

  function setGrade(id: string, grade: Grade | undefined) {
    grades[id] = grade;
    const hex = grade ? GRADE_HEX[grade] : null;
    const lvl = grade ? GRADE_LEVEL[grade] : 0;
    levelTo[id] = hex === null ? 0 : lvl;
    if (hex === null) return;
    const si = (SKIN_SLOTS as readonly string[]).indexOf(id);
    if (si >= 0) slotUniforms.uSlotColor.value[si].setHex(hex);
    if (gearU[id]) gearU[id].uAuraColor.value.setHex(hex);
    if (id === WID) weaponColor.setHex(hex);
  }

  return {
    root, anchors, slotIds, hitTargets,
    slotOf(hit) {
      if (hit.object.userData.slot) return hit.object.userData.slot as string;
      if (hit.object.userData.skin && hit.face) {
        const s = bodyGeo.getAttribute("aSlot").getX(hit.face.a);
        return SKIN_SLOTS[Math.round(s)];
      }
      return undefined;
    },
    focusPoint(id, point) {
      const list = markers[id] ?? [];
      let best = list[0], bestD = Infinity;
      for (const m of list) {
        const d = m.getWorldPosition(tmp).distanceToSquared(point);
        if (d < bestD) { bestD = d; best = m; }
      }
      return best;
    },
    setGrade,
    setFocus(id) { focus = id; refreshFocus(); },
    setHover(id) { hover = id; refreshFocus(); },
    setPresent(on) { presentTo = on ? 1 : 0; },
    update,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      skeleton.dispose();
    },
  };
}
