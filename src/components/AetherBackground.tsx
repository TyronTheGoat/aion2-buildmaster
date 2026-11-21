"use client";
import { useEffect, useRef } from "react";

/**
 * Subtle, minimal background for the character picker: thin chevrons stream
 * upward and quiet "+CP" / "+GS" gains rise and fade. Kept low-contrast so the
 * character list stays in focus. Pure canvas; pauses when hidden and respects
 * "reduce motion".
 */
const CP_AMOUNTS: [number, number][] = [[10, 10], [20, 10], [50, 12], [100, 12], [250, 9], [500, 7], [1000, 5], [2500, 2]];
const GS_AMOUNTS: [number, number][] = [[1, 6], [2, 6], [5, 6], [10, 4], [20, 2]];
const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, system-ui, sans-serif`;

function pick(table: [number, number][]) {
  const sum = table.reduce((a, [, wt]) => a + wt, 0);
  let r = Math.random() * sum;
  for (const [v, wt] of table) if ((r -= wt) < 0) return v;
  return table[0][0];
}

type Arrow = { x: number; y: number; s: number; v: number; a: number; tint: number };
type Pop = { x: number; y: number; v: number; born: number; life: number; text: string; size: number; gs: boolean; strong: boolean };

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;
    let arrows: Arrow[] = [], pops: Pop[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const newArrow = (y = rand(0, h)): Arrow => ({
      x: rand(0, w), y, s: rand(5, 12), v: rand(70, 160), a: rand(0.07, 0.18), tint: Math.random(),
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      arrows = Array.from({ length: Math.min(80, Math.round((w * h) / 8000)) }, () => newArrow());
    }

    function spawn(t: number) {
      const gs = Math.random() < 0.25;
      const amount = gs ? pick(GS_AMOUNTS) : pick(CP_AMOUNTS);
      const strong = gs ? amount >= 10 : amount >= 500;
      const size = (gs ? 12 + Math.min(amount, 20) * 0.25 : 12 + Math.log10(amount) * 3.2) * (w < 640 ? 1 : 1.15);
      const text = `+${amount.toLocaleString("de-DE")} ${gs ? "GS" : "CP"}`;
      ctx.font = `600 ${size}px ${FONT}`;
      const half = ctx.measureText(text).width / 2 + 6;
      pops.push({
        x: rand(half, w - half), y: rand(h * 0.45, h + 10), v: rand(60, 110),
        born: t, life: rand(2.2, 3.2), text, size, gs, strong,
      });
    }

    function chevron(x: number, y: number, s: number) {
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.55);
      ctx.lineTo(x, y - s * 0.45);
      ctx.lineTo(x + s, y + s * 0.55);
      ctx.stroke();
    }

    const start = performance.now();
    let last = start, acc = 0;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // near-black base with a soft cool glow at the bottom
      ctx.fillStyle = "#08090c";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 1.1, 0, w * 0.5, h * 1.1, Math.max(w, h) * 0.9);
      glow.addColorStop(0, "rgba(120,140,160,0.10)");
      glow.addColorStop(1, "rgba(120,140,160,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // thin chevrons streaming up, with a gentle surge every few seconds
      const surge = 1 + 0.45 * Math.max(0, Math.sin(t * 1.3));
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const a of arrows) {
        a.y -= a.v * surge * dt;
        if (a.y < -20) Object.assign(a, newArrow(h + 20));
        const fade = Math.min(1, a.y / (h * 0.5)); // fainter towards the top
        ctx.strokeStyle = a.tint < 0.7
          ? `rgba(255,255,255,${a.a * fade})`
          : `rgba(134,239,172,${a.a * 1.1 * fade})`;
        chevron(a.x, a.y, a.s);
        chevron(a.x, a.y + a.s * 0.95, a.s);
      }

      // quiet +CP / +GS gains
      acc += (w < 640 ? 2.6 : 4) * surge * dt;
      while (acc >= 1) { acc -= 1; spawn(t); }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      pops = pops.filter((p) => t - p.born < p.life);
      for (const p of pops) {
        const age = t - p.born, k = age / p.life;
        p.y -= p.v * surge * dt;
        const ease = 1 - Math.pow(1 - Math.min(1, age / 0.35), 3);
        const top = Math.min(1, Math.max(0, (p.y - h * 0.1) / (h * 0.35)));
        const alpha = ease * (k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1) * top * (p.strong ? 0.7 : 0.45);
        ctx.font = `${p.strong ? 600 : 500} ${p.size}px ${FONT}`;
        ctx.fillStyle = p.gs
          ? `rgba(147,197,253,${alpha})`                 // soft blue for GS
          : p.strong ? `rgba(253,230,138,${alpha})`      // soft gold for big CP
            : `rgba(220,252,231,${alpha})`;              // near-white mint for CP
        ctx.fillText(p.text, p.x, p.y + (1 - ease) * 8);
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
    if (reduce) for (let i = 0; i < 8; i++) spawn(-rand(0.4, 1.2));
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
