import type { MatchPrediction } from '../types';
export type SportsbetOdds = Partial<Pick<MatchPrediction,'sbHomeOdds'|'sbDrawOdds'|'sbAwayOdds'|'chatgptPredictedScore1Odds'|'chatgptPredictedScore2Odds'|'chatgptPredictedScore3Odds'|'claudePredictedScore1Odds'|'claudePredictedScore2Odds'|'claudePredictedScore3Odds'|'chatgptCorrespondingSbWdlOdds'|'claudeCorrespondingSbWdlOdds'>> & { message?: string; partial?: boolean };
export async function fetchSportsbetOdds(match: MatchPrediction): Promise<SportsbetOdds> {
  const params = new URLSearchParams({ url: match.oddsSource, homeTeam: match.homeTeam, awayTeam: match.awayTeam, chatgptScores: [match.chatgptPredictedScore1,match.chatgptPredictedScore2,match.chatgptPredictedScore3].join(','), claudeScores: [match.claudePredictedScore1,match.claudePredictedScore2,match.claudePredictedScore3].join(','), chatgptWdl: match.chatgptWdlPrediction, claudeWdl: match.claudeWdlPrediction });
  const response = await fetch(`/api/sportsbet?${params}`);
  const data = await response.json().catch(()=>({error:'Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。'}));
  if (!response.ok || data.error) throw new Error(data.error || 'Sportsbet 赔率抓取失败，可能是网站限制、CORS、地区限制或页面结构变化。已保留现有赔率，可手动填写或通过 JSON/CSV 导入。');
  return data.odds as SportsbetOdds;
}
