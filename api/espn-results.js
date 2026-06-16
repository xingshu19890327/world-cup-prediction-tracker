const baseEndpoint = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const send = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseEvent = (event) => {
  const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const home = competitors.find((competitor) => competitor?.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((competitor) => competitor?.homeAway === 'away') ?? competitors[1];
  const homeScore = toNumber(home?.score);
  const awayScore = toNumber(away?.score);

  return {
    id: event?.id,
    utcDate: event?.date ?? competition?.date ?? '',
    completed: Boolean(event?.status?.type?.completed ?? competition?.status?.type?.completed),
    status: event?.status?.type?.description ?? event?.status?.type?.name ?? '',
    homeTeam: home?.team?.displayName ?? home?.team?.name ?? home?.team?.shortDisplayName ?? '',
    awayTeam: away?.team?.displayName ?? away?.team?.name ?? away?.team?.shortDisplayName ?? '',
    homeAbbreviation: home?.team?.abbreviation ?? '',
    awayAbbreviation: away?.team?.abbreviation ?? '',
    score: homeScore === null || awayScore === null ? null : { home: homeScore, away: awayScore },
  };
};

module.exports = async function handler(req, res) {
  const dates = typeof req.query?.dates === 'string' ? req.query.dates.trim() : '';
  const endpoint = dates ? `${baseEndpoint}?dates=${encodeURIComponent(dates)}` : baseEndpoint;

  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) return send(res, response.status, { error: 'source_unavailable', message: 'ESPN 数据源暂时不可用，请稍后重试或手动填写。' });

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const matches = events.map(parseEvent).filter((match) => match.homeTeam && match.awayTeam);
    const completedCount = matches.filter((match) => match.completed).length;
    const unfinishedCount = matches.length - completedCount;

    return send(res, 200, { matches, stats: { completedCount, unfinishedCount, sourceCount: matches.length, dates: dates || null } });
  } catch (error) {
    return send(res, 503, { error: 'source_unavailable', message: `ESPN 数据源暂时不可用：${error instanceof Error ? error.message : '未知错误'}` });
  }
};
