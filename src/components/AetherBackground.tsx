"use client";
import { useEffect, useRef } from "react";

/**
 * Hologram background for the character picker: a deep-blue perspective grid that
 * drifts toward the viewer, softly rising light particles and a slow scan line.
 * Low contrast so the character list stays in focus. Pure canvas; pauses when
 * hidden and respects "reduce motion".
 */
type Mote = { x: number; y: number; r: number; v: number; a: number; ph: number };

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;
    let motes: Mote[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const newMote = (y = rand(0, h)): Mote => ({ x: rand(0, w), y, r: rand(0.6, 1.8), v: rand(8, 26), a: rand(0.15, 0.55), ph: rand(0, 6.28) });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: Math.min(90, Math.round((w * h) / 12000)) }, () => newMote());
    }

    const start = performance.now();
    let last = start;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // deep navy base with a cool glow behind the list
      ctx.fillStyle = "#03070f";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.75);
      glow.addColorStop(0, "rgba(40,120,255,0.16)");
      glow.addColorStop(0.5, "rgba(20,70,180,0.06)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // perspective grid floor
      const horizon = h * 0.58, cx = w / 2;
      ctx.lineWidth = 1;
      const rows = 18, speed = reduce ? 0 : 0.12;
      for (let i = 0; i < rows; i++) {
        const z = ((i + (t * speed) % 1) / rows);
        const y = horizon + (h - horizon) * z * z;
        ctx.strokeStyle = `rgba(70,160,255,${0.03 + z * 0.16})`;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = -14; i <= 14; i++) {
        const xb = cx + i * (w / 9);
        const a = 0.05 + 0.1 * (1 - Math.abs(i) / 14);
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        grad.addColorStop(0, "rgba(70,160,255,0)");
        grad.addColorStop(1, `rgba(70,160,255,${a})`);
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(cx + i * 6, horizon); ctx.lineTo(xb, h); ctx.stroke();
      }
      const hz = ctx.createLinearGradient(0, 0, w, 0);
      hz.addColorStop(0, "rgba(90,180,255,0)"); hz.addColorStop(0.5, "rgba(90,180,255,0.35)"); hz.addColorStop(1, "rgba(90,180,255,0)");
      ctx.fillStyle = hz;
      ctx.fillRect(0, horizon - 0.5, w, 1);

      // slow scan line
      if (!reduce) {
        const sy = ((t * 0.08) % 1.2) * h - h * 0.1;
        const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 2);
        sg.addColorStop(0, "rgba(80,170,255,0)");
        sg.addColorStop(1, "rgba(80,170,255,0.07)");
        ctx.fillStyle = sg;
        ctx.fillRect(0, sy - 60, w, 62);
        ctx.fillStyle = "rgba(140,210,255,0.18)";
        ctx.fillRect(0, sy, w, 1);
      }

      // rising light particles
      for (const m of motes) {
        m.y -= m.v * dt;
        if (m.y < -10) Object.assign(m, newMote(h + 10));
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + m.ph);
        ctx.fillStyle = `rgba(120,200,255,${m.a * tw})`;
        ctx.beginPath(); ctx.arc(m.x + Math.sin(t * 0.5 + m.ph) * 6, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
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
