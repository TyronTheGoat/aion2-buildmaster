"use client";
import { useEffect, useRef } from "react";

/**
 * Looping "optimization" animation for the start screen (12 s cycle):
 * scattered red sparks (unoptimized) drift, then snap into a perfect
 * hexagonal lattice while turning gold, a progress ring fills to 100 %,
 * a pulse marks perfection, then everything loosens again and repeats.
 * Pure canvas; pauses when hidden and respects "reduce motion".
 */
const CYCLE = 12;

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;
    let cx = 0, cy = 0, R = 0;

    type P = { tx: number; ty: number; ax: number; ay: number; fx: number; fy: number; ph: number; delay: number };
    let pts: P[] = [];
    let edges: [number, number][] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

    function build() {
      const layers = 4;
      const step = R / layers;
      const lattice: [number, number][] = [[0, 0]];
      for (let L = 1; L <= layers; L++) {
        for (let side = 0; side < 6; side++) {
          const a0 = (Math.PI / 3) * side - Math.PI / 2, a1 = a0 + Math.PI / 3;
          for (let k = 0; k < L; k++) {
            const f = k / L;
            const x = (1 - f) * Math.cos(a0) + f * Math.cos(a1);
            const y = (1 - f) * Math.sin(a0) + f * Math.sin(a1);
            lattice.push([x * L * step, y * L * step]);
          }
        }
      }
      pts = lattice.map(([x, y]) => ({
        tx: x, ty: y,
        ax: rand(-w * 0.55, w * 0.55), ay: rand(-h * 0.5, h * 0.5),
        fx: rand(0.15, 0.4), fy: rand(0.15, 0.4), ph: rand(0, Math.PI * 2),
        delay: (Math.hypot(x, y) / R) * 0.6 + rand(0, 0.25),
      }));
      edges = [];
      for (let i = 0; i < lattice.length; i++)
        for (let j = i + 1; j < lattice.length; j++)
          if (Math.hypot(lattice[i][0] - lattice[j][0], lattice[i][1] - lattice[j][1]) < step * 1.05) edges.push([i, j]);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(w, h) * (w < 640 ? 0.36 : 0.26);
      cx = w * (w < 640 ? 0.5 : 0.72);
      cy = h * (w < 640 ? 0.66 : 0.55);
      build();
    }

    /** 0 = chaos, 1 = perfect lattice. */
    function order(c: number, delay: number) {
      const inT = ease((c - 2.5 - delay) / 2.5);   // 2.5s–5.5s(+delay): converge
      const outT = ease((c - 9.3 - delay * 0.5) / 2.2); // 9.3s–11.5s: release
      return inT * (1 - outT);
    }

    function grid(alpha: number) {
      const s = 28;
      ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (cx % s) - s; x < w; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = (cy % s) - s; y < h; y += s) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    function color(k: number, a: number) {
      // red (unoptimized) → orange → gold (perfect)
      const hue = 355 + k * 50;
      return `hsla(${hue % 360},${85 + k * 10}%,${55 + k * 12}%,${a})`;
    }

    let start = performance.now();
    function frame(now: number) {
      const t = (now - start) / 1000;
      const c = t % CYCLE;
      const global = order(c, 0.3);

      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
      bg.addColorStop(0, `rgba(${30 + global * 20},${22 + global * 14},${18},1)`);
      bg.addColorStop(0.5, "#0c0b14");
      bg.addColorStop(1, "#060609");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      grid(0.035 + global * 0.03);

      // positions
      const pos = pts.map((p) => {
        const k = order(c, p.delay);
        const jx = p.ax + Math.sin(t * p.fx + p.ph) * 40;
        const jy = p.ay + Math.cos(t * p.fy + p.ph) * 40;
        return { x: cx + jx + (p.tx - jx) * k, y: cy + jy + (p.ty - jy) * k, k };
      });

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // lattice edges appear as points lock in
      ctx.lineWidth = 1;
      for (const [i, j] of edges) {
        const k = Math.min(pos[i].k, pos[j].k);
        if (k < 0.55) continue;
        ctx.strokeStyle = color(k, (k - 0.55) * 0.9);
        ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
      }
      // points
      for (const p of pos) {
        const r = 1.6 + p.k * 1.6;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
        g.addColorStop(0, color(p.k, 0.85));
        g.addColorStop(1, color(p.k, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2); ctx.fill();
      }

      // progress ring around the lattice
      const ringR = R * 1.22;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
      if (global > 0.01) {
        ctx.strokeStyle = color(global, 0.55);
        ctx.beginPath(); ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * global); ctx.stroke();
      }
      // tick marks
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const on = i / 60 < global;
        const len = i % 5 === 0 ? 7 : 3;
        ctx.strokeStyle = on ? color(global, 0.45) : "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (ringR + 6), cy + Math.sin(a) * (ringR + 6));
        ctx.lineTo(cx + Math.cos(a) * (ringR + 6 + len), cy + Math.sin(a) * (ringR + 6 + len));
        ctx.stroke();
      }

      // perfection pulse once the lattice is complete (~6.8 s)
      const pt = c - 6.8;
      if (pt > 0 && pt < 2.2) {
        const e = pt / 2.2;
        ctx.strokeStyle = `rgba(253,224,71,${0.5 * (1 - e)})`;
        ctx.lineWidth = 2 * (1 - e) + 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, ringR + e * R * 1.2, 0, Math.PI * 2); ctx.stroke();
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.4);
        glow.addColorStop(0, `rgba(253,224,71,${0.16 * Math.sin(Math.PI * e)})`);
        glow.addColorStop(1, "rgba(253,224,71,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) raf = requestAnimationFrame(frame);
    };

    resize();
    if (reduce) start = performance.now() - 7000 * 1; // static frame shows the finished lattice
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
