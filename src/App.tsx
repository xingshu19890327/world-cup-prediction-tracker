import { useEffect, useMemo, useState } from 'react';
import type { ColumnFiltersState, FiltersState, MatchPrediction } from './types';
import { clearColumnFilters, importMatches, loadColumnFilters, loadMatches, resetMatches, saveColumnFilters, saveMatches } from './utils/storage';
import { recalculateMatch } from './utils/score';
import { applyEspnResults, espnDateFromAustraliaTime } from './utils/results';
import TopNav from './components/TopNav';
import DashboardCards from './components/DashboardCards';
import Filters from './components/Filters';
import ImportExportPanel, { DataManagementPanel } from './components/ImportExportPanel';
import MatchTable from './components/MatchTable';
import MatchEditor from './components/MatchEditor';
import InfoPanel from './components/InfoPanel';
const defaultFilters: FiltersState = { round:'全部', group:'全部', completion:'全部', hit:'全部', team:'', city:'', quick:'全部' };
const blankValueLabel = '空白';
const columnFilterValue = (value: unknown) => String(value ?? '').trim() || blankValueLabel;
const missingOdds = (m: MatchPrediction) => !m.sbHomeOdds || !m.sbDrawOdds || !m.sbAwayOdds || !m.claudeCorrespondingSbWdlOdds;
const parseAustraliaTime = (value: string) => {
  const match = String(value || '').match(/(\d{1,2})\/(\d{1,2}).*?(上午|下午)?\s*(\d{1,2}):(\d{2})/);
  if (!match) return Date.parse(value);
  const [, month, day, meridiem, hourText, minuteText] = match;
  let hour = Number(hourText);
  if (meridiem === '下午' && hour < 12) hour += 12;
  if (meridiem === '上午' && hour === 12) hour = 0;
  return new Date(2026, Number(month) - 1, Number(day), hour, Number(minuteText)).getTime();
};
const expandEspnDates = (dates: string[]) => [...new Set(dates.flatMap((date) => {
  const parsed = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8))));
  if (Number.isNaN(parsed.getTime())) return [date];
  return [-1, 0, 1].map((offset) => {
    const next = new Date(parsed);
    next.setUTCDate(parsed.getUTCDate() + offset);
    return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`;
  });
}))];
export default function App(){
  const [matches,setMatches]=useState<MatchPrediction[]>(loadMatches);
  const [filters,setFilters]=useState<FiltersState>(defaultFilters);
  const [columnFilters,setColumnFilters]=useState<ColumnFiltersState>(loadColumnFilters);
  const [editing,setEditing]=useState<MatchPrediction|null>(null);
  const [message,setMessage]=useState('');
  const [updatingResults,setUpdatingResults]=useState(false);
  const [updatingSportsbetModel,setUpdatingSportsbetModel]=useState<''|'chatgpt'|'claude'>('');
  const [lastResultsUpdate,setLastResultsUpdate]=useState('');
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const setAndSave=(rows:MatchPrediction[])=>{setMatches(rows);saveMatches(rows);setMessage('已保存到本地。')};
  const updateActualResults=async()=>{
    setUpdatingResults(true);
    try {
      const trackerDates = [...new Set(matches
        .map((match) => espnDateFromAustraliaTime(match.australiaTime))
        .filter(Boolean))];
      const urls = trackerDates.length
        ? [...expandEspnDates(trackerDates).map((date) => `/api/espn-results?dates=${date}`), '/api/espn-results']
        : ['/api/espn-results'];
      const payloads = await Promise.all(urls.map(async (url) => {
        const response = await fetch(url);
        const payload = await response.json().catch(()=>({ message: 'ESPN 赛果数据源返回格式错误。' }));
        if(!response.ok) throw new Error(payload.message || 'ESPN 赛果数据源失败。');
        return payload;
      }));
      const allMatches = payloads.flatMap((payload) => Array.isArray(payload.matches) ? payload.matches : []);
      const seen = new Set<string>();
      const sourceMatches = allMatches.filter((match) => {
        const key = match.id || `${match.utcDate}-${match.homeTeam}-${match.awayTeam}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const { rows, stats } = applyEspnResults(matches, sourceMatches);
      setMatches(rows);
      saveMatches(rows);
      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      setLastResultsUpdate(now);
      console.debug('ESPN 赛果更新诊断', stats);
      const match18Diagnostic = stats.focusDiagnostics.find((diagnostic) => diagnostic.matchNo === 18);
      const match18Message = match18Diagnostic && match18Diagnostic.reason !== '已更新'
        ? `matchNo 18 伊拉克 vs 挪威：${match18Diagnostic.reason.replace('ESPN 返回该比赛但状态未完赛', '未完赛').replace('ESPN 返回但状态未完赛', '未完赛').replace('ESPN 返回比分无效', '比分无效').replace('ESPN 未返回该比赛', 'ESPN 未返回')}。`
        : '';
      setMessage(`${stats.updatedMatches.length
        ? `本次更新：${stats.updatedMatches.map((match) => `${match.matchNo} ${match.label} ${match.score}`).join('；')}。`
        : '无新场次更新。'}${match18Message}`);
    } catch (error) {
      console.debug('ESPN 赛果更新诊断', { error, espnReturned: 0, espnCompleted: 0, espnUnfinished: 0, updated: 0, espnMissing: matches.length, matchFailed: 0 });
      setMessage(`ESPN 赛果数据源失败：${error instanceof Error ? error.message : '未知错误'}。`);
    } finally {
      setUpdatingResults(false);
    }
  };

  const fillSportsbetPrediction=async(model:'chatgpt'|'claude')=>{
    const now = Date.now();
    const nextMatch = matches
      .filter((match) => match.completionStatus === '未赛' && !String(match.actualScore || '').trim())
      .map((match) => ({ match, time: parseAustraliaTime(match.australiaTime) }))
      .filter(({ time }) => Number.isFinite(time) && time >= now)
      .sort((a, b) => a.time - b.time)[0]?.match;
    if (!nextMatch) { setMessage('当前没有可更新的未赛比赛。'); return; }
    const modelLabel = model === 'chatgpt' ? 'ChatGPT' : 'Claude';
    const existing = model === 'chatgpt'
      ? [nextMatch.chatgptWdlPrediction, nextMatch.chatgptPredictedScore1, nextMatch.chatgptPredictedScore2, nextMatch.chatgptPredictedScore3]
      : [nextMatch.claudeWdlPrediction, nextMatch.claudePredictedScore1, nextMatch.claudePredictedScore2, nextMatch.claudePredictedScore3];
    if (existing.some((value) => String(value || '').trim()) && !confirm(`该场 ${modelLabel} 预测已存在，是否用 Sportsbet 赔率重新覆盖？`)) return;
    setUpdatingSportsbetModel(model);
    try {
      const params = new URLSearchParams({
        homeTeam: nextMatch.homeTeam,
        awayTeam: nextMatch.awayTeam,
        australiaTime: nextMatch.australiaTime,
        matchNo: String(nextMatch.matchNo),
        oddsSource: nextMatch.oddsSource || '',
        sportsbetUrl: String((nextMatch as MatchPrediction & { sportsbetUrl?: string }).sportsbetUrl || ''),
      });
      const response = await fetch(`/api/sportsbet-next-odds?${params}`);
      const payload = await response.json().catch(()=>({ message: 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。' }));
      if(!response.ok) throw new Error(payload.message || 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。');
      const topScores = Array.isArray(payload.topScores) ? payload.topScores.slice(0, 3) : [];
      const updatedRows = matches.map((match) => {
        if (match.id !== nextMatch.id) return match;
        const patch: Partial<MatchPrediction> = {
          sbHomeOdds: payload.wdlOdds?.['主胜'] ?? match.sbHomeOdds,
          sbDrawOdds: payload.wdlOdds?.['平局'] ?? match.sbDrawOdds,
          sbAwayOdds: payload.wdlOdds?.['客胜'] ?? match.sbAwayOdds,
          oddsSource: payload.url || match.oddsSource,
        };
        const wdlOdds = payload.wdlOdds?.[payload.wdlPrediction];
        if (model === 'chatgpt') {
          patch.chatgptWdlPrediction = payload.wdlPrediction;
          if (topScores.length) {
            patch.chatgptPredictedScore1 = topScores[0]?.score || '';
            patch.chatgptPredictedScore2 = topScores[1]?.score || '';
            patch.chatgptPredictedScore3 = topScores[2]?.score || '';
          }
        } else {
          patch.claudeWdlPrediction = payload.wdlPrediction;
          patch.claudeCorrespondingSbWdlOdds = wdlOdds ?? match.claudeCorrespondingSbWdlOdds;
          if (topScores.length) {
            patch.claudePredictedScore1 = topScores[0]?.score || '';
            patch.claudePredictedScore2 = topScores[1]?.score || '';
            patch.claudePredictedScore3 = topScores[2]?.score || '';
          }
        }
        return recalculateMatch({ ...match, ...patch });
      });
      setMatches(updatedRows);
      saveMatches(updatedRows);
      const scoresText = topScores.map((item:{score:string}) => item.score).filter(Boolean).join('、');
      setMessage(topScores.length
        ? `已用 Sportsbet 赔率更新 ${modelLabel} 预测：${nextMatch.matchNo} ${nextMatch.homeTeam} vs ${nextMatch.awayTeam}，主推：${payload.wdlPrediction}，比分：${scoresText}。`
        : '已更新胜平负主推，但未能抓取 Correct Score 赔率。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。');
    } finally {
      setUpdatingSportsbetModel('');
    }
  };

  const groups=useMemo(()=>[...new Set(matches.map(m=>m.group).filter(Boolean))].sort(),[matches]);
  const rounds=useMemo(()=>[...new Set(matches.map(m=>m.round).filter(Boolean))],[matches]);
  const visible=useMemo(()=>matches.filter(m=>{
    if(filters.round!=='全部'&&m.round!==filters.round) return false;
    if(filters.group!=='全部'&&m.group!==filters.group) return false;
    if(filters.completion!=='全部'&&m.completionStatus!==filters.completion) return false;
    if(filters.team&&!(m.homeTeam.includes(filters.team)||m.awayTeam.includes(filters.team))) return false;
    if(filters.city&&!m.city.includes(filters.city)) return false;
    const q=filters.quick;
    if(q==='已完赛'&&m.completionStatus!=='已完赛') return false;
    if(q==='未赛'&&m.completionStatus!=='未赛') return false;
    if(q==='Claude赛果命中'&&m.claudeWdlHit!=='✓') return false;
    if(q==='ChatGPT赛果命中'&&m.chatgptWdlHit!=='✓') return false;
    if(q==='Claude比分命中'&&m.claudeAnyScoreHit!=='✓') return false;
    if(q==='ChatGPT比分命中'&&m.chatgptAnyScoreHit!=='✓') return false;
    if(q==='双方都错'&&!(m.claudeWdlHit==='×'&&m.chatgptWdlHit==='×')) return false;
    if(q==='双方预测分歧'&&!m.predictionDisagreement) return false;
    if(q==='赔率缺失'&&!missingOdds(m)) return false;
    if(q==='高赔率'&&!m.highOddsTag) return false;
    if(filters.hit!=='全部') {
      const pass = filters.hit==='Claude赛果命中'?m.claudeWdlHit==='✓':filters.hit==='ChatGPT赛果命中'?m.chatgptWdlHit==='✓':filters.hit==='Claude比分命中'?m.claudeAnyScoreHit==='✓':filters.hit==='ChatGPT比分命中'?m.chatgptAnyScoreHit==='✓':m.claudeWdlHit==='×'&&m.chatgptWdlHit==='×';
      if(!pass) return false;
    }
    for (const [key, values] of Object.entries(columnFilters) as [keyof MatchPrediction, string[]][]) {
      if (!values.includes(columnFilterValue(m[key]))) return false;
    }
    return true;
  }),[matches,filters,columnFilters]);
  const updateColumnFilters=(next:ColumnFiltersState)=>{setColumnFilters(next);saveColumnFilters(next)};
  const clearAllFilters=()=>{setFilters(defaultFilters);setColumnFilters({});clearColumnFilters()};
  return <main>
    <div className="shell">
      <TopNav/>
      <DashboardCards matches={matches}/>
      {message && <div className="msg">{message}</div>}
      <ImportExportPanel
        onRecalc={() => setAndSave(matches.map(recalculateMatch))}
        onUpdateResults={updateActualResults}
        onFillSportsbetPrediction={fillSportsbetPrediction}
        updatingSportsbetModel={updatingSportsbetModel}
        updatingResults={updatingResults}
        lastResultsUpdate={lastResultsUpdate}
      />
      <Filters
        filters={filters}
        setFilters={setFilters}
        visibleCount={visible.length}
        totalCount={matches.length}
        groups={groups}
        rounds={rounds}
        onClearAll={clearAllFilters}
      />
      <MatchTable matches={visible} allMatches={matches} columnFilters={columnFilters} onColumnFiltersChange={updateColumnFilters} onOpen={setEditing}/>
      <InfoPanel/>
      <DataManagementPanel
        matches={matches}
        onReset={() => {
          if (confirm('确定重新载入 Excel 基准数据？当前本地修改会被覆盖，建议先导出 JSON。')) setAndSave(resetMatches());
        }}
        onImport={(text) => {
          try {
            setAndSave(importMatches(text));
          } catch {
            setMessage('导入失败：JSON 格式错误。');
          }
        }}
      />
      <MatchEditor
        match={editing}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSave={() => {
          if (editing) {
            setAndSave(matches.map((match) => match.id === editing.id ? recalculateMatch(editing) : match));
            setEditing(null);
          }
        }}
      />
    </div>
  </main>;
}
