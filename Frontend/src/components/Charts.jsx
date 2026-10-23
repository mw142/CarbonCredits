import { useState } from 'react';

/* Small dependency-free SVG charts in the renewCo. palette. */

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

function niceMax(value) {
  if (!value || value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

export function compact(value, locale = 'en-AU') {
  if (value == null) return '—';
  return Number(value).toLocaleString(locale, { notation: 'compact', maximumFractionDigits: 1 });
}

/**
 * Vertical bar chart. `series` = [{ key, label }]; stacked when more than one series.
 */
export function BarChart({ data, xKey, series, height = 220, locale, format = compact, ariaLabel }) {
  const [hover, setHover] = useState(null);
  if (!data?.length) return null;
  const width = 640;
  const pad = { top: 16, right: 8, bottom: 30, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const totals = data.map((d) => series.reduce((s, ser) => s + (Number(d[ser.key]) || 0), 0));
  const max = niceMax(Math.max(...totals));
  const band = innerW / data.length;
  const barW = Math.max(4, Math.min(42, band * 0.62));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => {
          const y = pad.top + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line className="grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="axis-label">{format(tick, locale)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + band * i + (band - barW) / 2;
          let y = pad.top + innerH;
          return (
            <g key={d[xKey]} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent" />
              {series.map((ser, si) => {
                const v = Number(d[ser.key]) || 0;
                const h = (v / max) * innerH;
                y -= h;
                const isTop = si === series.length - 1 || series.slice(si + 1).every((s) => !Number(d[s.key]));
                return h > 0 ? <rect key={ser.key} x={x} y={y} width={barW} height={h} rx={isTop ? 3 : 0} fill={ser.color || SERIES[si]} opacity={hover == null || hover === i ? 1 : 0.45} /> : null;
              })}
              {i % labelEvery === 0 ? <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="axis-label">{d[xKey]}</text> : null}
            </g>
          );
        })}
      </svg>
      {hover != null ? (
        <div className="card" style={{ position: 'absolute', top: 0, right: 0, padding: '8px 12px', fontSize: 12.5, pointerEvents: 'none' }}>
          <strong>{data[hover][xKey]}</strong>
          {series.map((ser, si) => <div key={ser.key}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ser.color || SERIES[si], marginRight: 6 }} />{ser.label}: <span className="mono">{format(data[hover][ser.key], locale)}</span></div>)}
        </div>
      ) : null}
      {series.length > 1 ? <div className="legend">{series.map((ser, si) => <span key={ser.key}><i style={{ background: ser.color || SERIES[si] }} />{ser.label}</span>)}</div> : null}
    </div>
  );
}

/** Line chart with soft area fill, for price history. */
export function LineChart({ data, xKey = 'date', yKey = 'price', height = 200, format = (v) => v?.toFixed?.(2), ariaLabel }) {
  const [hover, setHover] = useState(null);
  if (!data?.length) return null;
  const width = 640;
  const pad = { top: 14, right: 12, bottom: 28, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = data.map((d) => Number(d[yKey]));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.15; max += span * 0.15;
  const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - ((v - min) / (max - min)) * innerH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[yKey]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${pad.top + innerH} L${x(0).toFixed(1)} ${pad.top + innerH} Z`;
  const ticks = [0, 0.5, 1].map((f) => min + f * (max - min));
  const labelIdx = data.length <= 2 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const id = `lc-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - box.left) / box.width) * width;
        const i = Math.round(((px - pad.left) / innerW) * (data.length - 1));
        setHover(Math.max(0, Math.min(data.length - 1, i)));
      }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2bb39a" stopOpacity=".28" />
          <stop offset="1" stopColor="#2bb39a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
          <text x={pad.left - 8} y={y(tick) + 3.5} textAnchor="end" className="axis-label">{format(tick)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#14907a" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {labelIdx.map((i) => <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="axis-label">{data[i][xKey]}</text>)}
      {(hover != null ? [hover] : [data.length - 1]).map((i) => (
        <g key={i}>
          {hover != null ? <line x1={x(i)} x2={x(i)} y1={pad.top} y2={pad.top + innerH} stroke="var(--line-strong)" strokeDasharray="3 3" /> : null}
          <circle cx={x(i)} cy={y(data[i][yKey])} r="4.5" fill="#fff" stroke="#14907a" strokeWidth="2" />
          <text x={Math.min(Math.max(x(i), pad.left + 40), width - 40)} y={y(data[i][yKey]) - 10} textAnchor="middle" className="value-label">{format(data[i][yKey])}{hover != null ? ` · ${data[i][xKey]}` : ''}</text>
        </g>
      ))}
    </svg>
  );
}

/** Horizontal bar list — good for long category labels. */
export function HBarList({ rows, labelKey = 'label', valueKey = 'value', format = compact, color }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0)) || 1;
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar" key={r[labelKey]}>
          <span className="label" title={r[labelKey]}>{r[labelKey]}</span>
          <span className="hbar-track"><span style={{ width: `${Math.max(1.5, ((Number(r[valueKey]) || 0) / max) * 100)}%`, background: color }} /></span>
          <span className="val">{format(r[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}
