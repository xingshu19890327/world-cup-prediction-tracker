import { seedMatches } from '../data/seedMatches';
import type { MatchPrediction, TableLayoutState } from '../types';
import { recalculateMatch } from './score';

const KEY = 'world-cup-tracker-v4-matches';
const COLUMN_WIDTHS_KEY = 'columnWidths';
const COLUMN_ORDER_KEY = 'columnOrder';
const HIDDEN_COLUMNS_KEY = 'hiddenColumns';
const FROZEN_COLUMNS_KEY = 'frozenColumns';

export const defaultTableLayout: TableLayoutState = {
  columnWidths: {},
  columnOrder: [],
  hiddenColumns: ['oddsSource'],
  frozenColumns: 10,
};

export const loadMatches = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MatchPrediction[]).map(recalculateMatch) : seedMatches;
  } catch {
    return seedMatches;
  }
};

export const saveMatches = (rows: MatchPrediction[]) => localStorage.setItem(KEY, JSON.stringify(rows));
export const resetMatches = () => { saveMatches(seedMatches); return seedMatches; };
export const importMatches = (text: string) => (JSON.parse(text) as MatchPrediction[]).map(recalculateMatch);
export const download = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

export const loadTableLayout = (): TableLayoutState => ({
  columnWidths: readJson<Record<string, number>>(COLUMN_WIDTHS_KEY, defaultTableLayout.columnWidths),
  columnOrder: readJson<(keyof MatchPrediction)[]>(COLUMN_ORDER_KEY, defaultTableLayout.columnOrder),
  hiddenColumns: readJson<(keyof MatchPrediction)[]>(HIDDEN_COLUMNS_KEY, defaultTableLayout.hiddenColumns),
  frozenColumns: readJson<number>(FROZEN_COLUMNS_KEY, defaultTableLayout.frozenColumns),
});

export const saveTableLayout = (layout: TableLayoutState) => {
  localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(layout.columnWidths));
  localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(layout.columnOrder));
  localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(layout.hiddenColumns));
  localStorage.setItem(FROZEN_COLUMNS_KEY, JSON.stringify(layout.frozenColumns));
};

export const clearTableLayout = () => {
  localStorage.removeItem(COLUMN_WIDTHS_KEY);
  localStorage.removeItem(COLUMN_ORDER_KEY);
  localStorage.removeItem(HIDDEN_COLUMNS_KEY);
  localStorage.removeItem(FROZEN_COLUMNS_KEY);
};
