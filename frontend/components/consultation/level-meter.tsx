"use client";

import { useEffect, useRef } from "react";

const BARS = 5;

/** Live microphone level as a row of bars, drawn straight from the analyser so recording never re-renders React. */
export function LevelMeter({ analyser, className = "" }: { analyser: AnalyserNode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const data = new Uint8Array(analyser.frequencyBinCount);
    // Speech lives in the low bins; spread them across the bars, ignoring the near-silent top of the spectrum.
    const usable = Math.floor(data.length / 2);
    const smoothed = new Array<number>(BARS).fill(0);
    let raf = 0;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(canvas).color;
      const gap = 2, bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        const from = Math.floor((i / BARS) * usable), to = Math.floor(((i + 1) / BARS) * usable);
        let sum = 0;
        for (let j = from; j < to; j++) sum += data[j];
        // Speech energy sits well below full scale; a little gain keeps the bars readable at a normal voice.
        const level = Math.min(1, (sum / Math.max(1, to - from) / 255) * 2.5);
        smoothed[i] = Math.max(level, smoothed[i] * 0.85); // fast attack, slow release
        const bh = Math.max(2, smoothed[i] * h);
        const x = i * (bw + gap), y = (h - bh) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, 1);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return <canvas ref={ref} aria-hidden="true" className={`h-4 w-7 ${className}`} />;
}
