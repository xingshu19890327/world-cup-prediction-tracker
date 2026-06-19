const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io';
const WORLD_CUP_LEAGUE = 1;
const WORLD_CUP_SEASON = 2026;

const send = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const apiFetch = async (path, apiKey) => {
  const response = await fetch(`${FOOTBALL_API_BASE}${path}`, {
    headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API-Football ${response.status}: ${response.statusText}`);
  return response.json();
};

const cornersFromStats = (statsArray, homeAway) => {
  const team = statsArray.find((t) => String(t?.team?.homeAway ?? t?.homeAway ?? '').toLowerCase() === homeAway);
  if (!team) return null;
  const stats = Array.isArray(team.statistics) ? team.statistics : [];
  const found = stats.find((s) => String(s?.type ?? '').toLowerCase().includes('corner'));
  return found ? toNumber(found.value) : null;
};

const parseFixture = (f) => {
  const homeScore = toNumber(f?.goals?.home);
  const awayScore = toNumber(f?.goals?.away);
  const statusShort = f?.fixture?.status?.short ?? '';
  const completed = ['FT', 'AET', 'PEN'].includes(statusShort);
  return {
    id: String(f?.fixture?.id ?? ''),
    utcDate: f?.fixture?.date ?? '',
    completed,
    status: f?.fixture?.status?.long ?? statusShort,
    homeTeam: f?.teams?.home?.name ?? '',
    awayTeam: f?.teams?.away?.name ?? '',
    homeAbbreviation: '',
    awayAbbreviation: '',
    score: homeScore === null || awayScore === null ? null : { home: homeScore, away: awayScore },
    homeCorners: null,
    awayCorners: null,
  };
};

module.exports = async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return send(res, 500, { error: 'config_missing', message: '服务器未配置 API_FOOTBALL_KEY 环境变量。' });

  try {
    const data = await apiFetch(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${WORLD_CUP_SEASON}`, apiKey);
    const fixtures = Array.isArray(data?.response) ? data.response : [];
    const matches = fixtures
      .map(parseFixture)
      .filter((m) => m.homeTeam && m.awayTeam);

    // 对已完赛的比赛并发拉取角球统计
    const completed = matches.filter((m) => m.completed);
    await Promise.all(completed.map(async (match) => {
      try {
        const statsData = await apiFetch(`/fixtures/statistics?fixture=${match.id}`, apiKey);
        const statsArray = Array.isArray(statsData?.response) ? statsData.response : [];
        // API-Football statistics 返回 [{team:{id,name}, statistics:[...]}, ...]
        // homeAway 字段不在 statistics 里，需要对比队名和 fixture 里的主客信息
        // 用顺序：第一个是主队，第二个是客队（API-Football 惯例）
        if (statsArray.length >= 2) {
          const findCorners = (teamStats) => {
            const stats = Array.isArray(teamStats?.statistics) ? teamStats.statistics : [];
            const found = stats.find((s) => String(s?.type ?? '').toLowerCase().includes('corner'));
            return found ? toNumber(found.value) : null;
          };
          match.homeCorners = findCorners(statsArray[0]);
          match.awayCorners = findCorners(statsArray[1]);
        }
      } catch {
        // 单场统计失败不影响整体
      }
    }));

    const completedCount = completed.length;
    const unfinishedCount = matches.length - completedCount;
    const sampleTeams = matches.slice(0, 5).map((m) => `${m.homeTeam} vs ${m.awayTeam}`);
    return send(res, 200, { matches, stats: { completedCount, unfinishedCount, sourceCount: matches.length, dates: null, debug: { sampleTeams } } });
  } catch (error) {
    return send(res, 503, { error: 'source_unavailable', message: `赛果数据源失败：${error instanceof Error ? error.message : '未知错误'}` });
  }
};
