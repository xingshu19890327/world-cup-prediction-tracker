import type { MatchPrediction } from '../types';

const trackerChineseDisplayNames: Record<string, string> = {
  '刚果': '刚果民主共和国',
};

export const teamDisplayName = (teamName: string) => trackerChineseDisplayNames[teamName] ?? teamName;

export const matchTeamDisplayName = (match: MatchPrediction, key: 'homeTeam' | 'awayTeam') => teamDisplayName(String(match[key] ?? ''));
