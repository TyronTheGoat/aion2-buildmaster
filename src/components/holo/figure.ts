import * as THREE from "three";
import type { Grade } from "@/lib/types";
import { GRADE_HEX, GRADE_LEVEL, type Gender, type WeaponKind } from "@/lib/hologram";
import { bodyGeometry, bodySkeleton, buildBody, SKIN_SLOTS, type BoneName } from "./body";
import type { ModelBody } from "./model-body";
import { holdOffset, holdQuaternion, LOADOUTS, type Hold, type LoadedLoadout, type WeaponModel } from "./weapons";
import { INTROS, sample, samplePose, sampleRot, type Effect, type Key } from "./intro";

/**
 * Hologram figure: the supplied Bildmaster character model (model-body.ts), shown unchanged with its
 * own texture, breathing and floating gently. Without the model files it falls back to the built-in
 * MakeHuman body (body.ts), which is skinned and stands in a combat-ready idle.
 * Gear pieces (weapon, offhand, cape, jewellery) are attached to the (invisible) bones.
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

const MODEL_VERT = /* glsl */ `
attribute float aSlot;
uniform vec3 uSlotColor[${SKIN_SLOTS.length}];
uniform float uSlotLevel[${SKIN_SLOTS.length}];
uniform float uSlotFocus[${SKIN_SLOTS.length}];
uniform float uInflate; uniform float uBreath; uniform vec3 uChest;
attribute vec2 uvRef;
varying vec2 vUv; varying vec2 vUvRef; varying float vFront;
${VARY}
void main() {
  int s = int(aSlot + 0.5);
  vAura = uSlotColor[s]; vLevel = uSlotLevel[s]; vFocus = uSlotFocus[s];
  vUv = uv; vUvRef = uvRef; vFront = normal.z;
  vec3 p = position;
  // breathing: the rib cage widens by a few millimetres, nothing else of the model moves
  float chestW = smoothstep(uChest.x, uChest.x + 0.12, p.y) * (1.0 - smoothstep(uChest.y - 0.08, uChest.y, p.y))
    * (1.0 - smoothstep(0.13, 0.2, abs(p.x - uChest.z)));
  p += normal * chestW * 0.0045 * uBreath;
  p += normal * uInflate * (0.003 + 0.015 * vLevel);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const MODEL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uTime; uniform float uReveal; uniform sampler2D uMap; uniform float uTexGain;
uniform sampler2D uRef; uniform float uRefOn; uniform float uNatural;
varying vec2 vUv; varying vec2 vUvRef; varying float vFront;
${VARY}
void main() {
  if (vW.y > uReveal) discard;
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.6);
  vec3 tex = texture2D(uMap, vUv).rgb;
  if (uNatural > 0.5) {
    // natural colours → hologram: keep the light and shade (face, armour seams, cloth folds), drop the hue
    float l = dot(tex, vec3(0.299, 0.587, 0.114));
    // the bodysuit is mostly light grey: stretch the upper range so seams, folds and the face read as detail
    l = smoothstep(0.35, 0.97, l);
    float k = vW.y * 88.0;
    float fw = max(fwidth(k), 1e-4);
    float line = (1.0 - min(abs(fract(k) - 0.5) / fw, 1.0)) * clamp(1.6 - 2.0 * fw, 0.0, 1.0);
    tex = mix(vec3(0.03, 0.1, 0.2), vec3(0.3, 0.68, 0.95), l) * (0.8 + 0.3 * line);
  }
  if (uRefOn > 0.5) {
    // detailed reference on the front; the back (a front projection would show the face there) gets a clean scan
    vec4 ref = texture2D(uRef, vUvRef);
    vec3 front = mix(tex, ref.rgb * 0.8, ref.a);
    float k = vW.y * 88.0;
    float fw = max(fwidth(k), 1e-4);
    float line = (1.0 - min(abs(fract(k) - 0.5) / fw, 1.0)) * clamp(1.6 - 2.0 * fw, 0.0, 1.0);
    vec3 plain = uColor * (0.09 + 0.2 * line);
    tex = mix(plain, front, smoothstep(-0.35, 0.2, vFront));
  }
  float scanY = fract(uTime * 0.14) * 2.6 - 0.2;
  float band = exp(-pow((vW.y - scanY) * 12.0, 2.0));
  float edge = smoothstep(0.08, 0.0, uReveal - vW.y);
  float flicker = 0.97 + 0.03 * sin(uTime * 29.0 + vW.y * 7.0);
  vec3 rimCol = mix(uColor, vAura * (0.6 + 0.5 * vLevel), 0.85 * vLevel * vLevel);
  vec3 c = tex * uTexGain * (1.0 + 0.5 * band) + uColor * (0.03 + 0.1 * band) + rimCol * 0.6 * fres;
  c += vAura * vLevel * vLevel * 0.1 * (0.5 + 0.5 * fres);
  c += vec3(0.55, 0.85, 1.0) * edge * 1.2;
  gl_FragColor = vec4(c * vFocus * flicker, 1.0);
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
  // inner glow: the part itself is lit in its status colour, the outer shell (AURA_FRAG) adds the halo
  c += vAura * vLevel * (0.1 + 0.1 * line) * (0.4 + 0.6 * vLevel);
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
  // BiS and S+ pulse noticeably, the others only breathe
  float amp = 0.12 + 0.2 * smoothstep(0.85, 0.9, vLevel);
  float breathe = 1.0 - amp + amp * sin(uTime * (1.1 + 1.6 * vLevel));
  float fill = smoothstep(0.92, 1.0, vLevel) * 0.15 + smoothstep(0.62, 0.75, vLevel) * 0.05;
  float strength = 0.5 + 1.4 * vLevel * vLevel;
  float spark = 0.0;
  if (vLevel > 0.85) spark = step(vLevel > 0.95 ? 0.993 : 0.997, hash(floor(vW * 85.0) + floor(uTime * 5.0))) * 2.2;
  vec3 c = vAura * (rim * (0.65 + 0.7 * streak) + fill + streak * 0.3 * vLevel) * strength * breathe;
  // thin bright rim right at the edge keeps warm colours readable against the blue body
  c += mix(vAura, vec3(1.0), 0.6) * pow(1.0 - ndv, 7.0) * 0.45 * vLevel;
  c += mix(vec3(1.0, 0.96, 0.76), vAura, 0.3) * spark;
  gl_FragColor = vec4(c * vFocus, 1.0);
}`;

type V3 = [number, number, number];

/** small pieces get a compact aura shell */
const SMALL = new Set(["necklace", "earring", "ring", "bracelet", "gloves", "belt"]);
/** aura strength per kind of piece: the weapon leads, armour stays more subtle */
const auraWeight = (id: string) => {
  const slot = id.split(":")[0];
  if (slot === "weapon") return 1.2;
  if (slot === "offhand") return 1;
  if (SMALL.has(slot)) return 0.95;
  return 0.8;
};

export interface Figure {
  root: THREE.Group;
  /** platform rings on the floor (scaled to sit on the painted platform of the backdrop) */
  platform: THREE.Object3D;
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

export interface FigureOptions {
  /** the supplied character model; without it the built-in MakeHuman body is used */
  model?: ModelBody | null;
  /** loaded class weapon models (weapons.ts) */
  weapons?: LoadedLoadout | null;
}

export function buildFigure(gender: Gender, weapon: WeaponKind, reduce: boolean, opts: FigureOptions = {}): Figure {
  const { model, weapons } = opts;
  const root = new THREE.Group();
  const geos = new Set<THREE.BufferGeometry>();
  const mats: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const shared = { uTime: { value: 0 }, uReveal: { value: reduce ? 3 : -0.1 } };

  // ---- body -----------------------------------------------------------------
  // everything that belongs to the character floats together; the platform stays on the floor
  const figure = new THREE.Group();
  root.add(figure);
  const data = model ?? buildBody(gender);
  const { map: bones, list: boneList, skeleton } = bodySkeleton(data);
  figure.add(bones.hips);
  root.updateMatrixWorld(true);
  skeleton.calculateInverses();
  const bodyGeo = model ? model.geometry : bodyGeometry(buildBody(gender));
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

  const modelU = {
    uBreath: { value: 0 }, uTexGain: { value: 1.0 },
    uMap: { value: model?.texture ?? null },
    uRef: { value: model?.reference ?? null }, uRefOn: { value: model?.reference ? 1 : 0 },
    uNatural: { value: model?.natural ? 1 : 0 },
    uChest: { value: new THREE.Vector3(...(model ? [model.fit.chest[0], model.fit.chest[1], model.joint.chest[0]] : [0, 0, 0])) },
  };
  const modelMat = (frag: string, inflate: number) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...shared, ...slotUniforms, ...modelU, uColor: { value: HOLO_BLUE }, uInflate: { value: inflate } },
      vertexShader: MODEL_VERT, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    mats.push(m);
    return m;
  };
  const bodyPart = (mat: THREE.Material, order: number) => {
    const m = model ? new THREE.Mesh(bodyGeo, mat) : new THREE.SkinnedMesh(bodyGeo, mat);
    if (m instanceof THREE.SkinnedMesh) m.bind(skeleton);
    m.frustumCulled = false;
    m.renderOrder = order;
    figure.add(m);
    return m;
  };
  if (model) {
    // the depth prepass must see the same breathing surface as the hologram
    const pre = modelMat(MODEL_FRAG, 0);
    pre.colorWrite = false; pre.depthWrite = true; pre.transparent = false; pre.blending = THREE.NormalBlending;
    pre.polygonOffset = true; pre.polygonOffsetFactor = 1; pre.polygonOffsetUnits = 1;
    bodyPart(pre, 1);
  } else bodyPart(prepass, 1);
  const bodyMesh = bodyPart(model ? modelMat(MODEL_FRAG, 0) : skinMat(HOLO_FRAG, 0), 2);
  bodyPart(model ? modelMat(AURA_FRAG, 1) : skinMat(AURA_FRAG, 1), 3);
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
        uniforms: { ...shared, uAuraColor: u.uAuraColor, uLevel: u.uLevel, uFocus: u.uFocus, uInflate: { value: SMALL.has(id.split(":")[0]) ? 0.5 : 1 } },
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
    const brR = model ? model.fit.wristR[side] * 1.2 + 0.006 : f ? 0.03 : 0.035;
    const br = part(bones[`foreArm.${side}`], new THREE.TorusGeometry(brR, 0.006, 8, 40), `bracelet:${idx}`, { p: wristOff, q: qArm });
    part(br, new THREE.SphereGeometry(0.055, 10, 8), `bracelet:${idx}`, { hitOnly: true });
    marker(br, [0, 0, 0], `bracelet:${idx}`);
    // ring
    const rg = part(hands[side], new THREE.TorusGeometry(0.013, 0.004, 6, 24), `ring:${idx}`, { p: d.clone().multiplyScalar(0.115).add(new THREE.Vector3(0, 0, 0.018)).toArray() as V3, q: qArm });
    part(rg, new THREE.SphereGeometry(0.03, 10, 8), `ring:${idx}`, { p: [0, 0, 0.012], hitOnly: true });
    marker(rg, [0, 0, 0], `ring:${idx}`);
    // earring
    const sx = side === "L" ? 1 : -1;
    const earP: V3 = model ? [sx * (model.fit.earX + 0.004), model.fit.earY - J.head[1], -0.005] : [sx * 0.071 * hs, 0.03, -0.015];
    const er = part(bones.head, new THREE.SphereGeometry(0.01, 16, 12), `earring:${idx}`, { p: earP });
    part(er, new THREE.SphereGeometry(0.034, 10, 8), `earring:${idx}`, { hitOnly: true });
    marker(er, [0, 0, 0], `earring:${idx}`);
  }
  // necklace
  const neckR = model ? model.fit.neckR + 0.012 : f ? 0.058 : 0.066;
  if (model) {
    // rests on the base of the neck and dips towards the collarbones at the front
    const ny = -0.035 * model.height;
    part(bones.neck, new THREE.TorusGeometry(neckR, 0.005, 8, 56), "necklace:0", { p: [0, ny, 0.0], r: [Math.PI / 2 - 0.6, 0, 0] });
    part(bones.neck, new THREE.OctahedronGeometry(0.014), "necklace:0", { p: [0, ny - 0.06, model.fit.neckFront + 0.022] });
  } else {
    part(bones.neck, new THREE.TorusGeometry(neckR, 0.005, 8, 56), "necklace:0", { p: [0, 0, 0.012], r: [Math.PI / 2 - 0.45, 0, 0] });
    part(bones.neck, new THREE.OctahedronGeometry(0.014), "necklace:0", { p: [0, -0.04, f ? 0.07 : 0.08] });
  }
  // belt
  if (model) {
    const wz = model.fit.waist, rx = wz.rx + 0.007, rz = wz.rz + 0.007;
    part(bones.hips, new THREE.TorusGeometry(rx, 0.011, 10, 64), "belt:0", { p: rel("hips", [J.spine[0], wz.y, wz.cz]), r: [Math.PI / 2, 0, 0], s: [1, rz / rx, 1] });
    marker(bones.hips, rel("hips", [J.spine[0], wz.y, wz.cz + rz]), "belt:0");
  } else {
    part(bones.hips, new THREE.TorusGeometry(f ? 0.128 : 0.145, 0.011, 10, 64), "belt:0", { p: rel("hips", [0, J.spine[1] - 0.055, -0.005]), r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
    marker(bones.hips, rel("hips", [0, J.spine[1] - 0.055, 0.1]), "belt:0");
  }
  // cape
  const capePivot = new THREE.Group();
  // the cape hangs from just behind the shoulders
  const capeTop = model ? Math.max(f ? 0.17 : 0.2, (J["shoulder.L"][0] - J["shoulder.R"][0]) * 0.62) : f ? 0.17 : 0.2;
  const capeLen = model ? model.height * 0.58 : 1.0;
  const capeZ = model ? model.fit.backZ - 0.012 + capeTop - 0.075 : -0.075;
  capePivot.position.set(...rel("chest", [J.chest[0], J["shoulder.L"][1] + 0.02, capeZ]));
  bones.chest.add(capePivot);
  const capeGeo = new THREE.CylinderGeometry(capeTop, capeTop * 1.7, capeLen, 40, 24, true, Math.PI - 0.95, 1.9);
  capeGeo.translate(0, -capeLen / 2, 0.075);
  part(capePivot, capeGeo, "cape:0", { side: THREE.DoubleSide, strength: 0.45 });
  marker(capePivot, [0, -0.4, -0.15], "cape:0");
  // ---- weapons (GLB pack, see weapons.ts) ------------------------------------------
  const WID = "weapon:0";
  const lo = LOADOUTS[weapon];
  const bp = INTROS[lo.intro];
  const animatable = !model; // the built-in body has bones that move; the Bildmaster models are not rigged
  const sideSign = (s: "L" | "R") => (s === "L" ? 1 : -1);
  interface Mounted { id: string; hold: Hold; rest: THREE.Group; holder: THREE.Group; tip: THREE.Object3D; keys?: Key[]; introOnly?: boolean; spin?: boolean }
  const mounted: Mounted[] = [];
  const forearmMid = (s: "L" | "R") => {
    const E = J[`elbow.${s}`], W = J[`wrist.${s}`];
    return marker(bones[`foreArm.${s}`], rel(`foreArm.${s}`, [(E[0] + W[0]) / 2, (E[1] + W[1]) / 2, (E[2] + W[2]) / 2]));
  };
  function mount(wm: WeaponModel | null, hold: Hold, id: string, keys?: Key[], introOnly = false) {
    const rest = new THREE.Group(), holder = new THREE.Group();
    rest.add(holder);
    let h = hold;
    if (hold.socket === "forearm") {
      // shields lie along the forearm, top towards the elbow
      const d = data.armDir[hold.side];
      h = { ...hold, dir: [-d[0] * sideSign(hold.side), -d[1], -d[2]] };
      forearmMid(hold.side).add(rest);
    } else if (hold.socket === "hand") palm[hold.side].add(rest);
    else root.add(rest); // floats beside the palm, placed every frame
    rest.quaternion.copy(holdQuaternion(h));
    if (hold.socket !== "float") rest.position.copy(holdOffset(h));
    rest.scale.setScalar(hold.scale);
    const tip = new THREE.Object3D();
    holder.add(tip);
    if (wm) {
      // the status aura goes on the outer shell only, so the weapon's own detail stays readable
      const vol = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); const v = g.boundingBox!.getSize(new THREE.Vector3()); return v.x + v.y + v.z; };
      const outer = wm.parts.reduce((a, p) => (vol(p.geometry) > vol(a.geometry) ? p : a), wm.parts[0]);
      for (const p of wm.parts) part(holder, p.geometry, id, { strength: p.strength, noAura: p !== outer });
      const size = wm.box.getSize(new THREE.Vector3()), c = wm.box.getCenter(new THREE.Vector3());
      part(holder, new THREE.BoxGeometry(Math.max(size.x, 0.1), size.y, Math.max(size.z, 0.1)), id, { p: c.toArray() as V3, hitOnly: true });
      tip.position.set(0, wm.box.max.y * 0.92, 0);
      marker(holder, (introOnly ? [0, 0, 0] : c.toArray()) as V3, introOnly ? undefined : id);
    } else {
      gearMats(id, THREE.FrontSide, 1);
      if (!introOnly) marker(holder, [0, 0, 0], id);
    }
    const m: Mounted = { id, hold, rest, holder, tip, keys, introOnly, spin: id === WID && weapon === "orb" };
    mounted.push(m);
    return m;
  }
  const mainW = mount(weapons?.main ?? null, lo.hold, WID, bp.weapon);
  const secondW = lo.second ? mount(weapons?.main ?? null, lo.second.hold, WID, bp.second ?? bp.weapon, lo.second.introOnly) : undefined;
  let offW: Mounted | undefined;
  if (lo.offhand && weapons?.offhand) offW = mount(weapons.offhand, lo.offhand.hold, "offhand:0", bp.offhand);
  else {
    // no visible offhand (not equipped, or not a shield class): it stays reachable from the gear list
    gearMats("offhand:0", THREE.FrontSide, 1);
    marker(palm.L, [0, 0, 0], "offhand:0");
  }
  const chestFront = marker(bones.chest, [0, 0.06, (model ? model.fit.neckFront : 0.08) + 0.22]);

  // ---- intro effects (light only: flashes, rune rings, spark bursts) --------------------
  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = ringCanvas.height = 128;
  {
    const c = ringCanvas.getContext("2d")!;
    const g = c.createRadialGradient(64, 64, 40, 64, 64, 62);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.55, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); c.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); c.stroke(); }
  }
  const ringTex = new THREE.CanvasTexture(ringCanvas); textures.push(ringTex);
  const FX_COLOR = new THREE.Color(0.35, 0.8, 1);
  interface Fx { obj: THREE.Object3D; mat: THREE.SpriteMaterial | THREE.MeshBasicMaterial; t0: number; dur: number; size: number; kind: Effect["kind"] }
  const fxs: Fx[] = [];
  const fired = new Set<number>();
  const fxPos = (at: Effect["at"], out: THREE.Vector3) => {
    if (at === "weapon") return mainW.holder.getWorldPosition(out);
    if (at === "tip") return mainW.tip.getWorldPosition(out);
    if (at === "second") return (secondW ?? mainW).holder.getWorldPosition(out);
    if (at === "offhand") return (offW ?? mainW).holder.getWorldPosition(out);
    if (at === "chest") return chestFront.getWorldPosition(out);
    return out.set(J.hips[0], 0.012, J.hips[2]);
  };
  function fire(e: Effect, t: number) {
    const p = fxPos(e.at, new THREE.Vector3());
    const size = e.size ?? 1;
    if (e.kind === "burst") {
      for (let i = 0; i < 18; i++) {
        const m = new THREE.SpriteMaterial({ map: haloTex, color: FX_COLOR, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const s = new THREE.Sprite(m);
        s.position.copy(p);
        s.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(0.5 + Math.random() * 0.6);
        root.add(s);
        fxs.push({ obj: s, mat: m, t0: t, dur: 0.8, size: 0.05, kind: "burst" });
      }
      return;
    }
    if (e.kind === "groundRing") {
      const g = new THREE.PlaneGeometry(1, 1); geos.add(g);
      const m = new THREE.MeshBasicMaterial({ map: ringTex, color: FX_COLOR, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m);
      mesh.rotation.x = -Math.PI / 2; mesh.position.copy(p);
      root.add(mesh);
      fxs.push({ obj: mesh, mat: m, t0: t, dur: 0.9, size: size * 2.2, kind: e.kind });
      return;
    }
    const m = new THREE.SpriteMaterial({ map: e.kind === "ring" ? ringTex : haloTex, color: FX_COLOR, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.position.copy(p);
    root.add(s);
    fxs.push({ obj: s, mat: m, t0: t, dur: e.kind === "ring" ? 0.75 : 0.5, size: e.kind === "ring" ? size * 0.9 : size * 0.45, kind: e.kind });
  }
  function updateFx(it: number, dt: number) {
    bp.effects.forEach((e, i) => { if (!fired.has(i) && it >= e.t) { fired.add(i); if (!reduce) fire(e, it); } });
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      const k = (it - f.t0) / f.dur;
      if (k >= 1 || it < f.t0) {
        root.remove(f.obj); f.mat.dispose(); fxs.splice(i, 1);
        continue;
      }
      if (f.kind === "burst") {
        f.obj.position.addScaledVector(f.obj.userData.v as THREE.Vector3, dt);
        f.obj.scale.setScalar(f.size * (1 - k));
      } else {
        const grow = f.kind === "flash" ? Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) : k;
        f.obj.scale.set(f.size * (0.2 + grow), f.size * (0.2 + grow), 1);
      }
      f.mat.opacity = (1 - k) * (1 - k) * (f.kind === "flash" ? 1.4 : 1);
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
  const INTRO_T0 = 0.3; // the intro starts right after the hologram begins to materialise
  const glowMul: Record<string, number> = {};
  let lastT = 0;
  let introPose: ReturnType<typeof samplePose> = {};
  const bind: Record<string, THREE.Vector3> = {};
  for (const b of boneList) bind[b.name] = b.position.clone();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const rot = (name: BoneName, x: number, y: number, z: number) => {
    const c = combat[name] ?? [0, 0, 0], p = pres[name] ?? c;
    const k = ease3(present);
    const ip = introPose[name] ?? [0, 0, 0];
    bones[name].rotation.set(c[0] + (p[0] - c[0]) * k + x + ip[0], c[1] + (p[1] - c[1]) * k + y + ip[1], c[2] + (p[2] - c[2]) * k + z + ip[2]);
  };

  function update(t: number) {
    shared.uTime.value = t;
    if (shared.uReveal.value < 3) shared.uReveal.value = -0.1 + t * 2.2;
    const amp = reduce ? 0.3 : 1;
    present += (presentTo - present) * 0.06;

    // idle: breathing, weight shift between the legs, small guard adjustments, alert head
    const br = Math.sin(t * 1.35) * amp;                 // breath
    const ws = Math.sin(t * 0.62) * amp;                 // weight shift
    const bob = (0.5 - 0.5 * Math.cos(t * 1.24)) * amp;  // knee bounce
    const mic = Math.sin(t * 2.3 + 0.7) * amp;           // micro motion
    const look = Math.sin(t * 0.31) * amp;

    if (model) {
      // no rig: breathing (vertex shader), a gentle hover and a slow shift of weight of the whole figure
      modelU.uBreath.value = br;
      figure.position.set(0.004 * ws, 0.016 + 0.012 * Math.sin(t * 0.9) * amp, 0);
      figure.rotation.set(0, 0, 0.005 * ws);
    } else {
      // bodies with bones also play the arm choreography of the class intro
      introPose = !reduce && t - INTRO_T0 < bp.duration ? samplePose(bp, Math.max(0, t - INTRO_T0)) : {};
      poseBody(t, br, ws, bob, mic, look, amp);
    }
    capePivot.rotation.set(0.12 + 0.03 * Math.sin(t * 1.1) * amp + 0.02 * ws, 0, 0.02 * ws);
    root.updateMatrixWorld(true);
    animate(t);
  }

  function poseBody(t: number, br: number, ws: number, bob: number, mic: number, look: number, amp: number) {
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
  }

  function animate(t: number) {

    // weapons: hold + intro tracks; floating ones (orb, book) follow their palm
    const it = reduce ? 99 : t - INTRO_T0;
    const playing = it < bp.duration;
    const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    for (const m of mounted) {
      const keys = playing ? m.keys : undefined;
      const sc = keys ? sample(keys, it, "s", 1) : 1;
      m.holder.scale.setScalar(Math.max(1e-4, sc));
      const r = keys ? sampleRot(keys, it) : [0, 0, 0];
      m.holder.rotation.set(r[0], r[1] + (m.spin ? t * 0.6 : 0), r[2]);
      m.holder.visible = !(m.introOnly && (!playing || sc < 0.01));
      glowMul[m.id] = keys ? sample(keys, it, "glow", 1) : 1;
      if (m.hold.socket !== "float") continue;
      const sx = sideSign(m.hold.side);
      palm[m.hold.side].getWorldPosition(tmp);
      tmp.add(holdOffset(m.hold));
      // while the camera looks at it, the weapon rises a little
      tmp.y += 0.07 * ease3(present) + 0.016 * Math.sin(t * 2.1 + (sx > 0 ? 1.3 : 0));
      if (keys) {
        tmp.y += sample(keys, it, "y", 0);
        // without a rig the hands cannot carry it: the weapon itself glides to the chest and crosses
        const c = animatable ? 0 : sample(keys, it, "c", 0);
        if (c > 0) tmp.lerp(chestFront.getWorldPosition(tmp2), c);
        tmp.x += -sx * sample(keys, it, "x", 0);
      }
      if (m.rest.position.lengthSq() === 0 || playing) m.rest.position.copy(tmp);
      else m.rest.position.lerp(tmp, 0.14);
    }
    updateFx(it, dt);
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
      if (gearU[id]) { gearU[id].uFocus.value = focusCur[id] * (glowMul[id] ?? 1); gearU[id].uLevel.value = levelCur[id]; }
    }

    // weapon status effects
    const wl = levelCur[WID] ?? 0, wf = focusCur[WID] ?? 1;
    const anchor = anchors[WID];
    if (anchor) {
      anchor.getWorldPosition(tmp);
      halo.position.copy(tmp);
      const pulse = 0.85 + 0.15 * Math.sin(t * (1.5 + 2 * wl));
      halo.scale.setScalar((0.14 + 0.3 * wl * wl) * pulse);
      haloMat.color.copy(weaponColor).multiplyScalar(wl * wl * wl * 0.45 * Math.min(wf, 1.2));
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
      sparkMat.uniforms.uColor.value.copy(weaponColor).multiplyScalar(wf * Math.min(1, mainW.holder.scale.x));
    }
  }

  function setGrade(id: string, grade: Grade | undefined) {
    grades[id] = grade;
    const hex = grade ? GRADE_HEX[grade] : null;
    const lvl = grade ? GRADE_LEVEL[grade] : 0;
    levelTo[id] = hex === null ? 0 : lvl;
    if (hex === null) return;
    const si = (SKIN_SLOTS as readonly string[]).indexOf(id);
    const w = auraWeight(id);
    if (si >= 0) slotUniforms.uSlotColor.value[si].setHex(hex).multiplyScalar(w);
    if (gearU[id]) gearU[id].uAuraColor.value.setHex(hex).multiplyScalar(w);
    if (id === WID) weaponColor.setHex(hex);
  }

  return {
    root, platform: plat, anchors, slotIds, hitTargets,
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
