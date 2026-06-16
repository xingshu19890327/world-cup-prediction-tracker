import referenceRows from '../../reference/seedMatches.from_excel.json';
import type { MatchPrediction } from '../types';
import { recalculateMatch } from '../utils/score';

type ReferenceSeedMatch = Omit<MatchPrediction, 'id' | 'actualResult' | 'claudeWdlPrediction'> & {
  id?: string;
  actualResult?: string;
  claudeWdlPrediction: string;
};

const toMatchPrediction = (row: ReferenceSeedMatch): MatchPrediction => ({
  ...row,
  id: `match-${row.matchNo}`,
  actualScore: row.actualScore ?? '',
  actualResult: (row.actualResult ?? '') as MatchPrediction['actualResult'],
  claudeWdlPrediction: row.claudeWdlPrediction as MatchPrediction['claudeWdlPrediction'],
});

export const seedMatches: MatchPrediction[] = (referenceRows as ReferenceSeedMatch[]).map((row) => recalculateMatch(toMatchPrediction(row)));
