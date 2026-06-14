import { seedMatches } from '../data/seedMatches';
import type { MatchPrediction } from '../types';
import { recalculateMatch } from './score';
const KEY = 'world-cup-tracker-v4-matches';
export const loadMatches = () => { try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as MatchPrediction[]).map(recalculateMatch) : seedMatches; } catch { return seedMatches; } };
export const saveMatches = (rows: MatchPrediction[]) => localStorage.setItem(KEY, JSON.stringify(rows));
export const resetMatches = () => { saveMatches(seedMatches); return seedMatches; };
export const importMatches = (text: string) => (JSON.parse(text) as MatchPrediction[]).map(recalculateMatch);
export const download = (name: string, content: string, type: string) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };
