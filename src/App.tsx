import { useMemo, useState } from 'react';
import type { FiltersState, MatchPrediction } from './types';
import { importMatches, loadMatches, resetMatches, saveMatches } from './utils/storage';
import { recalculateMatch } from './utils/score';
import { applyFootballDataResults } from './utils/results';
import TopNav from './components/TopNav';
import DashboardCards from './components/DashboardCards';
import Filters from './components/Filters';
import ImportExportPanel, { DataManagementPanel } from './components/ImportExportPanel';
import MatchTable from './components/MatchTable';
import MatchEditor from './components/MatchEditor';
import InfoPanel from './components/InfoPanel';
const defaultFilters: FiltersState = { round:'全部', group:'全部', completion:'全部', hit:'全部', team:'', city:'', quick:'全部' };
const missingOdds = (m: MatchPrediction) => !m.sbHomeOdds || !m.sbDrawOdds || !m.sbAwayOdds || !m.claudeCorrespondingSbWdlOdds;
export default function App(){
  const [matches,setMatches]=useState<MatchPrediction[]>(loadMatches);
  const [filters,setFilters]=useState<FiltersState>(defaultFilters);
  const [editing,setEditing]=useState<MatchPrediction|null>(null);
  const [message,setMessage]=useState('');
  const [updatingResults,setUpdatingResults]=useState(false);
  const [lastResultsUpdate,setLastResultsUpdate]=useState('');
  const setAndSave=(rows:MatchPrediction[])=>{setMatches(rows);saveMatches(rows);setMessage('已保存到本地。')};
  const updateActualResults=async()=>{
    setUpdatingResults(true);
    try {
      const response = await fetch('/api/results');
      const payload = await response.json().catch(()=>({ message: '赛果数据源返回格式错误。' }));
      if(!response.ok) {
        const friendlyMissingToken = '未配置赛果 API token。当前无法自动更新实际赛果，你仍可以手动填写实际比分或导入 JSON。';
        setMessage(payload.error === 'missing_token' ? friendlyMissingToken : payload.message || '赛果数据源失败：无法更新实际赛果。成功更新 0 场，已有比分跳过 0 场，匹配失败 0 场，数据源失败 1 场。');
        return;
      }
      const { rows, stats } = applyFootballDataResults(matches, Array.isArray(payload.matches) ? payload.matches : []);
      setMatches(rows);
      saveMatches(rows);
      const now = new Date().toLocaleString('zh-CN', { hour12: false });
      setLastResultsUpdate(now);
      setMessage(`实际赛果更新完成：成功更新 ${stats.updated} 场，已有比分跳过 ${stats.skippedExisting} 场，匹配失败 ${stats.matchFailed} 场，数据源失败 ${stats.sourceFailed} 场。`);
    } catch {
      setMessage('赛果数据源失败：无法更新实际赛果。成功更新 0 场，已有比分跳过 0 场，匹配失败 0 场，数据源失败 1 场。');
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
