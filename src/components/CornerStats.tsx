import { useMemo } from 'react';
import type { MatchPrediction } from '../types';
import { continentFor, continentOrder, continentColors, type Continent } from '../data/continents';

const num = (v: unknown) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};

type TeamStat = { team: string; continent: Continent; corners: number; matches: number };
type ContinentStat = { continent: Continent; corners: number; matches: number; teams: number };

export default function CornerStats({ matches }: { matches: MatchPrediction[] }) {
  const { teamStats, continentStats, totalCorners, dataMatches, avgRanking } = useMemo(() => {
    const teamMap = new Map<string, TeamStat>();
    let dataMatches = 0;

    const add = (team: string, corners: number) => {
      const continent = continentFor(team);
      if (!continent) return; // 跳过淘汰赛占位行（非真实球队）
      const prev = teamMap.get(team) ?? { team, continent, corners: 0, matches: 0 };
      prev.corners += corners;
      prev.matches += 1;
      teamMap.set(team, prev);
    };

    matches.forEach((m) => {
      const h = num(m.homeCorners);
      const a = num(m.awayCorners);
      if (h === null && a === null) return;
      dataMatches += 1;
      if (h !== null) add(m.homeTeam, h);
      if (a !== null) add(m.awayTeam, a);
    });

    const teamStats = [...teamMap.values()].sort((x, y) => y.corners - x.corners);

    const contMap = new Map<Continent, ContinentStat>();
    teamStats.forEach((t) => {
      const prev = contMap.get(t.continent) ?? { continent: t.continent, corners: 0, matches: 0, teams: 0 };
      prev.corners += t.corners;
      prev.matches += t.matches;
      prev.teams += 1;
      contMap.set(t.continent, prev);
    });
    const continentStats = continentOrder
      .map((c) => contMap.get(c))
      .filter((c): c is ContinentStat => Boolean(c));

    const totalCorners = teamStats.reduce((s, t) => s + t.corners, 0);
    const avgRanking = [...teamStats]
      .map((t) => ({ ...t, avg: t.corners / t.matches }))
      .sort((x, y) => y.avg - x.avg)
      .slice(0, 10);
    return { teamStats, continentStats, totalCorners, dataMatches, avgRanking };
  }, [matches]);

  if (dataMatches === 0) {
    return (
      <section className="panel cornerStats">
        <div className="cornerHeader">
          <b>角球统计（按洲际）</b>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '8px 0 0' }}>
          暂无角球数据。请在比赛编辑器中填写「主队角球 / 客队角球」后，这里会自动按洲际汇总并出图。
        </p>
      </section>
    );
  }

  const maxContCorners = Math.max(...continentStats.map((c) => c.corners), 1);
  const maxAvg = Math.max(...avgRanking.map((t) => t.avg), 1);

  return (
    <section className="panel cornerStats">
      <div className="cornerHeader">
        <b>角球统计（按洲际）</b>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          已录入 {dataMatches} 场 · 角球合计 {totalCorners} 个 · 覆盖 {teamStats.length} 队
        </span>
      </div>

      {/* 洲际柱状图：总角球数 + 场均 */}
      <div className="continentBars">
        {continentStats.map((c) => {
          const avg = c.matches ? (c.corners / c.matches) : 0;
          return (
            <div className="continentRow" key={c.continent}>
              <span className="continentName">{c.continent}</span>
              <div className="continentBarTrack">
                <div
                  className="continentBarFill"
                  style={{ width: `${(c.corners / maxContCorners) * 100}%`, background: continentColors[c.continent] }}
                />
              </div>
              <span className="continentValue">
                {c.corners} 个
                <span className="continentSub"> · 场均 {avg.toFixed(1)} · {c.teams} 队</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 场均角球排行榜 Top 10 */}
      <div className="cornerRanking">
        <h4>场均角球排行榜 Top 10</h4>
        <ol>
          {avgRanking.map((t, i) => (
            <li key={t.team}>
              <span className="rankIdx">{i + 1}</span>
              <span className="rankTeam" style={{ color: continentColors[t.continent] }}>{t.team}</span>
              <div className="rankBarTrack">
                <div className="rankBarFill" style={{ width: `${(t.avg / maxAvg) * 100}%`, background: continentColors[t.continent] }} />
              </div>
              <span className="rankAvg">{t.avg.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 各队明细，按洲际分组 */}
      <details className="cornerTeamDetails">
        <summary>各队角球明细（共 {teamStats.length} 队）</summary>
        <div className="cornerTeamGroups">
          {continentStats.map((c) => (
            <div className="cornerTeamGroup" key={c.continent}>
              <h4 style={{ color: continentColors[c.continent] }}>{c.continent}</h4>
              <ul>
                {teamStats.filter((t) => t.continent === c.continent).map((t) => (
                  <li key={t.team}>
                    <span className="cornerTeamName">{t.team}</span>
                    <span className="cornerTeamNum">{t.corners} 个</span>
                    <span className="cornerTeamAvg">场均 {(t.corners / t.matches).toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
