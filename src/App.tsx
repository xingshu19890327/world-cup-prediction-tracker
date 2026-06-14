import { useMemo, useState } from 'react';
import type { FiltersState, MatchPrediction } from './types';
import { rounds } from './types';
import {
  addSnapshot,
  forceLoadSeedMatches,
  hasIncompleteBaseSchedule,
  importMatches,
  loadColumnPrefs,
  loadMatches,
  loadMeta,
  loadSnapshots,
  normalizeRound,
  nowText,
  resetMatches,
  saveColumnPrefs,
  saveMatches,
  saveMeta
} from './utils/storage';
import { recalculateMatch } from './utils/score';
import { fetchSportsbetOdds } from './utils/sportsbet';
import DashboardCards from './components/DashboardCards';
import TopNav from './components/TopNav';
import OddsUpdatePanel from './components/OddsUpdatePanel';
import ImportExportPanel from './components/ImportExportPanel';
import Filters from './components/Filters';
import MatchTable from './components/MatchTable';
import InfoPanel from './components/InfoPanel';
import MatchEditor from './components/MatchEditor';

type ApiResultMatch = {
  id?: string | number;
  matchNo?: string | number | null;
  matchday?: string | number;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  actualScore: string;
};

type ApiResultsResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  matches?: ApiResultMatch[];
};

const defaultFilters: FiltersState = {
  round: '全部',
  group: '全部',
  team: '',
  city: '',
  completion: '全部',
  hit: '全部',
  sort: 'matchNo',
  quick: '全部',
  showKnockoutPlaceholders: false
};

const emptyMatch = (next: number): MatchPrediction => recalculateMatch({
  id: crypto.randomUUID(),
  matchNo: next,
  group: '',
  round: '第1轮',
  australiaTime: '',
  homeTeam: '',
  awayTeam: '',
  city: '',
  actualScore: '',
  chatgptWdlPrediction: 'TBD',
  claudeWdlPrediction: 'TBD',
  chatgptPredictedScore1: '',
  chatgptPredictedScore2: '',
  chatgptPredictedScore3: '',
  claudePredictedScore1: '',
  claudePredictedScore2: '',
  claudePredictedScore3: '',
  notes: '',
  preMatchNotes: '',
  postMatchReview: '',
  focusLevel: '普通',
  oddsSource: ''
});

const oddsMissing = (match: MatchPrediction) => ![
  match.sbHomeOdds,
  match.sbDrawOdds,
  match.sbAwayOdds,
  match.chatgptCorrespondingSbWdlOdds,
  match.claudeCorrespondingSbWdlOdds
].every(Boolean);

const otherFiltersActive = (filters: FiltersState) => (
  filters.round !== '全部' ||
  filters.group !== '全部' ||
  filters.team.trim() !== '' ||
  filters.city.trim() !== '' ||
  filters.completion !== '全部' ||
  filters.hit !== '全部' ||
  filters.quick !== '全部' ||
  filters.showKnockoutPlaceholders
);

const normalizeTeamName = (value: string) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(fc|cf|sc|national|team|men|women)\b/g, '')
  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');

const teamMatches = (left: string, right: string) => {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};

const australiaMonthDay = (value: string) => {
  const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})/);
  return match ? `${Number(match[1])}-${Number(match[2])}` : '';
};

const apiMonthDays = (utcDate: string) => {
  if (!utcDate) return new Set<string>();
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return new Set<string>();
  const utc = `${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  const auParts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const month = auParts.find((part) => part.type === 'month')?.value;
  const day = auParts.find((part) => part.type === 'day')?.value;
  return new Set([utc, month && day ? `${Number(month)}-${Number(day)}` : ''].filter(Boolean));
};

const datesMatch = (match: MatchPrediction, result: ApiResultMatch) => {
  const localDay = australiaMonthDay(match.australiaTime);
  return !localDay || apiMonthDays(result.utcDate).has(localDay);
};

const findFinishedResult = (match: MatchPrediction, apiMatches: ApiResultMatch[]) => {
  const exactMatchNo = apiMatches.filter((result) => Number(result.matchNo) === match.matchNo);
  const exactMatchNoWithTeams = exactMatchNo.filter((result) => teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam));
  if (exactMatchNoWithTeams.length === 1 && datesMatch(match, exactMatchNoWithTeams[0])) return exactMatchNoWithTeams[0];

  const teamCandidates = apiMatches.filter((result) => teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam));
  if (teamCandidates.length === 1 && datesMatch(match, teamCandidates[0])) return teamCandidates[0];

  const datedCandidates = teamCandidates.filter((result) => datesMatch(match, result));
  return datedCandidates.length === 1 ? datedCandidates[0] : null;
};

export default function App() {
  const [matches, setMatches] = useState<MatchPrediction[]>(loadMatches);
  const [meta, setMeta] = useState(loadMeta);
  const [message, setMessage] = useState('');
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [prefs, setPrefs] = useState(loadColumnPrefs);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [editing, setEditing] = useState<MatchPrediction | null>(null);

  const updateMeta = (patch: Partial<typeof meta>) => {
    const next = { ...meta, ...patch };
    setMeta(next);
    saveMeta(next);
  };
  const setAndSave = (rows: MatchPrediction[]) => {
    setMatches(rows);
    saveMatches(rows);
    setMessage('已保存');
  };

  const visible = useMemo(() => {
    const team = filters.team.trim();
    const city = filters.city.trim();
    let rows = matches.filter((match) => (
      (filters.showKnockoutPlaceholders || match.matchNo <= 72 || !String(match.homeTeam + match.awayTeam).includes('TBD')) &&
      (filters.round === '全部' || normalizeRound(match.round) === filters.round) &&
      (filters.group === '全部' || match.group === filters.group) &&
      (!team || match.homeTeam.includes(team) || match.awayTeam.includes(team)) &&
      (!city || match.city.includes(city)) &&
      (filters.completion === '全部' || (filters.completion === '已完成' ? match.completionStatus === '已完赛' : match.completionStatus !== '已完赛'))
    ));
    rows = rows.filter((match) => {
      switch (filters.quick) {
        case '已完赛': return match.completionStatus === '已完赛';
        case '未赛': return match.completionStatus !== '已完赛';
        case 'ChatGPT赛果命中': return match.chatgptWdlHit === '✅';
        case 'Claude赛果命中': return match.claudeWdlHit === '✅';
        case 'ChatGPT比分命中': return match.chatgptAnyScoreHit === '✅';
        case 'Claude比分命中': return match.claudeAnyScoreHit === '✅';
        case '双方都错': return !!match.actualResult && match.chatgptWdlHit === '❌' && match.claudeWdlHit === '❌';
        case '双方预测分歧': return !!match.predictionDisagreement;
        case '赔率缺失': return oddsMissing(match);
        case '高赔率': return !!match.highOddsTag;
        default: return true;
      }
    });
    rows.sort((a, b) => {
      if (filters.sort === 'oddsMissing') return Number(oddsMissing(b)) - Number(oddsMissing(a));
      return String(a[filters.sort]).localeCompare(String(b[filters.sort]), 'zh-Hans', { numeric: true });
    });
    return rows;
  }, [matches, filters]);

  const roundCounts = useMemo(() => Object.fromEntries(rounds.map((round) => [round, matches.filter((match) => normalizeRound(match.round) === round).length])), [matches]);

  const updateAllOdds = async () => {
    setLoadingOdds(true);
    setMessage('正在尝试抓取 Sportsbet 赔率，请稍候…');
    let ok = 0;
    let fail = 0;
    let partial = 0;
    let missing = 0;
    const next: MatchPrediction[] = [];
    for (const match of matches) {
      if (!match.oddsSource) {
        missing++;
        next.push({ ...match, oddsUpdateStatus: '缺少赔率来源' });
        continue;
      }
      try {
        const odds = await fetchSportsbetOdds(match);
        const at = nowText();
        const patch = { ...odds, oddsUpdateStatus: odds.partial ? '部分赔率缺失' : '已更新', oddsUpdatedAt: at } as Partial<MatchPrediction>;
        odds.partial ? partial++ : ok++;
        next.push(recalculateMatch({ ...match, ...patch }));
      } catch {
        fail++;
        next.push({ ...match, oddsUpdateStatus: '抓取失败' });
      }
    }
    setLoadingOdds(false);
    setAndSave(next);
    updateMeta({ lastOddsUpdate: nowText() });
    setMessage(fail
      ? `Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。成功更新 ${ok} 场，部分更新 ${partial} 场，失败 ${fail} 场，跳过 ${missing} 场缺少赔率来源。`
      : `Sportsbet 赔率已更新，并已保存到本地。成功更新 ${ok} 场，部分更新 ${partial} 场，失败 ${fail} 场，跳过 ${missing} 场缺少赔率来源。${partial ? ' 比分赔率未能解析的行已保留已有数据。' : ''}`);
  };

  const updateActualResults = async () => {
    setMessage('正在从 football-data.org 抓取实际赛果，请稍候…');
    let updated = 0;
    let existing = 0;
    let notFinished = 0;
    let failed = 0;
    let missing = 0;
    let matchedFailed = 0;
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      const data = await response.json() as ApiResultsResponse;
      if (!response.ok || !data.ok) {
        const status = data.code === 'missing_token' ? '缺少赛果来源' : '抓取失败';
        const next = matches.map((match) => ({ ...match, resultUpdateStatus: status as MatchPrediction['resultUpdateStatus'] }));
        setAndSave(next);
        updateMeta({ lastResultUpdate: nowText() });
        setMessage(data.error || '实际赛果抓取失败，已保留现有比分，可手动填写或导入 JSON/CSV。');
        return;
      }

      const finished = Array.isArray(data.matches) ? data.matches : [];
      const at = nowText();
      const next = matches.map((match) => {
        const result = findFinishedResult(match, finished);
        if (!result) {
          if (match.matchNo <= 72 && !String(match.homeTeam + match.awayTeam).includes('TBD')) {
            notFinished++;
            return { ...match, resultUpdateStatus: '未完赛' as const };
          }
          missing++;
          return { ...match, resultUpdateStatus: '缺少赛果来源' as const };
        }
        if (!teamMatches(match.homeTeam, result.homeTeam) || !teamMatches(match.awayTeam, result.awayTeam) || !datesMatch(match, result)) {
          matchedFailed++;
          return { ...match, resultUpdateStatus: '匹配失败' as const };
        }
        const actualScore = String(result.actualScore || '');
        if (!actualScore) {
          notFinished++;
          return { ...match, resultUpdateStatus: '未完赛' as const };
        }
        if (match.actualScore) {
          existing++;
          return recalculateMatch({ ...match, resultUpdatedAt: at, resultUpdateStatus: '已更新' });
        }
        updated++;
        return recalculateMatch({ ...match, actualScore, completionStatus: '已完赛', resultUpdatedAt: at, resultUpdateStatus: '已更新' });
      });
      setAndSave(next);
      updateMeta({ lastResultUpdate: nowText() });
      setMessage(`实际赛果更新完成：成功更新 ${updated} 场，已有比分跳过 ${existing} 场，未完赛跳过 ${notFinished} 场，缺少赛果来源 ${missing} 场，匹配失败 ${matchedFailed} 场，抓取失败 ${failed} 场。数据源：football-data.org。`);
    } catch {
      failed = matches.length;
      setAndSave(matches.map((match) => ({ ...match, resultUpdateStatus: '抓取失败' as const })));
      updateMeta({ lastResultUpdate: nowText() });
      setMessage('实际赛果抓取失败，可能是数据源限制、网络错误或比赛尚未完赛。已保留现有比分，可手动填写或导入 JSON/CSV。');
    }
  };

  return <main className="min-h-screen world-cup-bg p-4 text-slate-100 md:p-8"><div className="mx-auto max-w-[1900px] space-y-5"><TopNav/><DashboardCards matches={matches} meta={meta}/>{message&&<div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-100">{message}</div>}{hasIncompleteBaseSchedule(matches)&&<div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-4 text-amber-100"><div className="flex flex-wrap items-center justify-between gap-3"><p>当前本地数据少于104场，建议点击“强制载入104场基础赛程”。</p><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950" onClick={()=>{const rows=forceLoadSeedMatches(matches);setMatches(rows);setFilters(defaultFilters);setMessage('已载入104场基础赛程')}}>强制载入104场基础赛程</button></div></div>}<OddsUpdatePanel matches={matches} onUpdate={updateAllOdds} loading={loadingOdds}/><ImportExportPanel matches={matches} onAdd={()=>setAndSave([...matches,emptyMatch(Math.max(0,...matches.map(m=>m.matchNo))+1)])} onSave={()=>{saveMatches(matches);updateMeta({lastManualSave:nowText()});setMessage('已保存')}} onRecalc={()=>{const rows=matches.map(recalculateMatch);setAndSave(rows);updateMeta({lastResultUpdate:nowText()})}} onReset={()=>{if(confirm('确定重置为104场基础赛程吗？这会覆盖当前数据，建议先备份 JSON。')){addSnapshot(matches);setAndSave(resetMatches())}}} onImport={(text)=>{try{addSnapshot(matches);const rows=importMatches(text);setAndSave(rows);updateMeta({lastImportTime:nowText()});setMessage('导入成功，已保存到本地。')}catch(e){setMessage(e instanceof Error?e.message:'导入失败：JSON 格式错误。')}}} onUpdateOdds={updateAllOdds} onUpdateResults={updateActualResults} onReloadBaseline={()=>{const rows=forceLoadSeedMatches(matches);setMatches(rows);setFilters(defaultFilters);setMessage('已重新载入 Excel 基准数据')}} onRestore={(i)=>{const s=loadSnapshots()[i]; if(s&&confirm('确定恢复该备份吗？当前数据会被覆盖。')) setAndSave(s.matches.map(recalculateMatch));}}/><Filters filters={filters} setFilters={setFilters} roundCounts={roundCounts} visibleCount={visible.length} totalCount={matches.length} hasOtherFilters={otherFiltersActive(filters)} onClearAll={()=>setFilters(defaultFilters)}/><MatchTable matches={visible} columnPrefs={prefs} onPrefs={(p)=>{setPrefs(p);saveColumnPrefs(p)}} onOpen={setEditing} onDelete={id=>{addSnapshot(matches);setAndSave(matches.filter(m=>m.id!==id))}} onUpdate={(id,patch)=>setAndSave(matches.map(m=>m.id===id?recalculateMatch({...m,...patch,round:normalizeRound(patch.round ?? m.round)}):m))}/><InfoPanel/><MatchEditor match={editing} onChange={setEditing} onClose={()=>setEditing(null)} onSave={()=>{if(editing){setAndSave(matches.map(m=>m.id===editing.id?recalculateMatch({...editing,round:normalizeRound(editing.round)}):m)); updateMeta({lastManualSave:nowText()}); setEditing(null)}}}/></div></main>;
}
