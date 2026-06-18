import type { MatchPrediction } from '../types';

const W = 700;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function polyline(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export default function TrendChart({ matches }: { matches: MatchPrediction[] }) {
  const completed = [...matches]
    .filter(m => m.completionStatus === '已完赛')
    .sort((a, b) => a.matchNo - b.matchNo);

  if (completed.length < 2) {
    return (
      <section className="panel" style={{ marginBottom: 12, padding: '16px 20px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
        已完赛场次不足，暂无趋势图（至少需要 2 场）
      </section>
    );
  }

  // build cumulative series
  type Point = { x: number; cRate: number; gRate: number; label: string };
  const series: Point[] = [];
  let cHit = 0, gHit = 0;
  completed.forEach((m, i) => {
    if (m.claudeWdlHit === '✓') cHit++;
    if (m.chatgptWdlHit === '✓') gHit++;
    const total = i + 1;
    series.push({
      x: i,
      cRate: cHit / total,
      gRate: gHit / total,
      label: String(m.matchNo),
    });
  });

  const n = series.length;
  const xScale = (i: number) => PAD.left + (i / (n - 1)) * INNER_W;
  const yScale = (r: number) => PAD.top + INNER_H - r * INNER_H;

  const claudePts: [number, number][] = series.map(p => [xScale(p.x), yScale(p.cRate)]);
  const gptPts: [number, number][] = series.map(p => [xScale(p.x), yScale(p.gRate)]);

  // y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // x-axis: show ~6 evenly spaced ticks
  const xTickCount = Math.min(n, 6);
  const xTickIndices = Array.from({ length: xTickCount }, (_, i) =>
    Math.round(i * (n - 1) / (xTickCount - 1))
  );

  const lastC = series[n - 1].cRate;
  const lastG = series[n - 1].gRate;

  return (
    <section className="panel" style={{ marginBottom: 12, padding: '14px 20px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>赛果命中率趋势</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <svg width="24" height="3"><line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="0"/></svg>
          Claude（当前 {(lastC * 100).toFixed(1)}%）
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <svg width="24" height="3"><line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#f97316" strokeWidth="2.5" strokeDasharray="5,3"/></svg>
          ChatGPT（当前 {(lastG * 100).toFixed(1)}%）
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Claude vs ChatGPT 赛果命中率趋势折线图"
      >
        {/* grid lines */}
        {yTicks.map(t => (
          <line
            key={t}
            x1={PAD.left} y1={yScale(t)}
            x2={PAD.left + INNER_W} y2={yScale(t)}
            stroke="#e2e8f0" strokeWidth="1"
          />
        ))}

        {/* y-axis labels */}
        {yTicks.map(t => (
          <text
            key={t}
            x={PAD.left - 6} y={yScale(t) + 4}
            textAnchor="end" fontSize="11" fill="#94a3b8"
          >
            {(t * 100).toFixed(0)}%
          </text>
        ))}

        {/* x-axis labels */}
        {xTickIndices.map(idx => (
          <text
            key={idx}
            x={xScale(idx)} y={PAD.top + INNER_H + 18}
            textAnchor="middle" fontSize="11" fill="#94a3b8"
          >
            第{series[idx].label}场
          </text>
        ))}

        {/* ChatGPT line (dashed, behind) */}
        <polyline
          points={polyline(gptPts)}
          fill="none"
          stroke="#f97316"
          strokeWidth="2.5"
          strokeDasharray="6,4"
          strokeLinejoin="round"
        />

        {/* Claude line (solid, front) */}
        <polyline
          points={polyline(claudePts)}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* end dots */}
        <circle cx={claudePts[n - 1][0]} cy={claudePts[n - 1][1]} r="4" fill="#6366f1" />
        <circle cx={gptPts[n - 1][0]} cy={gptPts[n - 1][1]} r="4" fill="#f97316" />
      </svg>
    </section>
  );
}
