interface GaugeProps {
  pct: number;
  size?: number;
}

export function Gauge({ pct, size = 100 }: GaugeProps) {
  const r = size * 0.38;
  const c = 2 * Math.PI * r * 0.75;
  const offset = c * (1 - pct / 100);
  const color = pct < 20 ? '#D85A30' : pct < 50 ? '#EF9F27' : '#1D9E75';
  const h = size * 0.82;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      <circle
        cx={size / 2}
        cy={h * 0.56}
        r={r}
        fill="none"
        stroke="#E4E2D8"
        strokeWidth={size * 0.08}
        strokeDasharray={`${c} 999`}
        strokeLinecap="round"
        transform={`rotate(135 ${size / 2} ${h * 0.56})`}
      />
      <circle
        cx={size / 2}
        cy={h * 0.56}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.08}
        strokeDasharray={`${c} 999`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(135 ${size / 2} ${h * 0.56})`}
      />
      <text
        x={size / 2}
        y={h * 0.6}
        textAnchor="middle"
        className="font-mono-data"
        style={{ fontSize: size * 0.15, fontWeight: 500, fill: '#1C222C' }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
