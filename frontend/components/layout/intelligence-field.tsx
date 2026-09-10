/**
 * Abstract "clinical intelligence" field: nested isolines around two soft attractors, like imaging
 * contours or strata of data. Deterministic (seeded), so server and client render the same markup.
 * Nothing here depicts anatomy or a patient.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

interface Blob {
  cx: number;
  cy: number;
  rings: number;
  step: number;
  base: number;
  harmonics: { k: number; amp: number; phase: number }[];
}

function contour(b: Blob, ring: number, samples = 160): string {
  const r0 = b.base + ring * b.step;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    // Harmonic distortion grows with the ring so outer lines wander more than inner ones.
    const wobble = b.harmonics.reduce((acc, h) => acc + h.amp * (0.4 + ring / b.rings) * Math.sin(h.k * t + h.phase), 0);
    const r = r0 * (1 + wobble);
    pts.push(`${(b.cx + r * Math.cos(t)).toFixed(1)} ${(b.cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function IntelligenceField({ className = "" }: { className?: string }) {
  const rand = rng(20260910);
  const blobs: Blob[] = [
    { cx: 430, cy: 380, rings: 26, step: 17, base: 22, harmonics: [] },
    { cx: 190, cy: 760, rings: 14, step: 19, base: 18, harmonics: [] },
  ];
  for (const b of blobs) {
    b.harmonics = [3, 5, 7, 11].map((k) => ({ k, amp: (0.012 + rand() * 0.03) / (k / 3), phase: rand() * Math.PI * 2 }));
  }
  const nodes = Array.from({ length: 14 }, () => {
    const b = blobs[rand() < 0.75 ? 0 : 1];
    const ring = Math.floor(rand() * b.rings);
    const t = rand() * Math.PI * 2;
    const r = b.base + ring * b.step;
    return { x: b.cx + r * Math.cos(t), y: b.cy + r * Math.sin(t), d: 1.2 + rand() * 1.6, delay: rand() * 6 };
  });

  return (
    <svg viewBox="0 0 720 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="if-glow" cx="0.58" cy="0.36" r="0.5">
          <stop offset="0" stopColor="#1f7a63" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#1f7a63" stopOpacity="0.08" />
          <stop offset="1" stopColor="#1f7a63" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="if-fade" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="if-mask">
          <rect width="720" height="1000" fill="url(#if-fade)" />
        </mask>
        <pattern id="if-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#fff" fillOpacity="0.07" />
        </pattern>
      </defs>

      <rect width="720" height="1000" fill="url(#if-dots)" />
      <rect width="720" height="1000" fill="url(#if-glow)" />

      <g mask="url(#if-mask)" className="if-drift" style={{ transformOrigin: "430px 380px" }}>
        {blobs.map((b, bi) =>
          Array.from({ length: b.rings }, (_, ring) => {
            const t = ring / b.rings;
            const accent = ring % 6 === 0;
            return (
              <path
                key={`${bi}-${ring}`}
                d={contour(b, ring)}
                fill="none"
                stroke={accent ? "#7fbba4" : "#b3d8c8"}
                strokeOpacity={(accent ? 0.55 : 0.28) * (1 - t * 0.7)}
                strokeWidth={accent ? 0.9 : 0.6}
                strokeLinejoin="round"
              />
            );
          }),
        )}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={n.d} fill="#7fbba4" className="if-node" style={{ animationDelay: `${n.delay}s` }} />
        ))}
      </g>
    </svg>
  );
}
