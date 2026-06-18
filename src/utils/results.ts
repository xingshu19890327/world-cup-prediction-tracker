import type { MatchPrediction } from '../types';
import { recalculateMatch } from './score';

type SourceResult = {
  id?: string;
  matchNo?: number;
  utcDate?: string;
  completed?: boolean;
  homeTeam: string;
  awayTeam: string;
  homeAbbreviation?: string;
  awayAbbreviation?: string;
  score?: { home: number; away: number } | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
};

type MatchDirection = 'normal' | 'reversed';
type FocusReason = 'ESPN 未返回该比赛' | 'ESPN 返回但状态未完赛' | '球队匹配失败' | '日期校验失败' | 'ESPN 返回比分无效' | '已更新';

type MatchFailureSample = {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  australiaTime: string;
  candidates: string[];
};

export type ResultsUpdateStats = {
  updated: number;
  matchFailed: number;
  sourceFailed: number;
  espnReturned: number;
  espnCompleted: number;
  espnUnfinished: number;
  espnMissing: number;
  focusDiagnostics: { matchNo: number; label: string; reason: FocusReason }[];
  matchFailureSamples: MatchFailureSample[];
  updatedMatches: { matchNo: number; label: string; score: string }[];
};

export type ResultsUpdateResponse = {
  rows: MatchPrediction[];
  stats: ResultsUpdateStats;
};

const aliasEntries: [string, string][] = [
  ['墨西哥', 'mexico'], ['南非', 'southafrica'], ['韩国', 'korea'], ['捷克', 'czechia'], ['加拿大', 'canada'],
  ['波黑', 'bosniaherzegovina'], ['美国', 'unitedstates'], ['巴拉圭', 'paraguay'], ['土耳其', 'turkey'],
  ['瑞士', 'switzerland'], ['巴西', 'brazil'], ['摩洛哥', 'morocco'], ['苏格兰', 'scotland'], ['海地', 'haiti'],
  ['德国', 'germany'], ['库拉索', 'curacao'], ['法国', 'france'], ['挪威', 'norway'], ['norway', 'norway'], ['nor', 'norway'], ['卡塔尔', 'qatar'],
  ['加纳', 'ghana'], ['科特迪瓦', 'ivorycoast'], ['厄瓜多尔', 'ecuador'], ['澳大利亚', 'australia'],
  ['伊朗', 'iran'], ['iran', 'iran'], ['ir iran', 'iran'], ['islamic republic of iran', 'iran'], ['irn', 'iran'],
  ['伊拉克', 'iraq'], ['iraq', 'iraq'], ['irq', 'iraq'],
  ['瑞典', 'sweden'], ['sweden', 'sweden'], ['swe', 'sweden'],
  ['突尼斯', 'tunisia'], ['tunisia', 'tunisia'], ['tun', 'tunisia'],
  ['西班牙', 'spain'], ['spain', 'spain'], ['esp', 'spain'],
  ['佛得角', 'capeverde'], ['cape verde', 'capeverde'], ['cabo verde', 'capeverde'], ['cape verde islands', 'capeverde'], ['cpv', 'capeverde'],
  ['沙特', 'saudiarabia'], ['阿根廷', 'argentina'], ['奥地利', 'austria'], ['英格兰', 'england'],
  ['克罗地亚', 'croatia'], ['日本', 'japan'], ['荷兰', 'netherlands'], ['新西兰', 'newzealand'], ['new zealand', 'newzealand'], ['nzl', 'newzealand'],
  ['埃及', 'egypt'], ['比利时', 'belgium'], ['牙买加', 'jamaica'], ['哥伦比亚', 'colombia'], ['尼日利亚', 'nigeria'],
  ['乌拉圭', 'uruguay'], ['约旦', 'jordan'], ['塞内加尔', 'senegal'], ['葡萄牙', 'portugal'], ['乌兹别克斯坦', 'uzbekistan'], ['阿尔及利亚', 'algeria'],
  // 补全缺失的中文→ESPN英文映射（compactTeam 会清除中文字符，必须显式 alias）
  ['伊拉克', 'iraq'], ['iraq', 'iraq'],
  ['巴拿马', 'panama'], ['panama', 'panama'],
  ['刚果', 'congo'],
  ['congo', 'congo'], ['republic of congo', 'congo'], ['congo brazzaville', 'congo'],
  ['congo republic', 'congo'], ['republicofcongo', 'congo'], ['congo-brazzaville', 'congo'],
  ['rep. congo', 'congo'], ['rep congo', 'congo'], ['cgo', 'congo'], ['rco', 'congo'], ['con', 'congo'],
  // 同时把刚果民主共和国(DR Congo)的各种写法也归到同一支"刚果"，避免 ESPN 用哪种都匹配失败
  ['dr congo', 'congo'], ['drcongo', 'congo'], ['congo dr', 'congo'], ['congodr', 'congo'],
  ['dr. congo', 'congo'], ['democratic republic of congo', 'congo'], ['drc', 'congo'],
  ['cod', 'congo'], ['congo kinshasa', 'congo'], ['congo-kinshasa', 'congo'],
];
const teamAliases = Object.fromEntries(aliasEntries.map(([key, value]) => [key.toLowerCase(), value]));

const compactTeam = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const normalizeTeam = (value: string) => teamAliases[value.trim().toLowerCase()] ?? compactTeam(value);
const normalizeSourceSide = (name: string, abbreviation?: string) => [normalizeTeam(name), abbreviation ? normalizeTeam(abbreviation) : ''].filter(Boolean);

export const espnDateFromAustraliaTime = (australiaTime: string) => {
  const match = australiaTime.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!match) return '';
  return `2026${match[1].padStart(2, '0')}${match[2].padStart(2, '0')}`;
};

const seedUtcDate = (australiaTime: string) => {
  const yyyymmdd = espnDateFromAustraliaTime(australiaTime);
  if (!yyyymmdd) return null;
  return Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)));
};
const sourceUtcDate = (utcDate?: string) => {
  if (!utcDate) return null;
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};
const dateDeltaDays = (match: MatchPrediction, result: SourceResult) => {
  const seed = seedUtcDate(match.australiaTime);
  const source = sourceUtcDate(result.utcDate);
  if (seed === null || source === null) return Number.POSITIVE_INFINITY;
  return Math.round((source - seed) / (24 * 60 * 60 * 1000));
};
const sameDate = (match: MatchPrediction, result: SourceResult) => Math.abs(dateDeltaDays(match, result)) <= 1;

const teamDirection = (match: MatchPrediction, result: SourceResult): MatchDirection | null => {
  const home = normalizeTeam(match.homeTeam);
  const away = normalizeTeam(match.awayTeam);
  const resultHome = normalizeSourceSide(result.homeTeam, result.homeAbbreviation);
  const resultAway = normalizeSourceSide(result.awayTeam, result.awayAbbreviation);
  if (resultHome.includes(home) && resultAway.includes(away)) return 'normal';
  if (resultHome.includes(away) && resultAway.includes(home)) return 'reversed';
  return null;
};

const describeResult = (result: SourceResult) => `${result.homeTeam} vs ${result.awayTeam}${result.utcDate ? ` ${result.utcDate.slice(0, 10)}` : ''}${result.completed ? ' 已完赛' : ' 未完赛'}`;

const findMatch = (rows: MatchPrediction[], result: SourceResult) => {
  const candidates = rows
    .map((match, index) => ({ match, index, direction: teamDirection(match, result), dateOk: sameDate(match, result), delta: Math.abs(dateDeltaDays(match, result)) }))
    .filter((candidate) => candidate.direction && candidate.dateOk)
    .sort((a, b) => a.delta - b.delta);
  return candidates.length === 1 ? { index: candidates[0].index, direction: candidates[0].direction as MatchDirection } : null;
};

const diagnoseMatch = (match: MatchPrediction, results: SourceResult[]): { reason: FocusReason; candidates: SourceResult[] } => {
  const nearbyResults = results.filter((result) => sameDate(match, result));
  const teamCandidates = results.filter((result) => teamDirection(match, result));
  if (teamCandidates.length === 0) {
    return nearbyResults.length > 0
      ? { reason: '球队匹配失败', candidates: nearbyResults.slice(0, 3) }
      : { reason: 'ESPN 未返回该比赛', candidates: closestCandidates(match, results) };
  }
  const dateCandidates = teamCandidates.filter((result) => sameDate(match, result));
  if (dateCandidates.length === 0) return { reason: '日期校验失败', candidates: teamCandidates.slice(0, 3) };
  const completed = dateCandidates.find((result) => result.completed);
  if (!completed) return { reason: 'ESPN 返回但状态未完赛', candidates: dateCandidates.slice(0, 3) };
  if (!completed.score || !Number.isFinite(completed.score.home) || !Number.isFinite(completed.score.away)) return { reason: 'ESPN 返回比分无效', candidates: [completed] };
  return { reason: 'ESPN 未返回该比赛', candidates: [] };
};

const closestCandidates = (match: MatchPrediction, results: SourceResult[]) => {
  const seed = seedUtcDate(match.australiaTime);
  return [...results]
    .sort((a, b) => Math.abs((sourceUtcDate(a.utcDate) ?? 0) - (seed ?? 0)) - Math.abs((sourceUtcDate(b.utcDate) ?? 0) - (seed ?? 0)))
    .slice(0, 3);
};

const blankPastMatches = (rows: MatchPrediction[]) => rows.filter((match) => !match.actualScore.trim() && seedUtcDate(match.australiaTime) !== null && seedUtcDate(match.australiaTime)! <= Date.now());

export const applyEspnResults = (rows: MatchPrediction[], results: SourceResult[]): ResultsUpdateResponse => {
  const nextRows = [...rows];
  const matchedIndexes = new Set<number>();
  const failureSamples = new Map<number, MatchFailureSample>();
  const stats: ResultsUpdateStats = {
    updated: 0, matchFailed: 0, sourceFailed: 0, espnReturned: results.length,
    espnCompleted: results.filter((result) => result.completed).length,
    espnUnfinished: results.filter((result) => !result.completed).length,
    espnMissing: 0, focusDiagnostics: [], matchFailureSamples: [], updatedMatches: [],
  };

  for (const result of results) {
    const found = findMatch(nextRows, result);
    if (!found) {
      stats.matchFailed += 1;
      const candidates = rows.filter((match) => sameDate(match, result)).slice(0, 3);
      for (const match of candidates) {
        if (failureSamples.size >= 5) break;
        failureSamples.set(match.matchNo, { matchNo: match.matchNo, homeTeam: match.homeTeam, awayTeam: match.awayTeam, australiaTime: match.australiaTime, candidates: [describeResult(result)] });
      }
      continue;
    }

    matchedIndexes.add(found.index);
    const current = nextRows[found.index];
    if (!result.completed) continue;
    if (!result.score || !Number.isFinite(result.score.home) || !Number.isFinite(result.score.away)) continue;

    const homeScore = found.direction === 'normal' ? result.score.home : result.score.away;
    const awayScore = found.direction === 'normal' ? result.score.away : result.score.home;
    const nextScore = `${homeScore}-${awayScore}`;

    // 角球：按主客方向映射，仅在本地尚未填写时写入，避免覆盖手动数据
    const srcHomeCorners = found.direction === 'normal' ? result.homeCorners : result.awayCorners;
    const srcAwayCorners = found.direction === 'normal' ? result.awayCorners : result.homeCorners;
    const cornerPatch: Partial<MatchPrediction> = {};
    if (Number.isFinite(srcHomeCorners) && String(current.homeCorners ?? '').trim() === '') cornerPatch.homeCorners = srcHomeCorners as number;
    if (Number.isFinite(srcAwayCorners) && String(current.awayCorners ?? '').trim() === '') cornerPatch.awayCorners = srcAwayCorners as number;

    if (current.actualScore.trim() === nextScore) {
      if (Object.keys(cornerPatch).length) nextRows[found.index] = recalculateMatch({ ...current, ...cornerPatch });
      continue;
    }
    nextRows[found.index] = recalculateMatch({ ...current, actualScore: nextScore, ...cornerPatch });
    stats.updated += 1;
    stats.updatedMatches.push({ matchNo: current.matchNo, label: `${current.homeTeam} vs ${current.awayTeam}`, score: nextScore });
  }

  const focusMatches = rows.filter((match) => match.matchNo === 12 || match.matchNo === 13 || match.matchNo === 18);
  stats.focusDiagnostics = focusMatches.map((match) => {
    const updated = nextRows.find((row) => row.matchNo === match.matchNo)?.actualScore.trim();
    const diagnostic = updated ? { reason: '已更新' as FocusReason, candidates: [] } : diagnoseMatch(match, results);
    return { matchNo: match.matchNo, label: `${match.homeTeam} vs ${match.awayTeam}`, reason: diagnostic.reason };
  });

  for (const match of blankPastMatches(nextRows)) {
    if (failureSamples.size >= 5) break;
    const diagnostic = diagnoseMatch(match, results);
    failureSamples.set(match.matchNo, { matchNo: match.matchNo, homeTeam: match.homeTeam, awayTeam: match.awayTeam, australiaTime: match.australiaTime, candidates: diagnostic.candidates.map(describeResult) });
  }

  stats.matchFailureSamples = [...failureSamples.values()].slice(0, 5);
  stats.espnMissing = rows.length - matchedIndexes.size;
  return { rows: nextRows, stats };
};
