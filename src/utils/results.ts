import type { MatchPrediction } from '../types';
import { recalculateMatch } from './score';

type SourceResult = {
  matchNo?: number;
  utcDate?: string;
  completed?: boolean;
  homeTeam: string;
  awayTeam: string;
  homeAbbreviation?: string;
  awayAbbreviation?: string;
  score?: { home: number; away: number } | null;
};

export type ResultsUpdateStats = {
  updated: number;
  skippedExisting: number;
  skippedBeforeMatch16: number;
  matchFailed: number;
  unfinishedSkipped: number;
  sourceFailed: number;
  espnCompleted: number;
  espnUnfinished: number;
};

export type ResultsUpdateResponse = {
  rows: MatchPrediction[];
  stats: ResultsUpdateStats;
  match16Diagnostic?: string;
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
  'ir iran': 'iran',
  'islamic republic of iran': 'iran',
  'irn': 'iran',
  '西班牙': 'spain',
  '沙特': 'saudiarabia',
  '阿根廷': 'argentina',
  '奥地利': 'austria',
  '英格兰': 'england',
  '克罗地亚': 'croatia',
  '日本': 'japan',
  '荷兰': 'netherlands',
  '新西兰': 'newzealand',
  'nzl': 'newzealand',
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

const compactTeam = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const normalizeTeam = (value: string) => teamAliases[value.trim().toLowerCase()] ?? teamAliases[value.trim()] ?? compactTeam(value);
const normalizeSourceSide = (name: string, abbreviation?: string) => [normalizeTeam(name), abbreviation ? normalizeTeam(abbreviation) : ''].filter(Boolean);

export const espnDateFromAustraliaTime = (australiaTime: string) => {
  const match = australiaTime.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!match) return '';
  return `2026${match[1].padStart(2, '0')}${match[2].padStart(2, '0')}`;
};

const seedUtcDate = (australiaTime: string) => {
  const yyyymmdd = espnDateFromAustraliaTime(australiaTime);
  if (!yyyymmdd) return null;
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  return Date.UTC(year, month - 1, day);
};

const sourceUtcDate = (utcDate?: string) => {
  if (!utcDate) return null;
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const sameDate = (match: MatchPrediction, result: SourceResult) => {
  const seed = seedUtcDate(match.australiaTime);
  const source = sourceUtcDate(result.utcDate);
  if (seed === null || source === null) return false;
  return Math.abs(seed - source) <= 24 * 60 * 60 * 1000;
};

const teamDirection = (match: MatchPrediction, result: SourceResult): 'normal' | 'reversed' | null => {
  const home = normalizeTeam(match.homeTeam);
  const away = normalizeTeam(match.awayTeam);
  const resultHome = normalizeSourceSide(result.homeTeam, result.homeAbbreviation);
  const resultAway = normalizeSourceSide(result.awayTeam, result.awayAbbreviation);
  if (resultHome.includes(home) && resultAway.includes(away)) return 'normal';
  if (resultHome.includes(away) && resultAway.includes(home)) return 'reversed';
  return null;
};

const findMatch = (rows: MatchPrediction[], result: SourceResult) => {
  if (Number.isInteger(result.matchNo)) {
    const index = rows.findIndex((match) => match.matchNo === result.matchNo);
    if (index >= 0) return { index, direction: teamDirection(rows[index], result) ?? 'normal' };
  }

  const candidates = rows
    .map((match, index) => ({ match, index, direction: teamDirection(match, result) }))
    .filter(({ match, direction }) => direction && sameDate(match, result));
  return candidates.length === 1 ? { index: candidates[0].index, direction: candidates[0].direction as 'normal' | 'reversed' } : null;
};

const diagnoseMatch16 = (rows: MatchPrediction[], results: SourceResult[], wasUpdated: boolean) => {
  if (wasUpdated) return undefined;
  const match16 = rows.find((match) => match.matchNo === 16);
  if (!match16) return undefined;
  const teamMatches = results.filter((result) => teamDirection(match16, result));
  if (teamMatches.length === 0) return 'matchNo 16 伊朗 vs 新西兰：ESPN 未返回该比赛';
  const dateMatches = teamMatches.filter((result) => sameDate(match16, result));
  if (dateMatches.length === 0) return 'matchNo 16 伊朗 vs 新西兰：日期校验失败';
  if (dateMatches.some((result) => !result.completed)) return 'matchNo 16 伊朗 vs 新西兰：ESPN 返回但状态未完赛';
  if (dateMatches.every((result) => !result.score)) return 'matchNo 16 伊朗 vs 新西兰：ESPN 返回但比分不可用';
  return 'matchNo 16 伊朗 vs 新西兰：球队匹配失败';
};

export const applyEspnResults = (rows: MatchPrediction[], results: SourceResult[]): ResultsUpdateResponse => {
  const nextRows = [...rows];
  const stats: ResultsUpdateStats = {
    updated: 0,
    skippedExisting: 0,
    skippedBeforeMatch16: 0,
    matchFailed: 0,
    unfinishedSkipped: 0,
    sourceFailed: 0,
    espnCompleted: results.filter((result) => result.completed).length,
    espnUnfinished: results.filter((result) => !result.completed).length,
  };
  let match16Updated = false;

  for (const result of results) {
    const found = findMatch(nextRows, result);
    if (!found) {
      stats.matchFailed += 1;
      continue;
    }

    const current = nextRows[found.index];
    if (current.matchNo < 16) {
      stats.skippedBeforeMatch16 += 1;
      continue;
    }
    if (current.actualScore.trim()) {
      stats.skippedExisting += 1;
      continue;
    }
    if (!result.completed || !result.score) {
      stats.unfinishedSkipped += 1;
      continue;
    }

    const homeScore = found.direction === 'normal' ? result.score.home : result.score.away;
    const awayScore = found.direction === 'normal' ? result.score.away : result.score.home;
    nextRows[found.index] = recalculateMatch({ ...current, actualScore: `${homeScore}-${awayScore}` });
    stats.updated += 1;
    if (current.matchNo === 16) match16Updated = true;
  }

  return { rows: nextRows, stats, match16Diagnostic: diagnoseMatch16(rows, results, match16Updated) };
};
