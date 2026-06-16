import type { MatchPrediction } from '../types';
import { recalculateMatch } from './score';

type EspnTeam = string | {
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
};

type SourceResult = {
  matchNo?: number;
  utcDate?: string;
  date?: string;
  homeTeam: EspnTeam;
  awayTeam: EspnTeam;
  score: { home: number; away: number };
};

export type ResultsUpdateStats = {
  updated: number;
  skippedExisting: number;
  skippedBelowMatchNo16: number;
  matchFailed: number;
  sourceCompleted: number;
};

export type ResultsUpdateResponse = {
  rows: MatchPrediction[];
  stats: ResultsUpdateStats;
};

const teamAliases: Record<string, string> = {
  '墨西哥': 'mexico', mexico: 'mexico',
  '南非': 'southafrica', 'south africa': 'southafrica', southafrica: 'southafrica',
  '韩国': 'southkorea', korea: 'southkorea', 'south korea': 'southkorea', republicofkorea: 'southkorea',
  '捷克': 'czechia', czechia: 'czechia', 'czech republic': 'czechia', czechrepublic: 'czechia',
  '加拿大': 'canada', canada: 'canada',
  '波黑': 'bosniaherzegovina', 'bosnia and herzegovina': 'bosniaherzegovina', bosniaherzegovina: 'bosniaherzegovina',
  '美国': 'unitedstates', usa: 'unitedstates', us: 'unitedstates', 'united states': 'unitedstates', unitedstates: 'unitedstates',
  '巴拉圭': 'paraguay', paraguay: 'paraguay',
  '卡塔尔': 'qatar', qatar: 'qatar',
  '瑞士': 'switzerland', switzerland: 'switzerland',
  '巴西': 'brazil', brazil: 'brazil',
  '摩洛哥': 'morocco', morocco: 'morocco',
  '海地': 'haiti', haiti: 'haiti',
  '苏格兰': 'scotland', scotland: 'scotland',
  '澳大利亚': 'australia', australia: 'australia',
  '土耳其': 'turkey', turkey: 'turkey', turkiye: 'turkey', türkiye: 'turkey',
  '德国': 'germany', germany: 'germany',
  '库拉索': 'curacao', curaçao: 'curacao', curacao: 'curacao',
  '荷兰': 'netherlands', netherlands: 'netherlands', holland: 'netherlands',
  '日本': 'japan', japan: 'japan',
  '科特迪瓦': 'ivorycoast', "cote d'ivoire": 'ivorycoast', 'côte d’ivoire': 'ivorycoast', 'ivory coast': 'ivorycoast', ivorycoast: 'ivorycoast',
  '厄瓜多尔': 'ecuador', ecuador: 'ecuador',
  '瑞典': 'sweden', sweden: 'sweden',
  '突尼斯': 'tunisia', tunisia: 'tunisia',
  '西班牙': 'spain', spain: 'spain',
  '佛得角': 'capeverde', 'cape verde': 'capeverde', capeverde: 'capeverde', 'cabo verde': 'capeverde', caboverde: 'capeverde',
  '比利时': 'belgium', belgium: 'belgium',
  '埃及': 'egypt', egypt: 'egypt',
  '沙特': 'saudiarabia', 'saudi arabia': 'saudiarabia', saudiarabia: 'saudiarabia',
  '乌拉圭': 'uruguay', uruguay: 'uruguay',
  '伊朗': 'iran', iran: 'iran',
  '新西兰': 'newzealand', 'new zealand': 'newzealand', newzealand: 'newzealand',
  '法国': 'france', france: 'france',
  '塞内加尔': 'senegal', senegal: 'senegal',
  '伊拉克': 'iraq', iraq: 'iraq',
  '挪威': 'norway', norway: 'norway',
  '阿根廷': 'argentina', argentina: 'argentina',
  '阿尔及利亚': 'algeria', algeria: 'algeria',
  '奥地利': 'austria', austria: 'austria',
  '约旦': 'jordan', jordan: 'jordan',
  '葡萄牙': 'portugal', portugal: 'portugal',
  '刚果': 'congodr', '刚果民主共和国': 'congodr', 'congo dr': 'congodr', 'dr congo': 'congodr', congodr: 'congodr', 'democratic republic of congo': 'congodr',
  '英格兰': 'england', england: 'england',
  '克罗地亚': 'croatia', croatia: 'croatia',
  '加纳': 'ghana', ghana: 'ghana',
  '巴拿马': 'panama', panama: 'panama',
  '乌兹别克斯坦': 'uzbekistan', uzbekistan: 'uzbekistan',
  '哥伦比亚': 'colombia', colombia: 'colombia',
};

const cleanTeamKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

const normalizeTeamValue = (value: string) => {
  const trimmed = value.trim();
  const directAlias = teamAliases[trimmed];
  if (directAlias) return directAlias;
  const cleaned = cleanTeamKey(trimmed);
  return teamAliases[cleaned] ?? cleaned;
};

const teamNames = (team: EspnTeam) => typeof team === 'string' ? [team] : [team.displayName, team.shortDisplayName, team.abbreviation].filter((value): value is string => Boolean(value));
const normalizedTeamSet = (team: EspnTeam) => new Set(teamNames(team).map(normalizeTeamValue));
const teamMatches = (trackerTeam: string, espnTeam: EspnTeam) => normalizedTeamSet(espnTeam).has(normalizeTeamValue(trackerTeam));

const localMonthDay = (utcDate?: string) => {
  if (!utcDate) return '';
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return month && day ? `${Number(month)}/${Number(day)}` : '';
};

const seedMonthDay = (australiaTime: string) => australiaTime.match(/^(\d{1,2})\/(\d{1,2})/)?.slice(1, 3).map(Number).join('/') ?? '';
const sameDate = (match: MatchPrediction, result: SourceResult) => Boolean(seedMonthDay(match.australiaTime)) && seedMonthDay(match.australiaTime) === localMonthDay(result.utcDate ?? result.date);
const sameTeamsEitherOrder = (match: MatchPrediction, result: SourceResult) => (teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam)) || (teamMatches(match.homeTeam, result.awayTeam) && teamMatches(match.awayTeam, result.homeTeam));

const findMatchIndex = (rows: MatchPrediction[], result: SourceResult) => {
  const candidates = rows.map((match, index) => ({ match, index })).filter(({ match }) => sameTeamsEitherOrder(match, result) && sameDate(match, result));
  return candidates.length === 1 ? candidates[0].index : -1;
};

const trackerScore = (match: MatchPrediction, result: SourceResult) => {
  if (teamMatches(match.homeTeam, result.homeTeam) && teamMatches(match.awayTeam, result.awayTeam)) return `${result.score.home}-${result.score.away}`;
  if (teamMatches(match.homeTeam, result.awayTeam) && teamMatches(match.awayTeam, result.homeTeam)) return `${result.score.away}-${result.score.home}`;
  return '';
};

export const applyEspnResults = (rows: MatchPrediction[], results: SourceResult[]): ResultsUpdateResponse => {
  const nextRows = [...rows];
  const stats: ResultsUpdateStats = { updated: 0, skippedExisting: 0, skippedBelowMatchNo16: 0, matchFailed: 0, sourceCompleted: results.length };

  for (const result of results) {
    const index = findMatchIndex(nextRows, result);
    if (index < 0) {
      stats.matchFailed += 1;
      continue;
    }

    const current = nextRows[index];
    if (current.matchNo < 16) {
      stats.skippedBelowMatchNo16 += 1;
      continue;
    }

    if (current.actualScore.trim()) {
      stats.skippedExisting += 1;
      continue;
    }

    const actualScore = trackerScore(current, result);
    if (!actualScore) {
      stats.matchFailed += 1;
      continue;
    }

    nextRows[index] = recalculateMatch({ ...current, actualScore });
    stats.updated += 1;
  }

  return { rows: nextRows, stats };
};
