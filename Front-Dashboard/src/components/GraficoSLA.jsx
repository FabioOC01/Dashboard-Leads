import { useState, useEffect } from 'react';

export default function GraficoSLA({ atendidos, total }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const pct = total > 0 ? Math.round((atendidos / total) * 100) : 0;

  useEffect(() => {
    const t = setTimeout(() => setAnimatedPct(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);

  const R = 105, CX = 130, CY = 110;
  const polar = (a) => ({ x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) });
  const toA = (p) => Math.PI + (p / 100) * Math.PI;
  const startPt = polar(Math.PI);
  const endPt = polar(2 * Math.PI);

  const arcLen = Math.PI * R;
  const dashOffset = arcLen - (animatedPct / 100) * arcLen;
  const colorRaw = pct > 70 ? '#10b981' : pct > 40 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150%', width: '100%' }}>
      <svg width="180%" height="200%" viewBox="0 0 260 140" style={{ overflow: 'visible', maxWidth: 300 }}>
        {/* Track */}
        <path
          d={`M ${startPt.x} ${startPt.y} A ${R} ${R} 0 0 1 ${endPt.x} ${endPt.y}`}
          fill="none" stroke="var(--track)" strokeWidth={14} strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${startPt.x} ${startPt.y} A ${R} ${R} 0 0 1 ${endPt.x} ${endPt.y}`}
          fill="none" stroke={animatedPct > 0 ? colorRaw : "transparent"} strokeWidth={14} strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 10px ${colorRaw}80)`, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
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
        {/* Percentage */}
        <text x={CX - -2} y={CY - 10} textAnchor="middle" fill={colorRaw}
          style={{ fontSize: 48, fontWeight: 800, fontFamily: 'Plus Jakarta Sans', letterSpacing: -1 }}>
          {pct}%
        </text>


        {/* Min/Max labels */}
        <text x={CX - R} y={CY + 35} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans', fontWeight: 500 }}>0%</text>
        <text x={CX + R} y={CY + 35} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans', fontWeight: 500 }}>100%</text>

        {/* Ratio inside SVG directly */}
        <text x={CX} y={CY + 32} textAnchor="middle" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          <tspan fill={colorRaw} fontWeight="700" fontSize="13">{atendidos}</tspan>
          <tspan fill="var(--text-dim)" opacity="0.5" fontSize="13"> / </tspan>
          <tspan fill="var(--text-main)" opacity="0.8" fontWeight="600" fontSize="13">{total}</tspan>
          <tspan fill="var(--text-dim)" opacity="0.7" fontSize="11"> leads</tspan>
        </text>
      </svg>
    </div>
  );
}
