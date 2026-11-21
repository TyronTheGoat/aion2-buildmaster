"use client";
import { useEffect, useRef } from "react";

/**
 * Looping start-screen animation (14 s): loose gear pieces drift, fly into
 * place one after another and lock in; once complete, the whole mechanism
 * spins up and runs in perfect sync, then slows down, comes apart and repeats.
 * Pure canvas; pauses when hidden and respects "reduce motion".
 */
const CYCLE = 14;

type GearDef = { n: number; parent?: number; dir?: number; metal: "gold" | "steel" };
// Tooth counts and where each gear sits relative to the gear it meshes with.
const LAYOUT: GearDef[] = [
  { n: 24, metal: "gold" },
  { n: 12, parent: 0, dir: -0.35, metal: "steel" },
  { n: 18, parent: 1, dir: 0.55, metal: "gold" },
  { n: 10, parent: 0, dir: 2.45, metal: "steel" },
  { n: 16, parent: 0, dir: 1.55, metal: "steel" },
  { n: 14, parent: 2, dir: 1.95, metal: "steel" },
  { n: 20, parent: 3, dir: -2.1, metal: "gold" },
];

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeOutBack = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

function drawGear(n: number, m: number, metal: "gold" | "steel"): HTMLCanvasElement {
  // Same tooth module m for every gear, so the teeth really mesh.
  const r = (m * n) / 2, pad = 4;
  const size = Math.ceil((r + m + pad) * 2);
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr; c.height = size * dpr;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  g.translate(size / 2, size / 2);

  const outer = r + m * 0.95, inner = r - m * 1.15;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = (Math.PI * 2) / n;
    const pts: [number, number][] = [
      [a - s * 0.5, inner], [a - s * 0.28, inner], [a - s * 0.16, outer],
      [a + s * 0.16, outer], [a + s * 0.28, inner], [a + s * 0.5, inner],
    ];
    pts.forEach(([ang, rad], k) => {
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      if (i === 0 && k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
  }
  g.closePath();
  // cut-outs between the spokes
  const ring = inner * 0.72, hub = inner * 0.3, spokes = n >= 16 ? 6 : n >= 12 ? 5 : 4;
  g.moveTo(ring, 0);
  for (let k = 0; k < spokes; k++) {
    const a0 = (k / spokes) * Math.PI * 2 + 0.22, a1 = ((k + 1) / spokes) * Math.PI * 2 - 0.22;
    g.moveTo(Math.cos(a0) * ring, Math.sin(a0) * ring);
    g.arc(0, 0, ring, a0, a1);
    g.lineTo(Math.cos(a1) * hub * 1.25, Math.sin(a1) * hub * 1.25);
    g.arc(0, 0, hub * 1.25, a1, a0, true);
    g.closePath();
  }
  const grad = g.createLinearGradient(-outer, -outer, outer, outer);
  if (metal === "gold") {
    grad.addColorStop(0, "#fde68a"); grad.addColorStop(0.45, "#d4a017"); grad.addColorStop(1, "#7c5a10");
  } else {
    grad.addColorStop(0, "#e5e7eb"); grad.addColorStop(0.5, "#8b93a3"); grad.addColorStop(1, "#3f4552");
  }
  g.fillStyle = grad;
  g.fill("evenodd");
  g.lineWidth = 1;
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.stroke();
  // hub
  g.beginPath(); g.arc(0, 0, hub, 0, Math.PI * 2);
  g.fillStyle = metal === "gold" ? "#a87a12" : "#555c6a"; g.fill();
  g.beginPath(); g.arc(0, 0, hub * 0.4, 0, Math.PI * 2);
  g.fillStyle = "#0b0b12"; g.fill();
  // rim highlight
  g.beginPath(); g.arc(0, 0, inner * 0.92, 0, Math.PI * 2);
  g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1.5; g.stroke();
  return c;
}

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;

    type G = {
      n: number; r: number; x: number; y: number; img: HTMLCanvasElement; size: number;
      parent?: number; dir: number;
      sx: number; sy: number; sRot: number; spin: number; arrive: number; leave: number;
    };
    let gears: G[] = [];
    let cx = 0, cy = 0;

    function build() {
      const mobile = w < 640;
      cx = w * (mobile ? 0.5 : 0.7);
      cy = h * (mobile ? 0.66 : 0.55);
      // lay out with module 1, then scale so the machine fits the screen
      const unit: { x: number; y: number; r: number }[] = [];
      LAYOUT.forEach((d) => {
        const r = d.n / 2;
        if (d.parent === undefined) { unit.push({ x: 0, y: 0, r }); return; }
        const p = unit[d.parent];
        unit.push({ x: p.x + Math.cos(d.dir!) * (p.r + r), y: p.y + Math.sin(d.dir!) * (p.r + r), r });
      });
      const bw = Math.max(...unit.map((u) => u.x + u.r + 1)) - Math.min(...unit.map((u) => u.x - u.r - 1));
      const bh = Math.max(...unit.map((u) => u.y + u.r + 1)) - Math.min(...unit.map((u) => u.y - u.r - 1));
      const m = Math.min((w * (mobile ? 0.94 : 0.5)) / bw, (h * (mobile ? 0.42 : 0.7)) / bh);
      gears = [];
      LAYOUT.forEach((d, i) => {
        const r = (m * d.n) / 2;
        let x = 0, y = 0;
        const dir = d.dir ?? 0;
        if (d.parent !== undefined) {
          const p = gears[d.parent];
          x = p.x + Math.cos(dir) * (p.r + r);
          y = p.y + Math.sin(dir) * (p.r + r);
        }
        const img = drawGear(d.n, m, d.metal);
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.max(w, h) * (0.35 + Math.random() * 0.25);
        gears.push({
          n: d.n, r, x, y, img, size: img.width / Math.min(window.devicePixelRatio || 1, 2), parent: d.parent, dir,
          sx: Math.cos(ang) * dist, sy: Math.sin(ang) * dist * 0.8,
          sRot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.8,
          arrive: 1.2 + i * 0.5, leave: 11.6 + (LAYOUT.length - i) * 0.12,
        });
      });
      // centre the assembly
      const xs = gears.map((g) => g.x), ys = gears.map((g) => g.y);
      const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
      gears.forEach((g) => { g.x -= mx; g.y -= my; });
    }

    /** Rotation of every gear when meshed, given the main gear's angle. */
    function meshAngles(a0: number): number[] {
      const out: number[] = [];
      gears.forEach((g, i) => {
        if (g.parent === undefined) { out[i] = a0; return; }
        const p = gears[g.parent];
        out[i] = g.dir + Math.PI + (p.n / g.n) * (g.dir - out[g.parent]) - Math.PI / g.n;
      });
      return out;
    }

    // main gear speed (rad/s) over the cycle: spin up after lock-in, run, spin down
    const LOCK = 1.2 + (LAYOUT.length - 1) * 0.5 + 1.1;
    const speed = (c: number) => 0.9 * ease((c - LOCK) / 1.2) * (1 - ease((c - 10.4) / 1.2));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    let start = performance.now(), last = start, angle = 0, lastCycle = -1;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const cycle = Math.floor(t / CYCLE);
      const c = t % CYCLE;
      if (cycle !== lastCycle) { angle = 0; lastCycle = cycle; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      angle += speed(c) * dt;
      const run = speed(c) / 0.9;

      // background
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.9);
      bg.addColorStop(0, `rgba(${28 + run * 22},${22 + run * 14},${16},1)`);
      bg.addColorStop(0.55, "#0c0b14");
      bg.addColorStop(1, "#060609");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // blueprint grid
      ctx.strokeStyle = "rgba(148,163,184,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (cx % 32) - 32; x < w; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = (cy % 32) - 32; y < h; y += 32) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      const mesh = meshAngles(angle);

      // warm glow behind the running machine
      if (run > 0.01) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.6);
        glow.addColorStop(0, `rgba(251,191,36,${0.18 * run})`);
        glow.addColorStop(1, "rgba(251,191,36,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }

      gears.forEach((g, i) => {
        const tin = easeOutBack((c - g.arrive) / 1.1);
        const tout = ease((c - g.leave) / 1.6);
        const k = tin * (1 - tout); // 1 = in place
        const tumble = g.sRot + g.spin * t;
        const x = cx + g.sx + (g.x - g.sx) * k;
        const y = cy + g.sy + (g.y - g.sy) * k;
        const rot = tumble + (mesh[i] - tumble) * Math.min(1, Math.max(0, k));
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, Math.max(0, k));
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.drawImage(g.img, -g.size / 2, -g.size / 2, g.size, g.size);
        ctx.restore();

        // snap flash when a piece locks in
        const snap = c - (g.arrive + 0.75);
        if (snap > 0 && snap < 0.6) {
          const e = snap / 0.6;
          ctx.strokeStyle = `rgba(253,224,71,${0.6 * (1 - e)})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx + g.x, cy + g.y, g.r * (1.05 + e * 0.5), 0, Math.PI * 2); ctx.stroke();
        }
      });

      // "complete" pulse as the machine starts
      const p = c - LOCK;
      if (p > 0 && p < 1.6) {
        const e = p / 1.6, R = Math.min(w, h) * (0.35 + e * 0.4);
        ctx.strokeStyle = `rgba(253,224,71,${0.45 * (1 - e)})`;
        ctx.lineWidth = 2.5 * (1 - e) + 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
    if (reduce) start = performance.now() - 9000; // single still frame of the assembled machine
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
