import { seedMatches } from '../data/seedMatches';
import type { ColumnPrefs, MatchInput, MatchPrediction, TrackerMeta } from '../types';
import { recalculateMatch } from './score';
const KEY='world-cup-prediction-tracker-v2'; const OLD='world-cup-prediction-tracker'; const META='world-cup-prediction-tracker-meta'; const PREF='world-cup-column-prefs'; const SNAP='world-cup-backup-snapshots';
export const nowText=()=>new Date().toLocaleString('zh-CN',{hour12:false});
const meta0:TrackerMeta={lastResultUpdate:'',lastOddsUpdate:'',lastImportTime:'',lastManualSave:''};
export function loadMatches():MatchPrediction[]{ try{const raw=localStorage.getItem(KEY)||localStorage.getItem(OLD); if(!raw) return seedMatches; const data=JSON.parse(raw); if(!Array.isArray(data)) throw new Error('bad'); return data.map((m:MatchInput)=>recalculateMatch(m));}catch{ return seedMatches; } }
export function saveMatches(matches:MatchPrediction[]):void{ localStorage.setItem(KEY,JSON.stringify(matches)); }
export function resetMatches():MatchPrediction[]{ saveMatches(seedMatches); return seedMatches; }
export function importMatches(jsonText:string):MatchPrediction[]{ const data=JSON.parse(jsonText); if(!Array.isArray(data)) throw new Error('导入失败：JSON 必须是比赛数组。'); return data.map((m:MatchInput)=>recalculateMatch(m)); }
export function loadMeta():TrackerMeta{ try{return {...meta0,...JSON.parse(localStorage.getItem(META)||'{}')}}catch{return meta0} }
export function saveMeta(meta:TrackerMeta){ localStorage.setItem(META,JSON.stringify(meta)); }
export function loadColumnPrefs():ColumnPrefs{ try{return JSON.parse(localStorage.getItem(PREF)||'{}')}catch{return{}} }
export function saveColumnPrefs(p:ColumnPrefs){ localStorage.setItem(PREF,JSON.stringify(p)); }
export type Snapshot={name:string;createdAt:string;matches:MatchPrediction[]};
export function addSnapshot(matches:MatchPrediction[],name=`world-cup-tracker-backup-${new Date().toISOString().slice(0,16).replace(/-/g,'').replace(/:/g,'').replace(/T/g,'')}.json`){ const list=loadSnapshots(); list.unshift({name,createdAt:nowText(),matches}); localStorage.setItem(SNAP,JSON.stringify(list.slice(0,5))); }
export function loadSnapshots():Snapshot[]{ try{const v=JSON.parse(localStorage.getItem(SNAP)||'[]'); return Array.isArray(v)?v:[]}catch{return[]} }
