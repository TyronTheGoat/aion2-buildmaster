"use client";
import { useEffect, useRef } from "react";

/**
 * Original animated fantasy backdrop for the start screen: drifting aurora
 * ribbons, a slowly turning arcane circle, soft light rays and rising sparks.
 * Pure canvas, no game assets. Pauses when the tab is hidden and respects
 * "reduce motion".
 */
export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;

    type Spark = { x: number; y: number; r: number; vy: number; vx: number; phase: number; hue: number };
    let sparks: Spark[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const HUES = [42, 48, 190, 265, 280];
    const newSpark = (y = rand(0, h)): Spark => ({
      x: rand(0, w), y, r: rand(0.5, 2), vy: rand(6, 24), vx: rand(-4, 4), phase: rand(0, Math.PI * 2),
      hue: HUES[Math.floor(Math.random() * HUES.length)] + rand(-6, 6),
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparks = Array.from({ length: Math.min(120, Math.round((w * h) / 7000)) }, () => newSpark());
    }

    function base() {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#14121f");
      g.addColorStop(0.5, "#0d0c18");
      g.addColorStop(1, "#06060b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    /** Soft flowing ribbons of light (aurora). */
    function aurora(t: number) {
      const bands = [
        { y: 0.22, amp: 0.05, speed: 0.12, hue: 45, alpha: 0.11, thick: 0.16 },
        { y: 0.38, amp: 0.07, speed: -0.09, hue: 270, alpha: 0.12, thick: 0.2 },
        { y: 0.62, amp: 0.06, speed: 0.07, hue: 190, alpha: 0.07, thick: 0.18 },
      ];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const b of bands) {
        const steps = 60;
        const curve = (x: number, off: number) =>
          h * (b.y + off + b.amp * Math.sin((x / w) * Math.PI * 1.6 + t * b.speed * 3)
            + b.amp * 0.35 * Math.sin((x / w) * Math.PI * 3.1 - t * b.speed * 4));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w;
          if (i === 0) ctx.moveTo(x, curve(x, 0)); else ctx.lineTo(x, curve(x, 0));
        }
        for (let i = steps; i >= 0; i--) {
          const x = (i / steps) * w;
          ctx.lineTo(x, curve(x, b.thick));
        }
        ctx.closePath();
        const g = ctx.createLinearGradient(0, h * (b.y - b.amp), 0, h * (b.y + b.thick + b.amp));
        g.addColorStop(0, `hsla(${b.hue},90%,65%,0)`);
        g.addColorStop(0.35, `hsla(${b.hue},90%,65%,${b.alpha})`);
        g.addColorStop(1, `hsla(${b.hue},90%,50%,0)`);
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
    }

    /** A faint, slowly turning circle of glyph-like marks. */
    function circle(t: number) {
      const cx = w * 0.82, cy = h * 0.16, R = Math.min(w, h) * 0.32;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(251,191,36,0.10)";
      ctx.lineWidth = 1;
      for (const [r, dir] of [[R, 1], [R * 0.78, -1], [R * 0.5, 1]] as const) {
        ctx.save();
        ctx.rotate(t * 0.04 * dir);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        const n = Math.round(r / 9);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const len = i % 3 === 0 ? 8 : 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len));
          ctx.stroke();
        }
        ctx.restore();
      }
      // inner star
      ctx.rotate(-t * 0.03);
      ctx.beginPath();
      for (let i = 0; i <= 7; i++) {
        const a = (i * 3 * Math.PI * 2) / 7;
        const x = Math.cos(a) * R * 0.48, y = Math.sin(a) * R * 0.48;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(196,181,253,0.08)";
      ctx.stroke();
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
      glow.addColorStop(0, `rgba(251,191,36,${0.10 + 0.04 * Math.sin(t * 0.6)})`);
      glow.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function rays(t: number) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const len = Math.max(w, h) * 1.4;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(w * 0.82, h * 0.16);
        ctx.rotate(Math.PI * 0.62 + i * 0.2 + Math.sin(t * 0.07 + i) * 0.05);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, `rgba(255,228,170,${0.035 + 0.015 * Math.sin(t * 0.5 + i * 1.7)})`);
        g.addColorStop(1, "rgba(255,228,170,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len * 0.035); ctx.lineTo(len, len * 0.035); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      base();
      aurora(t);
      rays(t);
      circle(t);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of sparks) {
        s.y -= s.vy * dt;
        s.x += (s.vx + Math.sin(t * 0.7 + s.phase) * 5) * dt;
        if (s.y < -10) Object.assign(s, newSpark(h + 10));
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.phase);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        g.addColorStop(0, `hsla(${s.hue},95%,75%,${0.7 * tw})`);
        g.addColorStop(1, `hsla(${s.hue},95%,60%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
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
