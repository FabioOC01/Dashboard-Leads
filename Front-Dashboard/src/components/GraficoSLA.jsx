import { useState, useEffect, useRef } from 'react';

export default function GraficoSLA({ atendidos, total }) {
  const pct = total > 0 ? Math.round((atendidos / total) * 100) : 0;
  const [displayPct, setDisplayPct] = useState(0);
  const [arcPct, setArcPct]         = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const delay = setTimeout(() => {
      const start = performance.now();
      const duration = 1100;
      const from = 0;
      const to = pct;

      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayPct(Math.round(from + (to - from) * eased));
        setArcPct(from + (to - from) * eased);
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 150);

    return () => {
      clearTimeout(delay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pct]);

  const R = 105, CX = 130, CY = 110;
  const polar = (a) => ({ x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) });
  const toA   = (p) => Math.PI + (p / 100) * Math.PI;

  const startPt = polar(Math.PI);
  const endPt   = polar(2 * Math.PI);

  const arcLen    = Math.PI * R;
  const dashOffset = arcLen - (arcPct / 100) * arcLen;

  // Dot at the tip of the arc
  const tipAngle = toA(arcPct);
  const tipPt    = polar(tipAngle);

  const colorRaw = pct >= 70 ? '#10b981' : pct > 50 ? '#f59e0b' : '#f43f5e';

  return (
    <>
      <style>{`
        @keyframes slaGlow {
          0%, 100% { opacity: 1;   filter: drop-shadow(0 0 10px ${colorRaw}80); }
          50%      { opacity: 0.7; filter: drop-shadow(0 0 20px ${colorRaw}cc); }
        }
        @keyframes dotPulse {
          0%, 100% { r: 5; opacity: 1; }
          50%       { r: 8; opacity: 0.6; }
        }
        .sla-arc     { animation: slaGlow 2.4s ease-in-out infinite; }
        .sla-dot     { animation: dotPulse 1.6s ease-in-out infinite; }
        @keyframes slaNumPop {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
        .sla-num { transform-origin: center; animation: slaNumPop 0.6s cubic-bezier(.34,1.56,.64,1) 0.9s both; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150%', width: '100%' }}>
        <svg width="180%" height="200%" viewBox="0 0 260 140" style={{ overflow: 'visible', maxWidth: 300 }}>
          {/* Track */}
          <path
            d={`M ${startPt.x} ${startPt.y} A ${R} ${R} 0 0 1 ${endPt.x} ${endPt.y}`}
            fill="none" stroke="var(--track)" strokeWidth={14} strokeLinecap="round"
          />

          {/* Value arc */}
          <path
            className="sla-arc"
            d={`M ${startPt.x} ${startPt.y} A ${R} ${R} 0 0 1 ${endPt.x} ${endPt.y}`}
            fill="none" stroke={arcPct > 0 ? colorRaw : 'transparent'}
            strokeWidth={14} strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1), stroke 0.4s' }}
          />

          {/* Dot at arc tip */}
          {arcPct > 1 && (
            <circle
              className="sla-dot"
              cx={tipPt.x} cy={tipPt.y} r={5}
              fill={colorRaw}
              style={{ filter: `drop-shadow(0 0 6px ${colorRaw})` }}
            />
          )}

          {/* Zone markers */}
          {[40, 70].map((z, i) => {
            const a = toA(z);
            const inner = { x: CX + (R - 10) * Math.cos(a), y: CY + (R - 10) * Math.sin(a) };
            const outer = { x: CX + (R + 10) * Math.cos(a), y: CY + (R + 10) * Math.sin(a) };
            return (
              <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="var(--border-mid)" strokeWidth={2} />
            );
          })}

          {/* Percentage — animated count-up */}
          <text
            className="sla-num"
            x={CX - -2} y={CY - 10}
            textAnchor="middle" fill={colorRaw}
            style={{ fontSize: 48, fontWeight: 800, fontFamily: 'Plus Jakarta Sans', letterSpacing: -1 }}
          >
            {displayPct}%
          </text>

          {/* Min/Max labels */}
          <text x={CX - R} y={CY + 35} textAnchor="middle"
            style={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans', fontWeight: 500 }}>0%</text>
          <text x={CX + R} y={CY + 35} textAnchor="middle"
            style={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans', fontWeight: 500 }}>100%</text>

          {/* Ratio */}
          <text x={CX} y={CY + 32} textAnchor="middle" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <tspan fill={colorRaw} fontWeight="700" fontSize="13">{atendidos}</tspan>
            <tspan fill="var(--text-dim)" opacity="0.5" fontSize="13"> / </tspan>
            <tspan fill="var(--text-main)" opacity="0.8" fontWeight="600" fontSize="13">{total}</tspan>
            <tspan fill="var(--text-dim)" opacity="0.7" fontSize="11"> leads</tspan>
          </text>
        </svg>
      </div>
    </>
  );
}
