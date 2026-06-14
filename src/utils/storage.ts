import { seedMatches } from '../data/seedMatches';
import { rounds, type ColumnPrefs, type MatchInput, type MatchPrediction, type TrackerMeta } from '../types';
import { recalculateMatch } from './score';
const KEY='world-cup-tracker-v2',OLD='worldCupPredictions',META='world-cup-tracker-meta',PREF='world-cup-column-prefs',SNAP='world-cup-tracker-snapshots';
const meta0:TrackerMeta={lastResultUpdate:'',lastOddsUpdate:'',lastImportTime:'',lastManualSave:''};
export const TARGET_MATCH_COUNT = 104;
export const hasIncompleteBaseSchedule=(matches:MatchPrediction[]):boolean=>matches.length<TARGET_MATCH_COUNT;
export function normalizeRound(round: unknown): string { const value=String(round ?? '').trim(); if(value==='Round 1') return '第1轮'; if(value==='Round 2') return '第2轮'; if(value==='Round 3') return '第3轮'; return rounds.includes(value) ? value : value; }
const normalizeMatch=(m:MatchInput):MatchPrediction=>recalculateMatch({...m,round:normalizeRound(m.round)});
export function nowText(){ return new Date().toLocaleString('zh-CN',{hour12:false}); }
export function loadMatches():MatchPrediction[]{ try{const raw=localStorage.getItem(KEY)||localStorage.getItem(OLD); if(!raw) return seedMatches; const data=JSON.parse(raw); if(!Array.isArray(data)) throw new Error('bad'); return data.map((m:MatchInput)=>normalizeMatch(m));}catch{ return seedMatches; } }
export function saveMatches(matches:MatchPrediction[]):void{ localStorage.setItem(KEY,JSON.stringify(matches.map((m)=>({...m,round:normalizeRound(m.round)})))); }
export function resetMatches():MatchPrediction[]{ saveMatches(seedMatches); return seedMatches; }
export function forceLoadSeedMatches(current:MatchPrediction[]):MatchPrediction[]{ addSnapshot(current, undefined, true); localStorage.removeItem(OLD); saveMatches(seedMatches); return seedMatches; }
export function importMatches(jsonText:string):MatchPrediction[]{ const data=JSON.parse(jsonText); if(!Array.isArray(data)) throw new Error('导入失败：JSON 必须是比赛数组。'); return data.map((m:MatchInput)=>normalizeMatch(m)); }
export function loadMeta():TrackerMeta{ try{return {...meta0,...JSON.parse(localStorage.getItem(META)||'{}')}}catch{return meta0} }
export function saveMeta(meta:TrackerMeta){ localStorage.setItem(META,JSON.stringify(meta)); }
export function loadColumnPrefs():ColumnPrefs{ try{return JSON.parse(localStorage.getItem(PREF)||'{}')}catch{return{}} }
export function saveColumnPrefs(p:ColumnPrefs){ localStorage.setItem(PREF,JSON.stringify(p)); }
export type Snapshot={name:string;createdAt:string;matches:MatchPrediction[]};
export function addSnapshot(matches:MatchPrediction[],name=`world-cup-tracker-backup-${new Date().toISOString().slice(0,16).replace(/-/g,'').replace(/:/g,'').replace(/T/g,'')}.json`,download=false){ const list=loadSnapshots(); list.unshift({name,createdAt:nowText(),matches}); localStorage.setItem(SNAP,JSON.stringify(list.slice(0,5))); if(download) downloadBackup(name, matches); }
function downloadBackup(name:string,matches:MatchPrediction[]){ if(typeof document==='undefined') return; const blob=new Blob([JSON.stringify(matches,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
export function loadSnapshots():Snapshot[]{ try{const v=JSON.parse(localStorage.getItem(SNAP)||'[]'); return Array.isArray(v)?v:[]}catch{return[]} }
