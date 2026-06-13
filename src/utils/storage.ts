import { seedMatches } from '../data/seedMatches';
import type { MatchInput, MatchPrediction } from '../types';
import { recalculateMatch } from './score';
const KEY='world-cup-2026-prediction-tracker';
export function loadMatches(): MatchPrediction[]{ try{const raw=localStorage.getItem(KEY); if(!raw) return seedMatches; const parsed=JSON.parse(raw) as MatchInput[]; return parsed.map(recalculateMatch);}catch{return seedMatches;} }
export function saveMatches(matches: MatchPrediction[]): void { localStorage.setItem(KEY, JSON.stringify(matches)); }
export function resetMatches(): MatchPrediction[]{ saveMatches(seedMatches); return seedMatches; }
export function importMatches(jsonText: string): MatchPrediction[]{ const data=JSON.parse(jsonText); if(!Array.isArray(data)) throw new Error('JSON 必须是比赛数组。'); return data.map((m)=>recalculateMatch(m as MatchInput)); }
