import { useMemo, useState } from 'react';
import type { FiltersState, MatchPrediction } from './types';
import { rounds } from './types';
import { loadMatches, saveMatches, resetMatches, importMatches, loadMeta, saveMeta, nowText, loadColumnPrefs, saveColumnPrefs, addSnapshot, loadSnapshots, hasIncompleteBaseSchedule, forceLoadSeedMatches, normalizeRound } from './utils/storage';
import { recalculateMatch } from './utils/score'; import { fetchSportsbetOdds } from './utils/sportsbet';
import DashboardCards from './components/DashboardCards'; import TopNav from './components/TopNav'; import OddsUpdatePanel from './components/OddsUpdatePanel'; import ImportExportPanel from './components/ImportExportPanel'; import Filters from './components/Filters'; import MatchTable from './components/MatchTable'; import InfoPanel from './components/InfoPanel'; import MatchEditor from './components/MatchEditor';
const defaultFilters:FiltersState={round:'全部',group:'全部',team:'',city:'',completion:'全部',hit:'全部',sort:'matchNo',quick:'全部'};
const emptyMatch=(next:number):MatchPrediction=>recalculateMatch({id:crypto.randomUUID(),matchNo:next,group:'',round:'第1轮',australiaTime:'',homeTeam:'',awayTeam:'',city:'',actualScore:'',chatgptWdlPrediction:'TBD',claudeWdlPrediction:'TBD',chatgptPredictedScore1:'',chatgptPredictedScore2:'',chatgptPredictedScore3:'',claudePredictedScore1:'',claudePredictedScore2:'',claudePredictedScore3:'',notes:'',preMatchNotes:'',postMatchReview:'',focusLevel:'普通',oddsSource:''});
const oddsMissing=(m:MatchPrediction)=>![m.sbHomeOdds,m.sbDrawOdds,m.sbAwayOdds,m.chatgptCorrespondingSbWdlOdds,m.claudeCorrespondingSbWdlOdds].every(Boolean);
const otherFiltersActive=(f:FiltersState)=>f.group!=='全部'||f.team.trim()!==''||f.city.trim()!==''||f.completion!=='全部'||f.quick!=='全部';

type ApiResultMatch = {
  matchNo?: number | string | null;
  matchday?: number | string | null;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  actualScore: string;
};
type ApiResultsResponse = { ok?: boolean; code?: string; error?: string; matches?: ApiResultMatch[] };
const normalizeTeamName = (value: string) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(fc|cf|sc|national|team|men|women)\b/g, '')
  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
const teamMatches = (a: string, b: string) => {
  const left = normalizeTeamName(a);
  const right = normalizeTeamName(b);
  return !!left && !!right && (left === right || left.includes(right) || right.includes(left));
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
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return new Set([utc, month && day ? `${Number(month)}-${Number(day)}` : ''].filter(Boolean));
};
const datesMatch = (match: MatchPrediction, result: ApiResultMatch) => {
  const localDay = australiaMonthDay(match.australiaTime);
  return !localDay || apiMonthDays(result.utcDate).has(localDay);
};
const findFinishedResult = (match: MatchPrediction, results: ApiResultMatch[]) => {
  const byNo = results.filter((result) => Number(result.matchNo) === match.matchNo);
  const byNoTeams = byNo.filter((result) => teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam));
  if (byNoTeams.length === 1 && datesMatch(match, byNoTeams[0])) return byNoTeams[0];
  const byTeams = results.filter((result) => teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam));
  if (byTeams.length === 1 && datesMatch(match, byTeams[0])) return byTeams[0];
  const byDate = byTeams.filter((result) => datesMatch(match, result));
  return byDate.length === 1 ? byDate[0] : null;
};
export default function App(){ const [matches,setMatches]=useState<MatchPrediction[]>(loadMatches); const [meta,setMeta]=useState(loadMeta); const [message,setMessage]=useState(''); const [loadingOdds,setLoadingOdds]=useState(false); const [prefs,setPrefs]=useState(loadColumnPrefs); const [filters,setFilters]=useState<FiltersState>(defaultFilters); const [editing,setEditing]=useState<MatchPrediction|null>(null); const updateMeta=(patch:Partial<typeof meta>)=>{const next={...meta,...patch}; setMeta(next); saveMeta(next);}; const setAndSave=(rows:MatchPrediction[])=>{setMatches(rows); saveMatches(rows); setMessage('已保存');}; const visible=useMemo(()=>{const team=filters.team.trim(), city=filters.city.trim(); let rows=matches.filter(m=>(filters.round==='全部'||normalizeRound(m.round)===filters.round)&&(filters.group==='全部'||m.group===filters.group)&&(!team||m.homeTeam.includes(team)||m.awayTeam.includes(team))&&(!city||m.city.includes(city))&&(filters.completion==='全部'||(filters.completion==='已完成'?m.completionStatus==='已完赛':m.completionStatus!=='已完赛'))); rows=rows.filter(m=>{switch(filters.quick){case '已完赛':return m.completionStatus==='已完赛';case '未赛':return m.completionStatus!=='已完赛';case 'ChatGPT赛果命中':return m.chatgptWdlHit==='✅';case 'Claude赛果命中':return m.claudeWdlHit==='✅';case 'ChatGPT比分命中':return m.chatgptAnyScoreHit==='✅';case 'Claude比分命中':return m.claudeAnyScoreHit==='✅';case '双方都错':return !!m.actualResult&&m.chatgptWdlHit==='❌'&&m.claudeWdlHit==='❌';case '双方预测分歧':return !!m.predictionDisagreement;case '赔率缺失':return oddsMissing(m);case '高赔率':return !!m.highOddsTag;default:return true;}}); rows.sort((a,b)=>{ if(filters.sort==='oddsMissing')return Number(oddsMissing(b))-Number(oddsMissing(a)); return String(a[filters.sort]).localeCompare(String(b[filters.sort]),'zh-Hans',{numeric:true});}); return rows;},[matches,filters]); const roundCounts=useMemo(()=>Object.fromEntries(rounds.map(r=>[r,matches.filter(m=>normalizeRound(m.round)===r).length])),[matches]); const updateAllOdds=async()=>{setLoadingOdds(true);setMessage('正在尝试抓取 Sportsbet 赔率，请稍候…');let ok=0,fail=0,partial=0,missing=0; const next:MatchPrediction[]=[]; for(const m of matches){ if(!m.oddsSource){missing++; next.push({...m,oddsUpdateStatus:'缺少赔率来源'}); continue;} try{const odds=await fetchSportsbetOdds(m); const at=nowText(); const patch={...odds,oddsUpdateStatus:odds.partial?'部分赔率缺失':'已更新',oddsUpdatedAt:at} as Partial<MatchPrediction>; odds.partial?partial++:ok++; next.push(recalculateMatch({...m,...patch}));}catch{fail++; next.push({...m,oddsUpdateStatus:'抓取失败'});} } setLoadingOdds(false); setAndSave(next); updateMeta({lastOddsUpdate:nowText()}); setMessage(fail?`Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。成功更新 ${ok} 场，部分更新 ${partial} 场，失败 ${fail} 场，跳过 ${missing} 场缺少赔率来源。`:`Sportsbet 赔率已更新，并已保存到本地。成功更新 ${ok} 场，部分更新 ${partial} 场，失败 ${fail} 场，跳过 ${missing} 场缺少赔率来源。${partial?' 比分赔率未能解析的行已保留已有数据。':''}`);};
  const updateActualResults = async () => {
    setMessage('正在从 football-data.org 抓取实际赛果，请稍候…');
    let updated = 0;
    let existing = 0;
    let notFinished = 0;
    let matchedFailed = 0;
    let failed = 0;
    try {
      const response = await fetch('/api/results', { cache: 'no-store' });
      const data = await response.json() as ApiResultsResponse;
      if (!response.ok || !data.ok) {
        setMessage(data.error || '实际赛果抓取失败，已保留现有比分，可手动填写或通过 JSON/CSV 导入。');
        return;
      }
      const finished = Array.isArray(data.matches) ? data.matches : [];
      const at = nowText();
      const next = matches.map((match) => {
        const result = findFinishedResult(match, finished);
        if (!result) {
          notFinished++;
          return { ...match, resultUpdateStatus: '未完赛' as const };
        }
        if (!teamMatches(match.homeTeam, result.homeTeam) || !teamMatches(match.awayTeam, result.awayTeam) || !datesMatch(match, result)) {
          matchedFailed++;
          return { ...match, resultUpdateStatus: '匹配失败' as const };
        }
        if (match.actualScore) {
          existing++;
          return { ...match, resultUpdateStatus: '已更新' as const, resultUpdatedAt: at };
        }
        updated++;
        return {
          ...recalculateMatch({ ...match, actualScore: result.actualScore, completionStatus: '已完赛' }),
          resultUpdatedAt: at,
          resultUpdateStatus: '已更新' as const,
          resultSource: 'football-data.org'
        };
      });
      setAndSave(next);
      updateMeta({ lastResultUpdate: nowText() });
      setMessage(`实际赛果更新完成：成功更新 ${updated} 场，已有比分跳过 ${existing} 场，未完赛跳过 ${notFinished} 场，匹配失败 ${matchedFailed} 场，抓取失败 ${failed} 场。`);
    } catch {
      failed = matches.length;
      setMessage('实际赛果抓取失败，可能是数据源限制、网络错误或比赛尚未完赛。已保留现有比分，可手动填写或通过 JSON/CSV 导入。');
    }
  }; return <main className="min-h-screen world-cup-bg p-4 text-slate-100 md:p-8"><div className="mx-auto max-w-[1900px] space-y-5"><TopNav/><DashboardCards matches={matches} meta={meta}/>{message&&<div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-100">{message}</div>}{hasIncompleteBaseSchedule(matches)&&<div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-4 text-amber-100"><div className="flex flex-wrap items-center justify-between gap-3"><p>当前本地数据少于104场，建议点击“强制载入104场基础赛程”。</p><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950" onClick={()=>{const rows=forceLoadSeedMatches(matches);setMatches(rows);setFilters(defaultFilters);setMessage('已载入104场基础赛程')}}>强制载入104场基础赛程</button></div></div>}<OddsUpdatePanel matches={matches} onUpdate={updateAllOdds} loading={loadingOdds}/><ImportExportPanel matches={matches} onAdd={()=>setAndSave([...matches,emptyMatch(Math.max(0,...matches.map(m=>m.matchNo))+1)])} onSave={()=>{saveMatches(matches);updateMeta({lastManualSave:nowText()});setMessage('已保存')}} onRecalc={()=>{const rows=matches.map(recalculateMatch);setAndSave(rows);updateMeta({lastResultUpdate:nowText()})}} onReset={()=>{if(confirm('确定重置为104场基础赛程吗？这会覆盖当前数据，建议先备份 JSON。')){addSnapshot(matches);setAndSave(resetMatches())}}} onImport={(text)=>{try{addSnapshot(matches);const rows=importMatches(text);setAndSave(rows);updateMeta({lastImportTime:nowText()});setMessage('导入成功，已保存到本地。')}catch(e){setMessage(e instanceof Error?e.message:'导入失败：JSON 格式错误。')}}} onUpdateOdds={updateAllOdds} onUpdateResults={updateActualResults} onRestore={(i)=>{const s=loadSnapshots()[i]; if(s&&confirm('确定恢复该备份吗？当前数据会被覆盖。')) setAndSave(s.matches.map(recalculateMatch));}}/><Filters filters={filters} setFilters={setFilters} roundCounts={roundCounts} visibleCount={visible.length} totalCount={matches.length} hasOtherFilters={otherFiltersActive(filters)} onClearAll={()=>setFilters(defaultFilters)}/><MatchTable matches={visible} columnPrefs={prefs} onPrefs={(p)=>{setPrefs(p);saveColumnPrefs(p)}} onOpen={setEditing} onDelete={id=>{addSnapshot(matches);setAndSave(matches.filter(m=>m.id!==id))}} onUpdate={(id,patch)=>setAndSave(matches.map(m=>m.id===id?recalculateMatch({...m,...patch,round:normalizeRound(patch.round ?? m.round)}):m))}/><InfoPanel/><MatchEditor match={editing} onChange={setEditing} onClose={()=>setEditing(null)} onSave={()=>{if(editing){setAndSave(matches.map(m=>m.id===editing.id?recalculateMatch({...editing,round:normalizeRound(editing.round)}):m)); updateMeta({lastManualSave:nowText()}); setEditing(null)}}}/></div></main> }
