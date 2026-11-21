"use client";
import { useEffect, useRef } from "react";

/**
 * Endless start-screen animation: "+1.000 CP", "+50 CP", "+10 GS" … pop in
 * with a punch, shoot upward and fade. Big gains glow gold and burst into
 * sparks; every few seconds a combo fires several gains from one spot.
 * Pure canvas; pauses when hidden and respects "reduce motion".
 */
const CP_AMOUNTS: [number, number][] = [[10, 10], [20, 10], [50, 12], [100, 12], [250, 9], [500, 7], [1000, 5], [2500, 2]];
const GS_AMOUNTS: [number, number][] = [[1, 6], [2, 6], [5, 6], [10, 4], [20, 2]];

function pick(table: [number, number][]) {
  const sum = table.reduce((a, [, wt]) => a + wt, 0);
  let r = Math.random() * sum;
  for (const [v, wt] of table) if ((r -= wt) < 0) return v;
  return table[0][0];
}

type Pop = {
  x: number; y: number; vx: number; vy: number; born: number; life: number;
  text: string; size: number; color: [number, number, number]; glow: boolean; rot: number; wob: number;
};
type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number; hue: number };

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;
    let pops: Pop[] = [], sparks: Spark[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(t: number, x = rand(16, w - 16), y = rand(h * 0.35, h + 20)) {
      const gs = Math.random() < 0.25;
      const amount = gs ? pick(GS_AMOUNTS) : pick(CP_AMOUNTS);
      const tier = gs ? (amount >= 10 ? 2 : amount >= 5 ? 1 : 0) : amount >= 1000 ? 3 : amount >= 250 ? 2 : amount >= 50 ? 1 : 0;
      const scale = w < 640 ? 1 : 1.25;
      const size = [14, 18, 24, 34][tier] * scale * rand(0.9, 1.1);
      const color: [number, number, number] = gs
        ? [195 + tier * 5, 95, 62]            // GS: cyan/blue
        : tier >= 3 ? [45, 100, 60]           // big CP: gold
          : tier === 2 ? [38, 95, 58]         // orange-gold
            : [142, 75, 58];                  // small CP: green
      // keep the whole label on screen
      ctx.font = `900 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
      const label = `+${amount.toLocaleString("de-DE")} ${gs ? "GS" : "CP"}`;
      const half = ctx.measureText(label).width / 2 + 8;
      x = Math.min(w - half, Math.max(half, x));
      pops.push({
        x, y, vx: rand(-12, 12), vy: rand(70, 130) + tier * 25, born: t, life: rand(1.6, 2.4) + tier * 0.3,
        text: label, size, color, glow: tier >= 2,
        rot: rand(-0.12, 0.12), wob: rand(0, Math.PI * 2),
      });
      if (tier >= 3) {
        for (let i = 0; i < 26; i++) {
          const a = rand(0, Math.PI * 2), v = rand(60, 220);
          sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, born: t, life: rand(0.5, 1), hue: rand(35, 55) });
        }
      }
    }

    const start = performance.now();
    let last = start, acc = 0, nextCombo = 1.5;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // spawn rate pulses up and down for a "rush" feeling
      const rate = (w < 640 ? 9 : 14) * (1 + 0.4 * Math.sin(t * 0.9));
      acc += rate * dt;
      while (acc >= 1) { acc -= 1; spawn(t); }
      if (t >= nextCombo) {
        const x = rand(w * 0.15, w * 0.85), y = rand(h * 0.5, h * 0.9);
        const n = Math.floor(rand(4, 8));
        for (let i = 0; i < n; i++) spawn(t + i * 0.001, x + rand(-110, 110), y + i * 26);
        nextCombo = t + rand(2, 3.5);
      }

      // background with a faint rising sheen
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0d1110");
      bg.addColorStop(0.6, "#0a0b11");
      bg.addColorStop(1, "#060609");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const sheenY = h - ((t * 120) % (h + 400)) + 200;
      const sheen = ctx.createLinearGradient(0, sheenY - 200, 0, sheenY + 200);
      sheen.addColorStop(0, "rgba(74,222,128,0)");
      sheen.addColorStop(0.5, "rgba(74,222,128,0.04)");
      sheen.addColorStop(1, "rgba(74,222,128,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, sheenY - 200, w, 400);

      // sparks
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      sparks = sparks.filter((s) => t - s.born < s.life);
      for (const s of sparks) {
        const k = (t - s.born) / s.life;
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 140 * dt; s.vx *= 0.98;
        ctx.fillStyle = `hsla(${s.hue},100%,65%,${1 - k})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * (1 - k) + 0.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // numbers
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      pops = pops.filter((p) => t - p.born < p.life && p.y > -60);
      for (const p of pops) {
        const age = t - p.born, k = age / p.life;
        p.vy *= 1 + 0.6 * dt; // accelerate upward like a rocket
        p.y -= p.vy * dt;
        p.x += (p.vx + Math.sin(age * 6 + p.wob) * 10) * dt;
        // punchy pop-in: overshoot, then settle
        const pin = Math.min(1, age / 0.22);
        const scale = pin < 1 ? 0.3 + 1.0 * Math.sin(pin * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) * 1.15 : 1;
        // fade out towards the top so the header text stays readable
        const top = Math.min(1, Math.max(0, (p.y - h * 0.12) / (h * 0.3)));
        const alpha = Math.min(1, age / 0.1) * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1) * (0.15 + 0.85 * top);
        const [hh, ss, ll] = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * (1 - k));
        ctx.scale(scale, scale);
        ctx.font = `900 ${p.size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
        if (p.glow) {
          ctx.shadowColor = `hsla(${hh},${ss}%,${ll}%,${0.9 * alpha})`;
          ctx.shadowBlur = 18;
        }
        ctx.lineWidth = Math.max(2, p.size * 0.12);
        ctx.strokeStyle = `rgba(0,0,0,${0.55 * alpha})`;
        ctx.strokeText(p.text, 0, 0);
        const g = ctx.createLinearGradient(0, -p.size / 2, 0, p.size / 2);
        g.addColorStop(0, `hsla(${hh},${ss}%,${Math.min(92, ll + 25)}%,${alpha})`);
        g.addColorStop(1, `hsla(${hh},${ss}%,${ll}%,${alpha})`);
        ctx.fillStyle = g;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
    if (reduce) {
      // still image: a handful of gains frozen mid-flight
      for (let i = 0; i < 14; i++) spawn(-rand(0.3, 1.2));
    }
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
