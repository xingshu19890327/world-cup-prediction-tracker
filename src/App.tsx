import { useEffect, useMemo, useState } from 'react';
import type { FiltersState, MatchPrediction } from './types';
import { importMatches, loadMatches, resetMatches, saveMatches } from './utils/storage';
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
const missingOdds = (m: MatchPrediction) => !m.sbHomeOdds || !m.sbDrawOdds || !m.sbAwayOdds || !m.claudeCorrespondingSbWdlOdds;
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
  const [editing,setEditing]=useState<MatchPrediction|null>(null);
  const [message,setMessage]=useState('');
  const [updatingResults,setUpdatingResults]=useState(false);
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
      const focusMissing = stats.focusDiagnostics.filter((item) => item.reason !== '已更新');
      const focusMessage = focusMissing.length ? ` 未更新重点场次：${focusMissing.map((item) => `${item.matchNo} ${item.label}：${item.reason}`).join('；')}。` : '';
      const failureSamples = stats.matchFailureSamples.length ? ` 匹配失败样例：${stats.matchFailureSamples.map((sample) => `${sample.matchNo} ${sample.homeTeam} vs ${sample.awayTeam} ${sample.australiaTime}，ESPN候选 ${sample.candidates.length ? sample.candidates.join(' / ') : '无'}`).join('；')}。` : '';
      setMessage(`实际赛果更新完成：ESPN 返回比赛 ${stats.espnReturned} 场，已完赛 ${stats.espnCompleted} 场，未完赛 ${stats.espnUnfinished} 场，成功更新 ${stats.updated} 场，ESPN 未返回 ${stats.espnMissing} 场，匹配失败 ${stats.matchFailed} 场。${focusMessage}${failureSamples}`);
    } catch (error) {
      setMessage(`ESPN 赛果数据源失败：${error instanceof Error ? error.message : '未知错误'}。ESPN 返回比赛 0 场，已完赛 0 场，未完赛 0 场，成功更新 0 场，ESPN 未返回 ${matches.length} 场，匹配失败 0 场。`);
    } finally {
      setUpdatingResults(false);
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
    return true;
  }),[matches,filters]);
  return <main>
    <div className="shell">
      <TopNav/>
      <DashboardCards matches={matches}/>
      {message && <div className="msg">{message}</div>}
      <ImportExportPanel
        onRecalc={() => setAndSave(matches.map(recalculateMatch))}
        onUpdateResults={updateActualResults}
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
        onClearAll={() => setFilters(defaultFilters)}
      />
      <MatchTable matches={visible} onOpen={setEditing}/>
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
