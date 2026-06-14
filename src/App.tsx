import { useMemo, useState } from 'react';
import type { FiltersState, MatchPrediction } from './types';
import { importMatches, loadMatches, resetMatches, saveMatches } from './utils/storage';
import { recalculateMatch } from './utils/score';
import TopNav from './components/TopNav';
import DashboardCards from './components/DashboardCards';
import Filters from './components/Filters';
import ImportExportPanel from './components/ImportExportPanel';
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
  const setAndSave=(rows:MatchPrediction[])=>{setMatches(rows);saveMatches(rows);setMessage('已保存到本地。')};
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
  return <main><div className="shell"><TopNav/><DashboardCards matches={matches}/>{message&&<div className="msg">{message}</div>}<ImportExportPanel matches={matches} onRecalc={()=>setAndSave(matches.map(recalculateMatch))} onReset={()=>{if(confirm('确定重新载入 Excel 基准数据？当前本地修改会被覆盖，建议先导出 JSON。')) setAndSave(resetMatches())}} onImport={(text)=>{try{setAndSave(importMatches(text))}catch{setMessage('导入失败：JSON 格式错误。')}}}/><Filters filters={filters} setFilters={setFilters} visibleCount={visible.length} totalCount={matches.length} groups={groups} rounds={rounds} onClearAll={()=>setFilters(defaultFilters)}/><MatchTable matches={visible} onOpen={setEditing}/><InfoPanel/><MatchEditor match={editing} onChange={setEditing} onClose={()=>setEditing(null)} onSave={()=>{if(editing) { setAndSave(matches.map(m=>m.id===editing.id?recalculateMatch(editing):m)); setEditing(null); }}}/></div></main>;
}
