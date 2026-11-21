"use client";
import { useEffect, useRef } from "react";

/**
 * Looping start-screen animation (10 s): a small "Combat Power" box whose
 * counter and bar shoot up like a rocket, "+10 … +1000" gains popping out
 * and floating up, and upward arrows streaming everywhere. At the top the
 * bar flashes and the loop starts again. Pure canvas; pauses when hidden
 * and respects "reduce motion".
 */
const CYCLE = 10;
const BASE_CP = 180_000;
const AMOUNTS = [10, 20, 50, 100, 250, 500, 1000];

type Arrow = { x: number; y: number; s: number; v: number; a: number; hue: number };
type Pop = { x: number; y: number; vy: number; born: number; text: string; size: number; hue: number; life: number };
type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number };

export function AetherBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;
    let arrows: Arrow[] = [], pops: Pop[] = [], sparks: Spark[] = [];
    let box = { x: 0, y: 0, w: 0, h: 0 };
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

    /** Gain events for one cycle: they come faster and get bigger towards the end. */
    let events: { t: number; amount: number }[] = [];
    function planCycle() {
      events = [];
      let t = 0.4;
      while (t < CYCLE - 1.4) {
        const p = t / CYCLE;
        const idx = Math.min(AMOUNTS.length - 1, Math.floor(Math.pow(Math.random(), 1.4 - p) * AMOUNTS.length * (0.45 + p * 0.7)));
        events.push({ t, amount: AMOUNTS[idx] });
        t += rand(0.12, 0.55) * (1.1 - p * 0.75);
      }
    }
    const total = () => events.reduce((a, e) => a + e.amount, 0);

    const newArrow = (y = rand(0, h)): Arrow => ({
      x: rand(0, w), y, s: rand(6, 16), v: rand(30, 90), a: rand(0.05, 0.16),
      hue: Math.random() < 0.6 ? rand(130, 155) : rand(40, 50),
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = w < 640;
      const bw = Math.min(300, w * 0.8), bh = 180;
      box = { x: (mobile ? w * 0.5 : w * 0.72) - bw / 2, y: (mobile ? h * 0.7 : h * 0.5) - bh / 2, w: bw, h: bh };
      arrows = Array.from({ length: Math.min(70, Math.round((w * h) / 9000)) }, () => newArrow());
    }

    function chevron(x: number, y: number, s: number) {
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.6);
      ctx.lineTo(x, y - s * 0.4);
      ctx.lineTo(x + s, y + s * 0.6);
      ctx.stroke();
    }

    function roundRect(x: number, y: number, ww: number, hh: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, r);
      ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + ww, y, r);
      ctx.closePath();
    }

    let start = performance.now(), last = start, lastCycle = -1, fired = 0, carried = 0;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cycle = Math.floor(t / CYCLE), c = t % CYCLE;
      if (cycle !== lastCycle) {
        // CP keeps climbing across loops; only the bar starts over
        if (lastCycle >= 0) carried += events.reduce((a, e) => a + e.amount, 0);
        if (carried > 400_000) carried = 0;
        lastCycle = cycle; planCycle(); fired = 0;
      }

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0f1512");
      bg.addColorStop(0.6, "#0b0c12");
      bg.addColorStop(1, "#060609");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // arrows streaming upward
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const a of arrows) {
        a.y -= a.v * dt * (1 + (c / CYCLE) * 0.8);
        if (a.y < -20) Object.assign(a, newArrow(h + 20));
        ctx.strokeStyle = `hsla(${a.hue},85%,60%,${a.a})`;
        chevron(a.x, a.y, a.s);
        chevron(a.x, a.y + a.s * 0.9, a.s);
      }

      // fire due gain events
      const bx = box.x, by = box.y, bw = box.w, bh = box.h;
      const barX = bx + bw - 46, barY = by + 30, barW = 26, barH = bh - 48;
      while (fired < events.length && events[fired].t <= c) {
        const e = events[fired++];
        const big = e.amount >= 500, mid = e.amount >= 100;
        pops.push({
          x: bx + rand(14, bw - 60), y: by - 6, vy: rand(40, 70), born: t, life: 1.8,
          text: `+${e.amount.toLocaleString("de-DE")}`, size: big ? 22 : mid ? 17 : 14,
          hue: big ? 45 : mid ? 140 : 150,
        });
        // ambient gains elsewhere on screen
        if (Math.random() < 0.6) {
          const amt = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
          const px = rand(20, w - 60);
          let py = rand(h * 0.3, h);
          // keep ambient gains off the CP box so its numbers stay readable
          if (px > bx - 70 && px < bx + bw + 10 && py > by - 10 && py < by + bh + 60) py = by + bh + rand(70, 180);
          pops.push({ x: px, y: py, vy: rand(25, 45), born: t, life: 2.4,
            text: `+${amt.toLocaleString("de-DE")}`, size: 12 + (amt >= 500 ? 6 : amt >= 100 ? 3 : 0), hue: amt >= 500 ? 45 : 145 });
        }
      }

      const gained = events.slice(0, fired).reduce((a, e) => a + e.amount, 0);
      const T = total() || 1;
      // bar progress follows the gains, with a quick drain/reset at the end of the loop
      const resetK = Math.max(0, (c - (CYCLE - 0.6)) / 0.6);
      const prog = Math.min(1, gained / T) * (1 - resetK);
      const flash = Math.max(0, 1 - Math.abs(c - (CYCLE - 1.2)) / 0.5);

      // the CP box
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 24;
      roundRect(bx, by, bw, bh, 16);
      ctx.fillStyle = "rgba(14,18,22,0.82)";
      ctx.fill();
      ctx.restore();
      roundRect(bx, by, bw, bh, 16);
      ctx.strokeStyle = `rgba(${120 + flash * 135},${200 + flash * 30},${140 - flash * 70},${0.35 + flash * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(161,161,170,0.9)";
      ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("COMBAT POWER", bx + 18, by + 34);
      ctx.fillStyle = flash > 0.05 ? `rgb(253,${224 - flash * 20},${120})` : "#f4f4f5";
      ctx.font = `800 ${Math.min(36, bw * 0.12)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(fmt(BASE_CP + carried + gained), bx + 18, by + 78);
      const lastGain = fired ? events[fired - 1].amount : 0;
      ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`▲ +${fmt(gained)}`, bx + 18, by + 108);
      if (lastGain) {
        ctx.fillStyle = "rgba(74,222,128,0.6)";
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(`letzter Gewinn +${fmt(lastGain)}`, bx + 18, by + 132);
      }

      // rocket bar
      roundRect(barX, barY, barW, barH, 10);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      const fillH = Math.max(0, barH * prog);
      if (fillH > 1) {
        ctx.save();
        roundRect(barX, barY, barW, barH, 10);
        ctx.clip();
        const gr = ctx.createLinearGradient(0, barY + barH, 0, barY);
        gr.addColorStop(0, "#16a34a");
        gr.addColorStop(0.6, "#4ade80");
        gr.addColorStop(1, "#fde047");
        ctx.fillStyle = gr;
        ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
        ctx.restore();
        // rocket tip
        const tipY = barY + barH - fillH;
        const glow = ctx.createRadialGradient(barX + barW / 2, tipY, 0, barX + barW / 2, tipY, 26);
        glow.addColorStop(0, "rgba(253,224,71,0.7)");
        glow.addColorStop(1, "rgba(253,224,71,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(barX + barW / 2, tipY, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fef9c3";
        ctx.beginPath();
        ctx.moveTo(barX + barW / 2, tipY - 14);
        ctx.lineTo(barX + barW / 2 + 7, tipY - 1);
        ctx.lineTo(barX + barW / 2 - 7, tipY - 1);
        ctx.closePath(); ctx.fill();
        if (prog < 0.999 && resetK === 0) {
          for (let i = 0; i < 2; i++) sparks.push({ x: barX + barW / 2 + rand(-4, 4), y: tipY, vx: rand(-25, 25), vy: rand(30, 90), born: t, life: rand(0.3, 0.6) });
        }
      }

      // sparks from the rocket tip
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      sparks = sparks.filter((s) => t - s.born < s.life);
      for (const s of sparks) {
        const k = (t - s.born) / s.life;
        s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.fillStyle = `rgba(253,${200 - k * 120},80,${0.8 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2 * (1 - k) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // flash when the bar reaches the top
      if (flash > 0) {
        const g2 = ctx.createRadialGradient(bx + bw / 2, by + bh / 2, 0, bx + bw / 2, by + bh / 2, bw);
        g2.addColorStop(0, `rgba(253,224,71,${0.22 * flash})`);
        g2.addColorStop(1, "rgba(253,224,71,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(bx - bw, by - bw, bw * 3, bh + bw * 2);
      }

      // floating "+N" gains
      pops = pops.filter((p) => t - p.born < p.life);
      for (const p of pops) {
        const k = (t - p.born) / p.life;
        p.y -= p.vy * dt;
        ctx.font = `800 ${p.size}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = `hsla(${p.hue},90%,62%,${Math.min(1, (1 - k) * 1.6) * 0.95})`;
        ctx.fillText(p.text, p.x, p.y);
      }

      if (running && !reduce) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      running = !document.hidden;
      cancelAnimationFrame(raf);
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    resize();
    if (reduce) start = performance.now() - 8500;
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
