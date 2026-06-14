import type { MatchPrediction } from '../types';
import { recalculateMatch } from './score';

type SourceResult = {
  matchNo?: number;
  utcDate?: string;
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
};

export type ResultsUpdateStats = {
  updated: number;
  skippedExisting: number;
  matchFailed: number;
  sourceFailed: number;
};

export type ResultsUpdateResponse = {
  rows: MatchPrediction[];
  stats: ResultsUpdateStats;
};

const teamAliases: Record<string, string> = {
  '墨西哥': 'mexico',
  '南非': 'southafrica',
  '韩国': 'korea',
  '捷克': 'czechia',
  '加拿大': 'canada',
  '波黑': 'bosniaherzegovina',
  '美国': 'unitedstates',
  '巴拉圭': 'paraguay',
  '土耳其': 'turkey',
  '瑞士': 'switzerland',
  '巴西': 'brazil',
  '摩洛哥': 'morocco',
  '苏格兰': 'scotland',
  '海地': 'haiti',
  '德国': 'germany',
  '库拉索': 'curacao',
  '法国': 'france',
  '挪威': 'norway',
  '卡塔尔': 'qatar',
  '加纳': 'ghana',
  '科特迪瓦': 'ivorycoast',
  '厄瓜多尔': 'ecuador',
  '澳大利亚': 'australia',
  '伊朗': 'iran',
  '西班牙': 'spain',
  '沙特': 'saudiarabia',
  '阿根廷': 'argentina',
  '奥地利': 'austria',
  '英格兰': 'england',
  '克罗地亚': 'croatia',
  '日本': 'japan',
  '荷兰': 'netherlands',
  '新西兰': 'newzealand',
  '埃及': 'egypt',
  '比利时': 'belgium',
  '牙买加': 'jamaica',
  '哥伦比亚': 'colombia',
  '尼日利亚': 'nigeria',
  '乌拉圭': 'uruguay',
  '约旦': 'jordan',
  '塞内加尔': 'senegal',
  '葡萄牙': 'portugal',
  '乌兹别克斯坦': 'uzbekistan',
  '阿尔及利亚': 'algeria',
};

const normalizeTeam = (value: string) => {
  const alias = teamAliases[value.trim()];
  if (alias) return alias;
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
};

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
const sameTeams = (match: MatchPrediction, result: SourceResult) => normalizeTeam(match.homeTeam) === normalizeTeam(result.homeTeam) && normalizeTeam(match.awayTeam) === normalizeTeam(result.awayTeam);
const sameDate = (match: MatchPrediction, result: SourceResult) => Boolean(seedMonthDay(match.australiaTime)) && seedMonthDay(match.australiaTime) === localMonthDay(result.utcDate);

const findMatchIndex = (rows: MatchPrediction[], result: SourceResult) => {
  if (Number.isInteger(result.matchNo)) {
    const index = rows.findIndex((match) => match.matchNo === result.matchNo);
    if (index >= 0) return index;
  }

  const candidates = rows.map((match, index) => ({ match, index })).filter(({ match }) => sameTeams(match, result) && sameDate(match, result));
  return candidates.length === 1 ? candidates[0].index : -1;
};

export const applyFootballDataResults = (rows: MatchPrediction[], results: SourceResult[]): ResultsUpdateResponse => {
  const nextRows = [...rows];
  const stats: ResultsUpdateStats = { updated: 0, skippedExisting: 0, matchFailed: 0, sourceFailed: 0 };

  for (const result of results) {
    const index = findMatchIndex(nextRows, result);
    if (index < 0) {
      stats.matchFailed += 1;
      continue;
    }

    const current = nextRows[index];
    if (current.actualScore.trim()) {
      stats.skippedExisting += 1;
      continue;
    }

    nextRows[index] = recalculateMatch({ ...current, actualScore: `${result.score.home}-${result.score.away}` });
    stats.updated += 1;
  }

  return { rows: nextRows, stats };
};
