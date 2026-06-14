import type { MatchPrediction } from '../types';
const cols: (keyof MatchPrediction)[] = ['matchNo','group','round','australiaTime','homeTeam','awayTeam','city','actualScore','actualResult','completionStatus','claudePredictedScore1','claudePredictedScore2','claudePredictedScore3','claudeWdlPrediction','claudeAnyScoreHit','claudeWdlHit','chatgptWdlPrediction','chatgptActualWinner','chatgptWdlHit','chatgptAnyScoreHit','chatgptPredictedScore1','chatgptPredictedScore2','chatgptPredictedScore3','predictionDisagreement','notes','preMatchNotes','postMatchReview','focusLevel'];
const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const toCsv = (rows: MatchPrediction[]) => [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
