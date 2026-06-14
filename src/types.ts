export type WdlResult = '主胜' | '平局' | '客胜';
export type HitStatus = '✓' | '×' | '✅' | '❌' | '待赛' | '比分格式错误' | '';
export type CompletionStatus = '未赛' | '已完赛' | '比分格式错误';
export type FocusLevel = '普通' | '重点' | '高风险' | '值得复盘';

export type MatchPrediction = {
  id: string;
  matchNo: number;
  group: string;
  round: string;
  australiaTime: string;
  homeTeam: string;
  awayTeam: string;
  city: string;
  actualScore: string;
  actualResult: WdlResult | '';
  completionStatus: CompletionStatus;
  claudePredictedScore1: string;
  claudePredictedScore2: string;
  claudePredictedScore3: string;
  claudeWdlPrediction: WdlResult | '';
  claudeCorrespondingSbWdlOdds: string | number;
  sbHomeOdds: string | number;
  sbDrawOdds: string | number;
  sbAwayOdds: string | number;
  claudeAnyScoreHit: HitStatus;
  claudeWdlHit: HitStatus;
  chatgptWdlPrediction: string;
  chatgptActualWinner: string;
  chatgptWdlHit: HitStatus;
  chatgptAnyScoreHit: HitStatus;
  chatgptPredictedScore1: string;
  chatgptPredictedScore2: string;
  chatgptPredictedScore3: string;
  predictionDisagreement: string;
  highOddsTag: string;
  notes: string;
  oddsSource: string;
  preMatchNotes: string;
  postMatchReview: string;
  focusLevel: FocusLevel;
};

export type FiltersState = {
  round: string;
  group: string;
  completion: '全部' | CompletionStatus;
  hit: string;
  team: string;
  city: string;
  quick: QuickFilter;
};

export type QuickFilter = '全部' | '已完赛' | '未赛' | 'Claude赛果命中' | 'ChatGPT赛果命中' | 'Claude比分命中' | 'ChatGPT比分命中' | '双方都错' | '双方预测分歧' | '赔率缺失' | '高赔率';
export const quickFilters: QuickFilter[] = ['全部','已完赛','未赛','Claude赛果命中','ChatGPT赛果命中','Claude比分命中','ChatGPT比分命中','双方都错','双方预测分歧','赔率缺失','高赔率'];
export const focusLevels: FocusLevel[] = ['普通', '重点', '高风险', '值得复盘'];
