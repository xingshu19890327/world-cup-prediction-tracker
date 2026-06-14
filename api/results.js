const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
const SOURCE_UNAVAILABLE_ERROR = 'football-data.org 暂未返回 2026 World Cup 赛程/赛果数据。';

const teamName = (team = {}) => team.name || team.shortName || team.tla || '';

const fullTimeScore = (score = {}) => {
  const fullTime = score.fullTime || score.fulltime || score.full_time || score.regularTime || {};
  const home = fullTime.home ?? fullTime.homeTeam;
  const away = fullTime.away ?? fullTime.awayTeam;
  if (home === null || home === undefined || away === null || away === undefined) return null;
  if (!Number.isFinite(Number(home)) || !Number.isFinite(Number(away))) return null;
  return { home: Number(home), away: Number(away) };
};

const normalizeMatch = (match = {}) => {
  const score = fullTimeScore(match.score || {});
  const status = match.status || '';
  return {
    id: match.id ?? match.matchId ?? null,
    matchNo: match.matchNo ?? match.matchNumber ?? match.gameNumber ?? match.number ?? null,
    matchday: match.matchday ?? match.matchDay ?? null,
    homeTeam: teamName(match.homeTeam || match.home || {}),
    awayTeam: teamName(match.awayTeam || match.away || {}),
    utcDate: match.utcDate || match.date || match.kickoff || '',
    status,
    finished: status === 'FINISHED',
    live: ['LIVE', 'IN_PLAY', 'PAUSED'].includes(status),
    actualScore: score ? `${score.home}-${score.away}` : ''
  };
};

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ ok: false, code: 'method_not_allowed', error: '仅支持 GET 请求。' });
  }

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(200).json({ ok: false, code: 'missing_token', error: '缺少 FOOTBALL_DATA_TOKEN，请先在 Vercel 环境变量中配置 football-data.org API token。' });
  }

  try {
    const response = await fetch(FOOTBALL_DATA_URL, {
      headers: {
        'X-Auth-Token': token,
        Accept: 'application/json'
      }
    });

    if (response.status === 403) {
      return res.status(200).json({ ok: false, code: 'forbidden', error: 'football-data.org 当前不允许访问 World Cup 2026 数据，可能需要付费权限或数据尚未开放。' });
    }
    if (!response.ok) {
      return res.status(200).json({ ok: false, code: 'source_unavailable', error: SOURCE_UNAVAILABLE_ERROR });
    }

    const data = await response.json();
    const allMatches = Array.isArray(data.matches) ? data.matches : [];
    const matches = allMatches
      .map(normalizeMatch)
      .filter((match) => match.homeTeam && match.awayTeam && match.utcDate);

    if (!matches.length) {
      return res.status(200).json({ ok: false, code: 'source_unavailable', error: SOURCE_UNAVAILABLE_ERROR });
    }

    return res.status(200).json({ ok: true, source: 'football-data.org', matches });
  } catch {
    return res.status(200).json({ ok: false, code: 'source_unavailable', error: SOURCE_UNAVAILABLE_ERROR });
  }
}
