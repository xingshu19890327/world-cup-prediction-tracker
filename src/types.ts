export type WdlResult = '主胜' | '平局' | '客胜';
export type WdlPrediction = WdlResult | 'TBD' | '';
export type HitStatus = '✅' | '❌' | '待赛' | '';
export type MatchPrediction = {
  id: string; matchNo: number; group: string; round: string; easternTime: string; australiaTime: string; homeTeam: string; awayTeam: string; city: string;
  wdlPrediction: WdlPrediction; correspondingSbWdlOdds: number | '';
  predictedScore1: string; predictedScore1Odds: number | ''; predictedScore1Result: WdlResult | '';
  predictedScore2: string; predictedScore2Odds: number | ''; predictedScore2Result: WdlResult | '';
  predictedScore3: string; predictedScore3Odds: number | ''; predictedScore3Result: WdlResult | '';
  sbHomeOdds: number | ''; sbDrawOdds: number | ''; sbAwayOdds: number | '';
  actualScore: string; actualResult: WdlResult | ''; scoreHit: HitStatus; wdlHit: HitStatus;
  notes: string; oddsSource: string;
};
export type MatchInput = Omit<MatchPrediction,'id'|'predictedScore1Result'|'predictedScore2Result'|'predictedScore3Result'|'actualResult'|'scoreHit'|'wdlHit'> & Partial<Pick<MatchPrediction,'id'|'predictedScore1Result'|'predictedScore2Result'|'predictedScore3Result'|'actualResult'|'scoreHit'|'wdlHit'>>;
export const rounds = ['第1轮','第2轮','第3轮','1/16决赛','1/8决赛','1/4决赛','半决赛','Third Place Playoff','决赛'];
export const groups = ['', ...'ABCDEFGHIJKL'.split('')];
export type SortKey = 'matchNo' | 'australiaTime' | 'round';
export type FiltersState = { round: string; group: string; team: string; city: string; completion: '全部'|'已完成'|'待赛'; hit: '全部'|'比分命中'|'比分未中'|'赛果命中'|'赛果未中'; sort: SortKey };
