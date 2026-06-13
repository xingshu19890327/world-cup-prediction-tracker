import { seedMatches } from '../data/seedMatches';
import type { MatchInput, MatchPrediction } from '../types';
import { recalculateMatch } from './score';
const KEY='world-cup-2026-prediction-tracker';
const META_KEY='world-cup-2026-prediction-tracker-meta';
export type TrackerMeta={lastResultUpdate?:string;lastOddsUpdate?:string;lastManualSave?:string;notice?:string};
export function nowText(){return new Date().toLocaleString('zh-CN',{hour12:false});}
export function loadMatches(): MatchPrediction[]{ try{const raw=localStorage.getItem(KEY); if(!raw) return seedMatches; const parsed=JSON.parse(raw) as MatchInput[]; if(!Array.isArray(parsed)) throw new Error('bad data'); return parsed.map(recalculateMatch);}catch{try{localStorage.setItem(`${KEY}-fallback-notice`,'localStorage 读取失败，已载入示例数据。');}catch{/* noop */} return seedMatches;} }
export function loadMeta(): TrackerMeta{try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {notice:'localStorage 读取失败，已使用默认时间信息。'}}}
export function saveMeta(meta: TrackerMeta): void { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
export function saveMatches(matches: MatchPrediction[]): void { localStorage.setItem(KEY, JSON.stringify(matches)); }
export function resetMatches(): MatchPrediction[]{ saveMatches(seedMatches); return seedMatches; }
export function importMatches(jsonText: string): MatchPrediction[]{ const data=JSON.parse(jsonText); if(!Array.isArray(data)) throw new Error('导入失败：JSON 必须是比赛数组。'); return data.map((m)=>recalculateMatch(m as MatchInput)); }
