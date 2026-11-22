"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Grade, SlotKind } from "@/lib/types";
import type { Gender, WeaponKind } from "@/lib/hologram";
import { buildFigure, type Figure } from "./figure";
import { loadModelBody, type ModelBody } from "./model-body";

export interface HoloSceneProps {
  gender: Gender;
  weapon: WeaponKind;
  /** slotId ("helmet:0") → grade of the equipped item */
  grades: Record<string, Grade>;
  /** Focused slotId, or undefined for the full view */
  focus?: string;
  /** Where the info panel covers the screen while focused, so the part is framed beside it */
  panel: "bottom" | "right";
  onPick: (slotId: string | undefined) => void;
  onError?: (msg: string) => void;
  /** "hero": showcase on the start page (slow turn, no orbit controls, tap opens the character) */
  mode?: "full" | "hero";
}

/** How the camera frames each slot: distance and view direction (world space, character faces +z). */
const FOCUS: Partial<Record<SlotKind, { dist: number; dir: [number, number, number] }>> = {
  weapon: { dist: 1.3, dir: [-1, 0.45, 0.75] },
  offhand: { dist: 1.2, dir: [0.6, 0.15, 1] },
  helmet: { dist: 1.3, dir: [0.3, 0.12, 1] },
  shoulders: { dist: 1.5, dir: [0.45, 0.3, 1] },
  torso: { dist: 1.75, dir: [0.25, 0.1, 1] },
  gloves: { dist: 1.0, dir: [0.9, 0.3, 0.4] },
  pants: { dist: 2.1, dir: [0.3, 0.05, 1] },
  boots: { dist: 1.4, dir: [0.35, 0.35, 1] },
  cape: { dist: 2.4, dir: [0.35, 0.15, -1] },
  necklace: { dist: 0.9, dir: [0.15, 0.1, 1] },
  earring: { dist: 0.7, dir: [0.9, 0.1, 0.6] },
  ring: { dist: 0.7, dir: [0.9, 0.3, 0.35] },
  bracelet: { dist: 0.8, dir: [0.9, 0.3, 0.35] },
  belt: { dist: 1.4, dir: [0.2, 0.05, 1] },
};

const OVERVIEW_TARGET = new THREE.Vector3(0, 0.98, 0);
const OVERVIEW_OFFSET = new THREE.Vector3(0, 0.2, 4.7);
const HERO_TARGET = new THREE.Vector3(0, 0.78, 0);
const HERO_OFFSET = new THREE.Vector3(1.0, 0.3, 4.7);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export default function HoloScene(props: HoloSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const api = useRef<{ apply: () => void } | null>(null);

  useEffect(() => {
    latest.current = props;
    api.current?.apply();
  });

  const { gender, weapon } = props;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // load the character model (falls back to the built-in body), then build after the first paint
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const id = setTimeout(() => {
      loadModelBody(gender).then((model) => {
        if (cancelled) return;
        cleanup = init(model);
        setReady(true);
      });
    }, 40);
    return () => { cancelled = true; clearTimeout(id); cleanup?.(); };

  function init(model: ModelBody | null): (() => void) | undefined {
    const el = host.current!;
    const hero = latest.current.mode === "hero";
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      latest.current.onError?.("3D wird auf diesem Gerät nicht unterstützt (WebGL fehlt).");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x03070f, 1);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = hero ? "pan-y" : "none";
    if (hero) renderer.domElement.style.cursor = "pointer";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03070f);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
    camera.position.set(0, 1.7, 8.5);

    const fig: Figure = buildFigure(gender, weapon, reduce, model);
    scene.add(fig.root);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 0.35;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.target.copy(OVERVIEW_TARGET);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = hero ? 0.8 : 0.5;
    controls.enabled = false;
    const overviewTarget = hero ? HERO_TARGET : OVERVIEW_TARGET;
    const overviewOffset = hero ? HERO_OFFSET : OVERVIEW_OFFSET;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.3, 0.14);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---- camera moves -------------------------------------------------------
    let focusId: string | undefined;
    let focusMarker: THREE.Object3D | undefined;
    let lastHit: { id: string; point: THREE.Vector3 } | undefined;
    const tw = {
      active: false, t0: 0, dur: 1.4,
      fromTarget: new THREE.Vector3(), fromSph: new THREE.Spherical(), toSph: new THREE.Spherical(),
      toTarget: () => new THREE.Vector3(0, 1, 0),
    };
    let shift = 0, shiftTo = 0;
    const tmp = new THREE.Vector3();

    function startTween(toTarget: () => THREE.Vector3, toOffset: THREE.Vector3, dur: number) {
      tw.active = true;
      tw.t0 = performance.now() / 1000;
      tw.dur = reduce ? 0.01 : dur;
      tw.fromTarget.copy(controls.target);
      tw.fromSph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
      tw.toSph.setFromVector3(toOffset);
      // shortest way around the character
      let d = tw.toSph.theta - tw.fromSph.theta;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      tw.toSph.theta = tw.fromSph.theta + d;
      tw.toTarget = toTarget;
      controls.enabled = false;
    }

    function markerFor(id: string) {
      if (lastHit?.id === id) return fig.focusPoint(id, lastHit.point);
      return fig.anchors[id];
    }

    function setFocus(id: string | undefined) {
      if (id === focusId) return;
      focusId = id;
      fig.setPresent(!!id && id.startsWith("weapon"));
      const slot = id?.split(":")[0] as SlotKind | undefined;
      const f = slot && FOCUS[slot];
      const marker = id ? markerFor(id) : undefined;
      if (id && f && marker) {
        focusMarker = marker;
        controls.autoRotate = false;
        const dir = new THREE.Vector3(...f.dir).normalize();
        if (slot === "weapon" || slot === "gloves" || slot === "bracelet" || slot === "ring" || slot === "earring") {
          // look at the clicked side of the body from the outside
          marker.getWorldPosition(tmp);
          if (Math.sign(tmp.x) !== Math.sign(dir.x) && Math.abs(tmp.x) > 0.05) dir.x *= -1;
        }
        // on phones the panel covers the lower half, so step back a little
        const dist = f.dist * (latest.current.panel === "bottom" ? 1.35 : 1);
        startTween(() => marker.getWorldPosition(new THREE.Vector3()), dir.multiplyScalar(dist), 1.5);
        controls.minDistance = Math.min(0.35, f.dist * 0.5);
      } else {
        focusMarker = undefined;
        startTween(() => overviewTarget.clone(), overviewOffset.clone(), 1.3);
        controls.minDistance = 0.35;
      }
      fig.setFocus(id);
      shiftTo = id ? 1 : 0;
    }

    function setGrades(grades: Record<string, Grade>) {
      for (const id of fig.slotIds) fig.setGrade(id, grades[id] && grades[id] !== "?" ? grades[id] : undefined);
    }

    api.current = {
      apply() {
        const p = latest.current;
        setGrades(p.grades);
        setFocus(p.focus);
      },
    };
    setGrades(latest.current.grades);

    // intro: camera glides in while the hologram materialises
    startTween(() => overviewTarget.clone(), overviewOffset.clone(), hero ? 2.2 : 2.6);
    if (latest.current.focus) setFocus(latest.current.focus);

    // ---- picking --------------------------------------------------------------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number; t: number } | undefined;
    let hoverId: string | undefined;
    const pick = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(fig.hitTargets, false)[0];
      const id = hit && fig.slotOf(hit);
      return hit && id ? { id, point: hit.point.clone() } : undefined;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      controls.autoRotate = false;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 600;
      down = undefined;
      if (moved > 7 || !quick) return;
      if (hero) { latest.current.onPick("open"); return; }
      const h = pick(e.clientX, e.clientY);
      if (h) lastHit = h;
      latest.current.onPick(h?.id);
    };
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      if (hero || e.pointerType !== "mouse" || down || performance.now() - lastMove < 90) return;
      lastMove = performance.now();
      const h = pick(e.clientX, e.clientY);
      if (h?.id !== hoverId) {
        hoverId = h?.id;
        fig.setHover(hoverId);
        renderer.domElement.style.cursor = h ? "pointer" : "grab";
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    // ---- size ---------------------------------------------------------------
    let w = 1, h = 1;
    const resize = () => {
      w = Math.max(1, el.clientWidth); h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      camera.aspect = w / h;
      // keep the whole figure in view on narrow phones
      camera.fov = w / h < 0.62 ? 44 : 34;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- loop ---------------------------------------------------------------
    let raf = 0, running = true;
    const t00 = performance.now() / 1000;
    const followed = new THREE.Vector3();
    const frame = () => {
      const now = performance.now() / 1000;
      const t = now - t00;
      fig.update(t);

      if (tw.active) {
        const k = ease(Math.min(1, (now - tw.t0) / tw.dur));
        const to = tw.toTarget();
        controls.target.lerpVectors(tw.fromTarget, to, k);
        const s = new THREE.Spherical(
          THREE.MathUtils.lerp(tw.fromSph.radius, tw.toSph.radius, k),
          THREE.MathUtils.lerp(tw.fromSph.phi, tw.toSph.phi, k),
          THREE.MathUtils.lerp(tw.fromSph.theta, tw.toSph.theta, k),
        );
        camera.position.copy(controls.target).add(tmp.setFromSpherical(s));
        if (k >= 1) { tw.active = false; controls.enabled = !hero; }
        camera.lookAt(controls.target);
      } else {
        if (focusMarker) {
          // follow the part gently while the character breathes / lifts the weapon
          focusMarker.getWorldPosition(followed);
          tmp.subVectors(followed, controls.target).multiplyScalar(0.06);
          controls.target.add(tmp);
          camera.position.add(tmp);
        }
        controls.update();
      }

      // frame the focused part beside the info panel
      shift += (shiftTo - shift) * 0.08;
      if (shift > 0.002) {
        const side = latest.current.panel;
        camera.setViewOffset(w, h, side === "right" ? w * 0.2 * shift : 0, side === "bottom" ? h * 0.2 * shift : 0, w, h);
      } else if (camera.view?.enabled) camera.clearViewOffset();

      composer.render();
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      fig.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }
  }, [gender, weapon]);

  return (
    <div ref={host} className="absolute inset-0">
      <div className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] tracking-[0.35em] text-sky-300/70 transition-opacity duration-700 ${ready ? "opacity-0" : "animate-pulse opacity-100"}`}>
        LADE HOLOGRAMM…
      </div>
    </div>
  );
}
