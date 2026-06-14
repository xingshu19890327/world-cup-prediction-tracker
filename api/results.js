const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';

const pickTeamName = (team = {}) => team.name || team.shortName || team.tla || '';
const pickScore = (score = {}) => {
  const fullTime = score.fullTime || score.fulltime || score.full_time || score.regularTime || {};
  const home = fullTime.home ?? fullTime.homeTeam ?? score.home ?? score.homeTeam;
  const away = fullTime.away ?? fullTime.awayTeam ?? score.away ?? score.awayTeam;
  return Number.isFinite(Number(home)) && Number.isFinite(Number(away)) ? { home: Number(home), away: Number(away) } : null;
};
const normalizeMatch = (match) => {
  const score = pickScore(match.score || {});
  return {
    id: match.id ?? match.matchId ?? '',
    matchNo: match.matchNo ?? match.matchNumber ?? match.gameNumber ?? match.number ?? null,
    matchday: match.matchday ?? match.matchDay ?? match.stage ?? '',
    status: match.status || '',
    homeTeam: pickTeamName(match.homeTeam || match.home || {}),
    awayTeam: pickTeamName(match.awayTeam || match.away || {}),
    utcDate: match.utcDate || match.date || match.kickoff || '',
    fullTimeHome: score?.home ?? null,
    fullTimeAway: score?.away ?? null,
    actualScore: score ? `${score.home}-${score.away}` : ''
  };
};

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ ok: false, code: 'method_not_allowed', error: '仅支持 GET 请求' });
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(200).json({ ok: false, code: 'missing_token', error: '缺少 FOOTBALL_DATA_TOKEN，请先在 Vercel 环境变量中配置 football-data.org API token。' });
  }
  try {
    const response = await fetch(FOOTBALL_DATA_URL, {
      headers: { 'X-Auth-Token': token, accept: 'application/json' }
    });
    if (response.status === 403) {
      return res.status(200).json({ ok: false, code: 'forbidden', error: 'football-data.org 当前不允许访问 World Cup 2026 数据，可能需要付费权限或数据尚未开放。' });
    }
    if (!response.ok) {
      return res.status(200).json({ ok: false, code: 'source_unavailable', error: 'football-data.org 暂未返回 2026 World Cup 赛果数据。', details: `HTTP ${response.status}` });
    }
    const payload = await response.json();
    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    if (!matches.length) {
      return res.status(200).json({ ok: false, code: 'source_unavailable', error: 'football-data.org 暂未返回 2026 World Cup 赛果数据。' });
    }
    const finishedMatches = matches
      .map(normalizeMatch)
      .filter((match) => match.status === 'FINISHED' && match.actualScore && match.homeTeam && match.awayTeam);
    return res.status(200).json({ ok: true, source: FOOTBALL_DATA_URL, fetchedAt: new Date().toISOString(), total: matches.length, finishedCount: finishedMatches.length, matches: finishedMatches });
  } catch (error) {
    return res.status(200).json({ ok: false, code: 'source_unavailable', error: 'football-data.org 暂未返回 2026 World Cup 赛果数据。', details: error instanceof Error ? error.message : '未知错误' });
  }
}
