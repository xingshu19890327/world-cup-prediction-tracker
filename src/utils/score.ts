import type { MatchPrediction, WdlResult } from '../types';

export const normalizeScore = (value: string) =>
  value
    .trim()
    .replace(/[：]/g, ':')
    .replace(/[－–—]/g, '-')
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));

export const parseScore = (value: string): { home: number; away: number } | null => {
  const normalized = normalizeScore(value);
  const match = normalized.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
};

export const resultFromScore = (score: { home: number; away: number }): WdlResult => {
  if (score.home > score.away) return '主胜';
  if (score.home < score.away) return '客胜';
  return '平局';
};

export const actualWinner = (m: MatchPrediction, result: WdlResult | '') => {
  if (result === '主胜') return m.homeTeam;
  if (result === '客胜') return m.awayTeam;
  if (result === '平局') return '平局';
  return '';
};

const scoreHit = (actual: string, predictions: string[]) =>
  predictions.some((p) => normalizeScore(p) === normalizeScore(actual));

const oddsHigh = (m: MatchPrediction) =>
  [m.claudeCorrespondingSbWdlOdds, m.sbHomeOdds, m.sbDrawOdds, m.sbAwayOdds].some((v) => Number(v) >= 4);

const predictionFromScore = (m: MatchPrediction, value: string) => {
  const score = parseScore(value);
  if (!score) return '';
  if (score.home > score.away) return m.homeTeam;
  if (score.home < score.away) return m.awayTeam;
  return '平局';
};

export const normalizeChatGptPrediction = (m: MatchPrediction) => {
  const value = m.chatgptWdlPrediction.trim();
  if (!value || value === '平局' || value === m.homeTeam || value === m.awayTeam) return value;

  const predictions = [
    predictionFromScore(m, m.chatgptPredictedScore1),
    predictionFromScore(m, m.chatgptPredictedScore2),
    predictionFromScore(m, m.chatgptPredictedScore3),
  ].filter(Boolean);

  const majority = predictions.find((prediction) => predictions.filter((item) => item === prediction).length > predictions.length / 2);
  return majority || predictions[0] || '';
};

const chatGptPredictionAsWdl = (m: MatchPrediction, prediction: string): WdlResult | '' => {
  if (prediction === m.homeTeam) return '主胜';
  if (prediction === m.awayTeam) return '客胜';
  if (prediction === '平局') return '平局';
  return '';
};

export const recalculateMatch = (m: MatchPrediction): MatchPrediction => {
  const chatgptWdlPrediction = normalizeChatGptPrediction(m);
  const normalized = { ...m, chatgptWdlPrediction };
  const raw = normalized.actualScore.trim();
  const chatGptWdl = chatGptPredictionAsWdl(normalized, chatgptWdlPrediction);

  if (!raw) {
    const disagreement = normalized.claudeWdlPrediction && chatGptWdl && normalized.claudeWdlPrediction !== chatGptWdl ? '分歧' : '';
    return {
      ...normalized,
      actualResult: '',
      chatgptActualWinner: '',
      completionStatus: '未赛',
      claudeAnyScoreHit: '待赛',
      claudeWdlHit: '待赛',
      chatgptAnyScoreHit: '待赛',
      chatgptWdlHit: '待赛',
      predictionDisagreement: disagreement,
      highOddsTag: oddsHigh(normalized) ? '高赔率' : normalized.highOddsTag,
    };
  }

  const score = parseScore(raw);
  if (!score) {
    return {
      ...normalized,
      actualResult: '',
      completionStatus: '比分格式错误',
      claudeAnyScoreHit: '比分格式错误',
      claudeWdlHit: '比分格式错误',
      chatgptAnyScoreHit: '比分格式错误',
      chatgptWdlHit: '比分格式错误',
    };
  }

  const actualResult = resultFromScore(score);
  const winner = actualWinner(normalized, actualResult);
  const chatgptHit = chatgptWdlPrediction === '平局' ? actualResult === '平局' : chatgptWdlPrediction === winner;

  return {
    ...normalized,
    actualResult,
    chatgptActualWinner: winner,
    completionStatus: '已完赛',
    claudeAnyScoreHit: scoreHit(raw, [normalized.claudePredictedScore1, normalized.claudePredictedScore2, normalized.claudePredictedScore3]) ? '✓' : '×',
    claudeWdlHit: normalized.claudeWdlPrediction === actualResult ? '✓' : '×',
    chatgptAnyScoreHit: scoreHit(raw, [normalized.chatgptPredictedScore1, normalized.chatgptPredictedScore2, normalized.chatgptPredictedScore3]) ? '✓' : '×',
    chatgptWdlHit: chatgptHit ? '✓' : '×',
    predictionDisagreement: normalized.claudeWdlPrediction && chatGptWdl && normalized.claudeWdlPrediction !== chatGptWdl ? '分歧' : '',
    highOddsTag: oddsHigh(normalized) ? '高赔率' : normalized.highOddsTag,
  };
};
