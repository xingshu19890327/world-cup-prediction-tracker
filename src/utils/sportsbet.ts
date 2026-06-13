import type { MatchPrediction } from '../types';
export type SportsbetOdds = Partial<Pick<MatchPrediction,'sbHomeOdds'|'sbDrawOdds'|'sbAwayOdds'|'predictedScore1Odds'|'predictedScore2Odds'|'predictedScore3Odds'|'claudePredictedScore1Odds'|'claudePredictedScore2Odds'|'claudePredictedScore3Odds'|'correspondingSbWdlOdds'|'claudeCorrespondingSbWdlOdds'>> & { message?: string; partial?: boolean };
export async function fetchSportsbetOdds(match: MatchPrediction): Promise<SportsbetOdds> {
  if (!match.oddsSource) throw new Error('缺少赔率来源');
  const params = new URLSearchParams({ url: match.oddsSource, homeTeam: match.homeTeam, awayTeam: match.awayTeam, chatgptScores: [match.predictedScore1,match.predictedScore2,match.predictedScore3].join(','), claudeScores: [match.claudePredictedScore1,match.claudePredictedScore2,match.claudePredictedScore3].join(','), chatgptWdl: match.wdlPrediction, claudeWdl: match.claudeWdlPrediction });
  const response = await fetch(`/api/sportsbet?${params.toString()}`);
  const data = await response.json().catch(()=>({error:'Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。'}));
  if (!response.ok || data.error) throw new Error(data.error || 'Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。');
  return data.odds ?? data;
}
