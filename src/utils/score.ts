import type { MatchPrediction, WdlResult } from '../types';

export const normalizeScore = (value: string) => value.trim().replace(/[：]/g, ':').replace(/[－–—]/g, '-').replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
export const parseScore = (value: string): { home: number; away: number } | null => {
  const normalized = normalizeScore(value);
  const match = normalized.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
};
export const resultFromScore = (score: { home: number; away: number }): WdlResult => score.home > score.away ? '主胜' : score.home < score.away ? '客胜' : '平局';
export const actualWinner = (m: MatchPrediction, result: WdlResult | '') => result === '主胜' ? m.homeTeam : result === '客胜' ? m.awayTeam : result === '平局' ? '平局' : '';
const scoreHit = (actual: string, predictions: string[]) => predictions.some((p) => normalizeScore(p) === normalizeScore(actual));
const hasPrediction = (values: unknown[]) => values.some((value) => String(value ?? '').trim() !== '');
const hasClaudePrediction = (m: MatchPrediction) => hasPrediction([m.claudeWdlPrediction, m.claudePredictedScore1, m.claudePredictedScore2, m.claudePredictedScore3]);
const hasChatgptPrediction = (m: MatchPrediction) => hasPrediction([m.chatgptWdlPrediction, m.chatgptPredictedScore1, m.chatgptPredictedScore2, m.chatgptPredictedScore3]);
const pendingHit = (hasModelPrediction: boolean) => hasModelPrediction ? '待赛' : '';
const oddsHigh = (m: MatchPrediction) => [m.claudeCorrespondingSbWdlOdds, m.sbHomeOdds, m.sbDrawOdds, m.sbAwayOdds].some((v) => Number(v) >= 4);
export const recalculateMatch = (m: MatchPrediction): MatchPrediction => {
  const raw = m.actualScore.trim();
  if (!raw) {
    const disagreement = m.claudeWdlPrediction && m.chatgptWdlPrediction && m.claudeWdlPrediction !== m.chatgptWdlPrediction ? '分歧' : '';
    const claudePendingHit = pendingHit(hasClaudePrediction(m));
    const chatgptPendingHit = pendingHit(hasChatgptPrediction(m));
    return { ...m, actualResult: '', chatgptActualWinner: '', completionStatus: '未赛', claudeAnyScoreHit: claudePendingHit, claudeWdlHit: claudePendingHit, chatgptAnyScoreHit: chatgptPendingHit, chatgptWdlHit: chatgptPendingHit, predictionDisagreement: disagreement, highOddsTag: oddsHigh(m) ? '高赔率' : m.highOddsTag };
  }
  const score = parseScore(raw);
  if (!score) return { ...m, actualResult: '', completionStatus: '比分格式错误', claudeAnyScoreHit: '比分格式错误', claudeWdlHit: '比分格式错误', chatgptAnyScoreHit: '比分格式错误', chatgptWdlHit: '比分格式错误' };
  const actualResult = resultFromScore(score);
  const winner = actualWinner(m, actualResult);
  const chatgptHit = m.chatgptWdlPrediction === '平局' ? actualResult === '平局' : m.chatgptWdlPrediction === winner;
  return {
    ...m,
    actualResult,
    chatgptActualWinner: winner,
    completionStatus: '已完赛',
    claudeAnyScoreHit: scoreHit(raw, [m.claudePredictedScore1, m.claudePredictedScore2, m.claudePredictedScore3]) ? '✓' : '×',
    claudeWdlHit: m.claudeWdlPrediction === actualResult ? '✓' : '×',
    chatgptAnyScoreHit: scoreHit(raw, [m.chatgptPredictedScore1, m.chatgptPredictedScore2, m.chatgptPredictedScore3]) ? '✓' : '×',
    chatgptWdlHit: chatgptHit ? '✓' : '×',
    predictionDisagreement: m.claudeWdlPrediction && m.chatgptWdlPrediction && m.claudeWdlPrediction !== (m.chatgptWdlPrediction === m.homeTeam ? '主胜' : m.chatgptWdlPrediction === m.awayTeam ? '客胜' : m.chatgptWdlPrediction) ? '分歧' : '',
    highOddsTag: oddsHigh(m) ? '高赔率' : m.highOddsTag,
  };
};
